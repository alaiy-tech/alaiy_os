# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Where a produced product image lives: S3, when the site configures a bucket.

The images the listing pipeline produces -- the white-background main image, the
translated gallery, generated photos -- used to be written to the site's own disk as
public Frappe Files, and the listing rows stored the site-relative path
(`/files/listing-...jpg`). That has two problems. The bench is stateful in the one place
it should not be: an image is produced on whichever worker picked the job up and has to
still be there after a redeploy. And a channel that fetches images itself needs an
address it will accept: a site-relative path is not an address at all, and Amazon reads
images from AWS-hosted locations.

So a produced image goes to S3, and the row stores the object's URL. Every connector
that produces or publishes images goes through this module, so the rules below hold for
all of them.

**Objects are private.** The bucket blocks public access, so a stored URL is not
fetchable on its own. Anything that hands an image to someone else -- a channel API, an
image service, a reviewer's browser -- asks `fetchable_url()` for a presigned link, and
anything that wants the pixels asks `read()`. A URL that is not one of ours passes
through untouched, which is what lets one call site serve supplier CDN photos, local
Files and S3 objects alike.

**S3 is opt-in and never fatal.** A site with no `S3_BUCKET` keeps writing local Files,
which is what dev sites and CI want. A configured bucket that refuses an upload after
its retries also falls back to a local File, rather than throwing away an image that
cost real money to produce -- loudly, in the error log, because a site silently drifting
back to local disk is the failure this module exists to remove.

**Local images are moved when they are shared.** An image saved as a local File before
the site had a bucket is uploaded the first time `fetchable_url()` is asked for it,
under a key derived from its path, so asking again finds the same object rather than
uploading twice. Nothing is rewritten on the row and nothing is deleted.

Configuration is read from the environment first, then from `site_config.json` under
the same names lowercased (`s3_bucket`, `image_s3_region`, ...). Credentials follow the
same rule and are optional: leave `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` out --
the better choice -- and boto3 resolves an instance role, a profile or the ambient
environment on its own.

"""

import hashlib
import os
import threading

import frappe

# `S3_BUCKET` has no default on purpose: its presence IS the switch, so a site can never
# be surprised into uploading somewhere by a default nobody chose.
BUCKET_VAR = "S3_BUCKET"
REGION_VAR = "IMAGE_S3_REGION"
DEFAULT_REGION = "ap-south-1"

PREFIX_VAR = "IMAGE_S3_PREFIX"
DEFAULT_PREFIX = "images/"
EXPIRY_VAR = "IMAGE_S3_URL_EXPIRY"
DEFAULT_EXPIRY = 7 * 24 * 3600  # SigV4's ceiling.
ACL_VAR = "IMAGE_S3_ACL"
DEFAULT_ACL = "private"
NO_ACL = "none"  # IMAGE_S3_ACL=none sends no ACL at all; see `upload`.
ENDPOINT_VAR = "IMAGE_S3_ENDPOINT_URL"  # MinIO and friends; unset means real S3.
ATTEMPTS_VAR = "IMAGE_S3_MAX_ATTEMPTS"
DEFAULT_ATTEMPTS = 3

# Normally unset: boto3 finds an instance role or a profile on its own. They exist
# because the upload happens on a supervisor-managed worker, which inherits neither the
# login shell's environment nor reliably its HOME, so naming them here is the one place
# the web process and the workers are guaranteed to read the same thing.
ACCESS_KEY_VAR = "AWS_ACCESS_KEY_ID"
SECRET_KEY_VAR = "AWS_SECRET_ACCESS_KEY"
SESSION_TOKEN_VAR = "AWS_SESSION_TOKEN"

# A CDN (or any read-only public origin) in front of the bucket. Set it and stored URLs
# become `<base>/<key>`: already fetchable, so nothing is presigned and nothing expires.
PUBLIC_BASE_VAR = "IMAGE_S3_PUBLIC_BASE_URL"

# The kinds of image the pipeline produces, and the key prefix each lands under, so a
# reviewer and a lifecycle rule can tell them apart without opening them. `promoted` is
# a local File moved to the bucket when it was first shared.
GENERATED = "generated"
TRANSLATED = "translated"
PROMOTED = "promoted"
CATEGORIES = (GENERATED, TRANSLATED, PROMOTED)

_RETRYABLE_CODES = {
	"InternalError",
	"RequestTimeout",
	"RequestTimeTooSkewed",
	"ServiceUnavailable",
	"SlowDown",
	"ThrottlingException",
	"Throttling",
	"503",
	"500",
}

# A bucket with Object Ownership set to "bucket owner enforced" -- the default for
# buckets created since 2023 -- rejects any request that carries an ACL. Such a bucket is
# private by construction, which is what the ACL asked for, so it is dropped and retried.
_ACL_UNSUPPORTED_CODES = {"AccessControlListNotSupported", "InvalidBucketAclWithObjectOwnership"}

_NOT_FOUND_CODES = {"404", "NoSuchKey", "NotFound"}

LOG_TITLE = "Product images"

# boto3 clients are safe to use from several threads but not to build, and images are
# rendered on a pool. One client per (bucket, region, endpoint, key id), built under a lock.
_clients = {}
_clients_lock = threading.Lock()


# ── configuration ─────────────────────────────────────────────────────────────


def setting(name, default=None):
	"""One configuration value: environment first, then site_config, then the default."""
	value = os.environ.get(name)
	if value is None or value == "":
		value = frappe.conf.get(name.lower())
	if value is None or value == "":
		return default
	return value


def bucket():
	"""The configured bucket, or None when this site stores images locally."""
	return setting(BUCKET_VAR)


def region():
	return setting(REGION_VAR, DEFAULT_REGION)


def enabled():
	"""Whether produced images go to S3 at all: a bucket configured and boto3 importable.

	A configured bucket without boto3 is said out loud, once per request, and degrades
	to local Files like any other S3 problem rather than raising inside an image job.
	"""
	if not bucket():
		return False
	try:
		import boto3  # noqa: F401
	except ImportError:
		if not getattr(frappe.local, "image_store_boto3_warned", False):
			frappe.local.image_store_boto3_warned = True
			frappe.log_error(
				title=f"{LOG_TITLE}: boto3 missing",
				message=(
					f"{BUCKET_VAR} is set to '{bucket()}' but boto3 is not installed in this "
					"bench's environment, so produced images are being stored as local Files "
					"instead. Run `bench setup requirements` and restart."
				),
			)
		return False
	return True


def _int_setting(name, default):
	try:
		return int(setting(name, default))
	except (TypeError, ValueError):
		return default


def expiry():
	"""How long a presigned URL stays valid, in seconds."""
	return _int_setting(EXPIRY_VAR, DEFAULT_EXPIRY)


def max_attempts():
	return max(1, _int_setting(ATTEMPTS_VAR, DEFAULT_ATTEMPTS))


def credentials():
	"""Explicit credentials for the client, or {} to leave it to boto3's own chain.

	Both halves or neither: a key id with no secret would otherwise present as an
	unsigned request, which is a confusing way to find out.
	"""
	access_key = setting(ACCESS_KEY_VAR)
	secret_key = setting(SECRET_KEY_VAR)
	if not access_key or not secret_key:
		return {}
	values = {"aws_access_key_id": access_key, "aws_secret_access_key": secret_key}
	token = setting(SESSION_TOKEN_VAR)
	if token:
		values["aws_session_token"] = token
	return values


def client():
	"""A cached S3 client for the configured bucket."""
	import boto3
	from botocore.config import Config

	endpoint = setting(ENDPOINT_VAR)
	creds = credentials()
	# The cache key covers the credential identity, not the secret: a site that rotates
	# its key must not keep signing with a client built from the old one.
	key = (bucket(), region(), endpoint, creds.get("aws_access_key_id"))
	if key in _clients:
		return _clients[key]

	with _clients_lock:
		if key not in _clients:
			_clients[key] = boto3.client(
				"s3",
				region_name=region(),
				endpoint_url=endpoint,
				config=Config(retries={"max_attempts": max_attempts(), "mode": "standard"}),
				**creds,
			)
	return _clients[key]


# ── keys and URLs ─────────────────────────────────────────────────────────────


def _stamp():
	"""A sortable timestamp for a key. Its own function so tests can pin it."""
	return frappe.utils.now_datetime().strftime("%Y%m%d%H%M%S%f")[:-3]


def _prefix():
	return str(setting(PREFIX_VAR, DEFAULT_PREFIX)).strip("/")


def key_for(file_name, category=None):
	"""The object key a produced image goes under.

	`images/<category>/<YYYY>/<MM>/<name>-<timestamp><ext>`: the caller's filename is
	kept, with a millisecond timestamp so two runs producing the same name cannot
	collide -- keys are never overwritten, which is also what Amazon requires of a
	private S3 image it has read. The date folders let a lifecycle rule talk about age.
	"""
	category = category if category in CATEGORIES else GENERATED
	stem, ext = os.path.splitext(file_name or "image")
	stamp = _stamp()
	return f"{_prefix()}/{category}/{stamp[:4]}/{stamp[4:6]}/{stem}-{stamp}{ext}"


def promoted_key(local_url):
	"""The key a local File is moved to when first shared. Derived from its path, so the
	same File always maps to the same object and is uploaded once."""
	digest = hashlib.sha1(local_url.encode("utf-8")).hexdigest()[:16]
	stem, ext = os.path.splitext(os.path.basename(local_url))
	return f"{_prefix()}/{PROMOTED}/{stem}-{digest}{ext}"


def public_base():
	base = setting(PUBLIC_BASE_VAR)
	return base.rstrip("/") if base else None


def object_url(key):
	"""The canonical URL for a key: what gets stored on the listing row.

	The CDN base when one is configured; otherwise virtual-hosted style against the
	bucket's own region. That form is not fetchable without a signature.
	"""
	base = public_base()
	if base:
		return f"{base}/{key}"
	endpoint = setting(ENDPOINT_VAR)
	if endpoint:
		return f"{endpoint.rstrip('/')}/{bucket()}/{key}"
	return f"https://{bucket()}.s3.{region()}.amazonaws.com/{key}"


def is_stored_url(url):
	"""Whether this URL is an object in the configured bucket."""
	return key_from_url(url) is not None


def key_from_url(url):
	"""The object key inside a URL this module produced, or None."""
	if not url or not bucket():
		return None
	endpoint = setting(ENDPOINT_VAR)
	candidates = [f"https://{bucket()}.s3.{region()}.amazonaws.com/", f"https://{bucket()}.s3.amazonaws.com/"]
	if endpoint:
		candidates.insert(0, f"{endpoint.rstrip('/')}/{bucket()}/")
	if public_base():
		candidates.insert(0, f"{public_base()}/")
	for base in candidates:
		if url.startswith(base):
			# An already-presigned URL resolves to the same key, not one with a signature on.
			return url[len(base) :].split("?")[0] or None
	return None


def is_local_url(url):
	"""Whether this is a site-relative public File path, like `/files/x.jpg`."""
	return bool(url) and url.startswith("/files/")


# ── writing ───────────────────────────────────────────────────────────────────


def save(file_name, content, media_type, category=None, metadata=None):
	"""Store produced image bytes and return the URL to record on the listing row.

	S3 when a bucket is configured. Otherwise, and if S3 refuses the object after its
	retries, a standalone public Frappe File, which is what the pipeline did before and
	what a dev site or CI still wants. Standalone -- attached to no document -- because the
	image belongs to the run that produced it, not to the product it came from.
	"""
	stored = upload(file_name, content, media_type, category=category, metadata=metadata)
	if stored:
		return stored

	from frappe.utils.file_manager import save_file

	return save_file(file_name, content, None, None, is_private=0).file_url


def upload(file_name, content, media_type, category=None, metadata=None):
	"""Store image bytes in the bucket and return the object's URL, or None.

	None means "this site does not use S3", or that the upload failed after its retries
	(logged): either way the caller keeps the image some other way.
	"""
	if not enabled():
		return None
	return _put(key_for(file_name, category), file_name, content, media_type, category, metadata)


def _put(key, file_name, content, media_type, category, metadata):
	extra = {
		"Bucket": bucket(),
		"Key": key,
		"Body": content,
		"ContentType": media_type or "application/octet-stream",
		"Metadata": _metadata(file_name, category, metadata),
	}
	acl = setting(ACL_VAR, DEFAULT_ACL)
	if acl and str(acl).lower() != NO_ACL:
		extra["ACL"] = acl

	try:
		_put_with_retries(extra)
	except Exception as exc:
		frappe.log_error(
			title=f"{LOG_TITLE}: S3 upload failed",
			message=f"{bucket()}/{key} ({len(content or b'')} bytes)\n{exc}",
		)
		return None
	return object_url(key)


def _metadata(file_name, category, metadata):
	"""User metadata for the object. S3 sends it back as headers, so values have to be
	ASCII and small; anything else is dropped rather than failing the upload."""
	values = {"original-filename": file_name or "", "category": category or GENERATED}
	for name, value in (metadata or {}).items():
		if value is None:
			continue
		value = str(value)
		if len(value) <= 1024 and value.isascii():
			values[str(name)] = value
	return {k: v for k, v in values.items() if v}


def _put_with_retries(extra):
	"""put_object, retried on the transient codes, with the ACL dropped if the bucket
	does not take one. Raises the last error when every attempt failed."""
	from botocore.exceptions import BotoCoreError, ClientError

	attempts = max_attempts()
	for attempt in range(1, attempts + 1):
		try:
			client().put_object(**extra)
			return
		except ClientError as exc:
			code = str(exc.response.get("Error", {}).get("Code", ""))
			if code in _ACL_UNSUPPORTED_CODES and "ACL" in extra:
				extra.pop("ACL")
				continue
			if code in _RETRYABLE_CODES and attempt < attempts:
				continue
			raise
		except BotoCoreError:
			if attempt < attempts:
				continue
			raise


# ── reading and sharing ───────────────────────────────────────────────────────


def presigned_url(url, seconds=None):
	"""A time-limited HTTPS URL anyone can GET, for an image stored in the bucket.

	Returns the URL unchanged when it is not one of ours, or when a public base already
	serves it with no expiry.
	"""
	key = key_from_url(url)
	if not key or not enabled():
		return url
	if public_base() and url.startswith(f"{public_base()}/"):
		return url
	return _sign(key, seconds) or url


def _sign(key, seconds=None):
	try:
		return client().generate_presigned_url(
			"get_object",
			Params={"Bucket": bucket(), "Key": key},
			ExpiresIn=seconds or expiry(),
		)
	except Exception as exc:
		frappe.log_error(title=f"{LOG_TITLE}: presign failed", message=f"{bucket()}/{key}\n{exc}")
		return None


def fetchable_url(url, seconds=None):
	"""An absolute URL a third party can fetch for itself, for any image URL.

	- an object in our bucket -> a presigned link;
	- a local File (`/files/x.jpg`) -> moved to the bucket on first use and presigned,
	  when the site has one; otherwise expanded against the site URL, which resolves
	  only when the site is reachable from the internet;
	- anything already absolute (a supplier CDN photo) -> unchanged.

	Never raises: a URL that cannot be improved on is returned as the best one there is.
	"""
	if not url:
		return url
	if is_stored_url(url):
		return presigned_url(url, seconds)
	if is_local_url(url):
		promoted = _promote(url)
		if promoted:
			return presigned_url(promoted, seconds)
		return frappe.utils.get_url(url)
	return url


def _promote(local_url):
	"""Move a local File into the bucket under its stable key. Returns the object URL, or
	None when there is no bucket, no such File, or the upload failed."""
	if not enabled():
		return None
	key = promoted_key(local_url)
	if _exists(key):
		return object_url(key)
	try:
		content, media_type = _local_bytes(local_url)
	except Exception as exc:
		frappe.log_error(title=f"{LOG_TITLE}: local image unreadable", message=f"{local_url}\n{exc}")
		return None
	return _put(
		key, os.path.basename(local_url), content, media_type, PROMOTED, {"promoted-from": local_url}
	)


def _exists(key):
	from botocore.exceptions import ClientError

	try:
		client().head_object(Bucket=bucket(), Key=key)
		return True
	except ClientError as exc:
		if str(exc.response.get("Error", {}).get("Code", "")) in _NOT_FOUND_CODES:
			return False
		raise


def _local_bytes(url):
	"""A public File's bytes and media type, by its site-relative URL."""
	import mimetypes

	name = frappe.db.get_value("File", {"file_url": url}, "name")
	if not name:
		frappe.throw(f"No File found for '{url}'.")
	content = frappe.get_doc("File", name).get_content()
	if isinstance(content, str):
		content = content.encode("utf-8", "ignore")
	return content, mimetypes.guess_type(url)[0] or "image/jpeg"


def viewable_url(url, seconds=None):
	"""A URL a signed-in user's browser can show, for any image URL.

	An object in our bucket is presigned; anything else -- a local File, which the
	browser loads from the site itself, or a supplier photo -- is returned unchanged.
	Unlike `fetchable_url` this never uploads, so drawing a thumbnail has no side effect.
	"""
	if is_stored_url(url):
		return presigned_url(url, seconds)
	return url


def viewable_urls(urls, seconds=None):
	"""`{url: viewable_url(url)}` for every distinct URL given, for a screen to swap in."""
	return {url: viewable_url(url, seconds) for url in dict.fromkeys(u for u in urls or [] if u)}


def read(url):
	"""An image's bytes and media type, `(bytes, media_type)`, read with our own access.

	For an object in our bucket or a local File. None for anything else -- a supplier CDN
	photo is fetched over HTTP by the caller, as before.
	"""
	key = key_from_url(url)
	if key and enabled():
		obj = client().get_object(Bucket=bucket(), Key=key)
		body = obj["Body"].read()
		return body, (obj.get("ContentType") or "").split(";")[0].strip() or None
	if is_local_url(url):
		return _local_bytes(url)
	return None
