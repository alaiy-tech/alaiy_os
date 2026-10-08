# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Unit tests for where a produced product image is stored.

The properties pinned here are each a way product images break:

**A site with no bucket keeps writing local Files.** S3 is opt-in, and the switch is
the presence of `S3_BUCKET` -- never a default nobody chose.

**A produced image never overwrites another.** Keys carry the caller's filename, the
category prefix and a millisecond stamp, so two runs on the same photo are two objects.

**An upload that fails does not cost the image.** Transient S3 errors are retried; a
bucket that enforces object ownership takes the object without an ACL; and an upload
that still cannot land falls back to a local File.

**Sharing goes back through the store.** Objects are private, so anything handed to a
third party is a presigned link, and anything that wants the bytes reads them with our
own credentials. A local File is moved to the bucket the first time it is shared, once.
A URL that is not ours passes through untouched.

No network and no bucket: the S3 client is a stub that records what it was asked.
"""

import os
import unittest
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from alaiy_os import image_store

BUCKET = "white-background"
REGION = "ap-south-1"
PNG = b"\x89PNG\r\n\x1a\nfake"


def _unset_conf(test, var):
	"""Take a knob out of the site's own config for the length of one test.

	`setting()` reads the environment first and site_config second, so a site that
	happens to configure one of these would otherwise answer for a test that is
	asserting about the environment (or about nothing being configured at all).
	"""
	key = var.lower()
	if key in frappe.conf:
		previous = frappe.conf[key]
		test.addCleanup(frappe.conf.__setitem__, key, previous)
	frappe.conf.pop(key, None)


def _set_conf(test, var, value):
	"""The mirror image: put a knob in site_config for one test."""
	key = var.lower()
	_unset_conf(test, var)
	frappe.conf[key] = value
	test.addCleanup(frappe.conf.pop, key, None)


class FakeClientError(Exception):
	"""Stands in for botocore's ClientError, which is what this code matches on."""

	def __init__(self, code):
		super().__init__(code)
		self.response = {"Error": {"Code": code}}


class FakeBody:
	def __init__(self, content):
		self.content = content

	def read(self):
		return self.content


class FakeS3:
	"""Records every call, and fails the first `fail_times` puts with `fail_code`."""

	def __init__(self, fail_code=None, fail_times=0):
		self.fail_code = fail_code
		self.fail_times = fail_times
		self.puts = []
		self.presigned = []
		self.objects = {}

	def put_object(self, **kwargs):
		self.puts.append(kwargs)
		if self.fail_times:
			self.fail_times -= 1
			raise FakeClientError(self.fail_code)
		self.objects[kwargs["Key"]] = kwargs
		return {}

	def head_object(self, Bucket=None, Key=None):  # noqa: N803
		if Key not in self.objects:
			raise FakeClientError("404")
		return {}

	def generate_presigned_url(self, op, Params=None, ExpiresIn=None):  # noqa: N803
		self.presigned.append((op, Params, ExpiresIn))
		# Shaped like the real thing — the object's own url with the signature in the
		# query string — because code downstream has to cope with that.
		return (
			f"https://{Params['Bucket']}.s3.{REGION}.amazonaws.com/{Params['Key']}"
			f"?X-Amz-Signature=fake&X-Amz-Expires={ExpiresIn}"
		)

	def get_object(self, Bucket=None, Key=None):  # noqa: N803
		stored = self.objects.get(Key)
		if not stored:
			raise FakeClientError("NoSuchKey")
		return {"Body": FakeBody(stored["Body"]), "ContentType": stored.get("ContentType")}


class StoreTestCase(UnitTestCase):
	"""Configures a bucket for the test and hands every call the same fake client."""

	env = {image_store.BUCKET_VAR: BUCKET, image_store.REGION_VAR: REGION}

	def setUp(self):
		self.s3 = FakeS3()
		patches = [
			patch.dict(os.environ, self.env, clear=False),
			patch.object(image_store, "client", lambda: self.s3),
			# botocore is the only thing that raises the real ClientError; the
			# retry loop has to match the stub's instead.
			patch(
				"botocore.exceptions.ClientError",
				FakeClientError,
			),
		]
		for p in patches:
			p.start()
			self.addCleanup(p.stop)
		# site_config must not answer for these while the environment is what is
		# under test (setting() falls through to it), and must be as it was after.
		for var in (image_store.PREFIX_VAR, image_store.ACL_VAR, image_store.PUBLIC_BASE_VAR):
			_unset_conf(self, var)


class NoBucketTestCase(UnitTestCase):
	"""A bench that has not configured S3 at all — the pre-S3 behaviour."""

	def setUp(self):
		p = patch.dict(os.environ, {}, clear=False)
		p.start()
		self.addCleanup(p.stop)
		os.environ.pop(image_store.BUCKET_VAR, None)
		_unset_conf(self, image_store.BUCKET_VAR)


class TestEnablement(NoBucketTestCase):
	def test_no_bucket_means_local_storage(self):
		self.assertFalse(image_store.enabled())
		self.assertIsNone(image_store.upload("x.png", PNG, "image/png"))

	def test_bucket_from_site_config_when_env_is_unset(self):
		"""A bench that configures the app with `bench set-config` works too."""
		_set_conf(self, image_store.BUCKET_VAR, BUCKET)
		self.assertEqual(image_store.bucket(), BUCKET)
		self.assertTrue(image_store.enabled())

	def test_environment_wins_over_site_config(self):
		_set_conf(self, image_store.REGION_VAR, "us-east-1")
		os.environ[image_store.REGION_VAR] = REGION
		self.assertEqual(image_store.region(), REGION)

	def test_region_defaults_to_the_documented_one(self):
		os.environ.pop(image_store.REGION_VAR, None)
		_unset_conf(self, image_store.REGION_VAR)
		self.assertEqual(image_store.region(), image_store.DEFAULT_REGION)


class TestCredentials(UnitTestCase):
	"""Credentials are optional, and read the same way from either place — because a
	bench's web process and its background worker do not see the same environment,
	and an upload that works in the console but not in a job is the failure mode
	this exists to remove."""

	def setUp(self):
		p = patch.dict(os.environ, {image_store.BUCKET_VAR: BUCKET}, clear=False)
		p.start()
		self.addCleanup(p.stop)
		for var in (image_store.ACCESS_KEY_VAR, image_store.SECRET_KEY_VAR, image_store.SESSION_TOKEN_VAR):
			os.environ.pop(var, None)
			_unset_conf(self, var)
		image_store._clients.clear()
		self.addCleanup(image_store._clients.clear)

	def test_nothing_configured_leaves_it_to_boto3(self):
		"""An instance role or a profile must not be overridden by empty values."""
		self.assertEqual(image_store.credentials(), {})

	def test_site_config_credentials_are_passed_to_the_client(self):
		_set_conf(self, image_store.ACCESS_KEY_VAR, "AKIAEXAMPLE")
		_set_conf(self, image_store.SECRET_KEY_VAR, "s3cr3t")
		self.assertEqual(
			image_store.credentials(),
			{"aws_access_key_id": "AKIAEXAMPLE", "aws_secret_access_key": "s3cr3t"},
		)
		with patch("boto3.client") as boto_client:
			image_store.client()
		self.assertEqual(boto_client.call_args.kwargs["aws_access_key_id"], "AKIAEXAMPLE")
		self.assertEqual(boto_client.call_args.kwargs["aws_secret_access_key"], "s3cr3t")

	def test_a_session_token_rides_along(self):
		_set_conf(self, image_store.ACCESS_KEY_VAR, "AKIAEXAMPLE")
		_set_conf(self, image_store.SECRET_KEY_VAR, "s3cr3t")
		_set_conf(self, image_store.SESSION_TOKEN_VAR, "tok")
		self.assertEqual(image_store.credentials()["aws_session_token"], "tok")

	def test_half_a_credential_is_no_credential(self):
		"""A key id with no secret would otherwise sign nothing and read as a
		permissions problem."""
		_set_conf(self, image_store.ACCESS_KEY_VAR, "AKIAEXAMPLE")
		self.assertEqual(image_store.credentials(), {})

	def test_rotating_the_key_does_not_reuse_the_old_client(self):
		_set_conf(self, image_store.ACCESS_KEY_VAR, "AKIAOLD")
		_set_conf(self, image_store.SECRET_KEY_VAR, "old")
		with patch("boto3.client") as boto_client:
			image_store.client()
			frappe.conf[image_store.ACCESS_KEY_VAR.lower()] = "AKIANEW"
			image_store.client()
		self.assertEqual(boto_client.call_count, 2)
		self.assertEqual(boto_client.call_args.kwargs["aws_access_key_id"], "AKIANEW")


class TestKeys(StoreTestCase):
	def test_role_decides_the_prefix(self):
		"""The white-background main image and a translated gallery photo are filed
		apart, because that is what a reviewer and a lifecycle rule both ask for."""
		self.assertTrue(
			image_store.key_for("listing-main-abcd1234.jpg", image_store.GENERATED).startswith(
				"images/generated/"
			)
		)
		self.assertTrue(
			image_store.key_for("listing-gallery-abcd1234.jpg", image_store.TRANSLATED).startswith(
				"images/translated/"
			)
		)

	def test_key_keeps_the_filename_and_extension(self):
		key = image_store.key_for("listing-main-abcd1234.jpg", image_store.GENERATED)
		self.assertIn("listing-main-abcd1234", key)
		self.assertTrue(key.endswith(".jpg"))

	def test_key_carries_a_timestamp_so_the_same_name_cannot_collide(self):
		with patch.object(image_store, "_stamp", side_effect=["20260811120000001", "20260811120000002"]):
			first = image_store.key_for("same.jpg", image_store.GENERATED)
			second = image_store.key_for("same.jpg", image_store.GENERATED)
		self.assertNotEqual(first, second)
		self.assertEqual(first, "images/generated/2026/08/same-20260811120000001.jpg")

	def test_unknown_category_is_filed_as_generated_rather_than_loose(self):
		self.assertTrue(image_store.key_for("x.jpg", None).startswith("images/generated/"))

	def test_prefix_is_configurable(self):
		with patch.dict(os.environ, {image_store.PREFIX_VAR: "amazon/pics/"}, clear=False):
			self.assertTrue(image_store.key_for("x.jpg", image_store.TRANSLATED).startswith("amazon/pics/translated/"))


class TestUpload(StoreTestCase):
	def test_upload_sends_content_type_acl_and_metadata(self):
		url = image_store.upload(
			"listing-main-abcd1234.png",
			PNG,
			"image/png",
			category=image_store.GENERATED,
			metadata={"sku": "SKU-1", "role": "main"},
		)
		self.assertEqual(len(self.s3.puts), 1)
		put = self.s3.puts[0]
		self.assertEqual(put["Bucket"], BUCKET)
		self.assertEqual(put["Body"], PNG)
		self.assertEqual(put["ContentType"], "image/png")
		self.assertEqual(put["ACL"], "private")
		self.assertEqual(put["Metadata"]["sku"], "SKU-1")
		self.assertEqual(put["Metadata"]["role"], "main")
		self.assertEqual(put["Metadata"]["original-filename"], "listing-main-abcd1234.png")
		self.assertEqual(url, f"https://{BUCKET}.s3.{REGION}.amazonaws.com/{put['Key']}")

	def test_non_ascii_metadata_is_dropped_not_fatal(self):
		"""S3 returns metadata as headers, so a Chinese supplier filename in there
		would fail the upload rather than the value."""
		image_store.upload("x.png", PNG, "image/png", metadata={"source-url": "https://cdn/毛巾.jpg"})
		self.assertNotIn("source-url", self.s3.puts[0]["Metadata"])

	def test_transient_failure_is_retried(self):
		self.s3 = FakeS3(fail_code="SlowDown", fail_times=2)
		url = image_store.upload("x.png", PNG, "image/png")
		self.assertEqual(len(self.s3.puts), 3)
		self.assertTrue(url)

	def test_upload_gives_up_after_max_attempts_and_returns_none(self):
		self.s3 = FakeS3(fail_code="SlowDown", fail_times=99)
		with patch.dict(os.environ, {image_store.ATTEMPTS_VAR: "2"}, clear=False):
			with patch.object(frappe, "log_error") as logged:
				self.assertIsNone(image_store.upload("x.png", PNG, "image/png"))
		self.assertEqual(len(self.s3.puts), 2)
		self.assertTrue(logged.called, "a bench silently losing images is the failure to avoid")

	def test_a_permanent_error_is_not_retried(self):
		self.s3 = FakeS3(fail_code="AccessDenied", fail_times=99)
		with patch.object(frappe, "log_error"):
			self.assertIsNone(image_store.upload("x.png", PNG, "image/png"))
		self.assertEqual(len(self.s3.puts), 1)

	def test_bucket_that_enforces_ownership_takes_the_object_without_an_acl(self):
		self.s3 = FakeS3(fail_code="AccessControlListNotSupported", fail_times=1)
		url = image_store.upload("x.png", PNG, "image/png")
		self.assertTrue(url)
		self.assertEqual(len(self.s3.puts), 2)
		self.assertIn("ACL", self.s3.puts[0])
		self.assertNotIn("ACL", self.s3.puts[1])

	def test_acl_can_be_switched_off(self):
		"""`none`, not an empty string: an unset variable already reads as empty, so
		empty cannot mean "deliberately no ACL"."""
		with patch.dict(os.environ, {image_store.ACL_VAR: image_store.NO_ACL}, clear=False):
			image_store.upload("x.png", PNG, "image/png")
		self.assertNotIn("ACL", self.s3.puts[0])

	def test_an_empty_acl_setting_still_means_private(self):
		with patch.dict(os.environ, {image_store.ACL_VAR: ""}, clear=False):
			image_store.upload("x.png", PNG, "image/png")
		self.assertEqual(self.s3.puts[0]["ACL"], "private")


class TestRetrieval(StoreTestCase):
	def setUp(self):
		super().setUp()
		self.url = image_store.upload("listing-main-abcd1234.png", PNG, "image/png")

	def test_a_stored_url_is_recognised_and_maps_back_to_its_key(self):
		self.assertTrue(image_store.is_stored_url(self.url))
		self.assertEqual(image_store.key_from_url(self.url), self.s3.puts[0]["Key"])

	def test_someone_elses_url_is_not_ours(self):
		for url in ("https://cdn.supplier.com/a.jpg", "/files/a.jpg", f"https://other.s3.{REGION}.amazonaws.com/a.jpg"):
			self.assertFalse(image_store.is_stored_url(url), url)
			self.assertIsNone(image_store.key_from_url(url), url)

	def test_presigned_url_signs_our_object_for_the_configured_window(self):
		with patch.dict(os.environ, {image_store.EXPIRY_VAR: "600"}, clear=False):
			signed = image_store.presigned_url(self.url)
		self.assertEqual(self.s3.presigned[0][1], {"Bucket": BUCKET, "Key": self.s3.puts[0]["Key"]})
		self.assertEqual(self.s3.presigned[0][2], 600)
		self.assertNotEqual(signed, self.url)

	def test_an_already_signed_url_resolves_to_the_same_key(self):
		"""Signing is idempotent in the only way that matters: the signature must not
		become part of the key."""
		signed = image_store.presigned_url(self.url)
		self.assertEqual(image_store.key_from_url(signed), self.s3.puts[0]["Key"])

	def test_presigned_url_leaves_a_foreign_url_alone(self):
		"""So one call site can hand any image url to it — that is the whole point."""
		self.assertEqual(image_store.presigned_url("https://cdn.supplier.com/a.jpg"), "https://cdn.supplier.com/a.jpg")
		self.assertFalse(self.s3.presigned)

	def test_a_failed_presign_returns_the_stored_url_rather_than_raising(self):
		with patch.object(self.s3, "generate_presigned_url", side_effect=FakeClientError("AccessDenied")):
			with patch.object(frappe, "log_error"):
				self.assertEqual(image_store.presigned_url(self.url), self.url)

	def test_read_returns_the_objects_bytes(self):
		self.assertEqual(image_store.read(self.url), (PNG, "image/png"))

	def test_read_declines_a_url_that_is_not_ours(self):
		self.assertIsNone(image_store.read("https://cdn.supplier.com/a.jpg"))


class TestCdnBase(StoreTestCase):
	"""With a CDN in front of the bucket the urls are already public, so nothing is
	signed and nothing expires — which is what the connector handing Amazon an image
	url needs."""

	env = dict(StoreTestCase.env, IMAGE_S3_PUBLIC_BASE_URL="https://cdn.example.com/img")

	def test_stored_url_is_the_cdn_url(self):
		url = image_store.upload("x.png", PNG, "image/png", category=image_store.TRANSLATED)
		self.assertEqual(url, f"https://cdn.example.com/img/{self.s3.puts[0]['Key']}")
		self.assertTrue(image_store.is_stored_url(url))

	def test_a_cdn_url_is_never_signed(self):
		url = image_store.upload("x.png", PNG, "image/png")
		self.assertEqual(image_store.presigned_url(url), url)
		self.assertFalse(self.s3.presigned)

	def test_bytes_still_come_from_the_bucket(self):
		url = image_store.upload("x.png", PNG, "image/png")
		self.assertEqual(image_store.read(url), (PNG, "image/png"))


class TestSave(StoreTestCase):
	"""What the image pipelines call. They must not know which backend answered."""

	def test_save_stores_in_s3_and_returns_the_object_url(self):
		with patch("frappe.utils.file_manager.save_file") as save_file:
			url = image_store.save(
				"listing-main-abcd.png", PNG, "image/png", category=image_store.GENERATED, metadata={"sku": "SKU-1"}
			)
		self.assertFalse(save_file.called, "a configured bucket must not also write local disk")
		self.assertEqual(url, image_store.object_url(self.s3.puts[0]["Key"]))
		self.assertTrue(self.s3.puts[0]["Key"].startswith("images/generated/"))

	def test_a_refused_upload_falls_back_to_a_local_file(self):
		"""The pixels cost real money; keeping them locally beats losing them."""
		self.s3 = FakeS3(fail_code="AccessDenied", fail_times=99)
		with patch("frappe.utils.file_manager.save_file") as save_file:
			save_file.return_value = frappe._dict(file_url="/files/listing-main-abcd.png")
			with patch.object(frappe, "log_error"):
				url = image_store.save("listing-main-abcd.png", PNG, "image/png")
		self.assertEqual(url, "/files/listing-main-abcd.png")


class TestFetchableUrl(StoreTestCase):
	def test_our_object_is_signed(self):
		stored = image_store.upload("x.png", PNG, "image/png")
		self.assertIn("X-Amz-Signature", image_store.fetchable_url(stored))

	def test_a_supplier_photo_passes_through(self):
		self.assertEqual(image_store.fetchable_url("https://cdn.supplier.com/a.jpg"), "https://cdn.supplier.com/a.jpg")
		self.assertFalse(self.s3.puts)

	def test_a_local_file_is_moved_to_the_bucket_once_and_signed(self):
		with patch.object(image_store, "_local_bytes", return_value=(PNG, "image/png")) as local:
			first = image_store.fetchable_url("/files/listing-main-abcd.png")
			second = image_store.fetchable_url("/files/listing-main-abcd.png")
		self.assertEqual(len(self.s3.puts), 1, "the same File is uploaded once")
		self.assertEqual(local.call_count, 1)
		key = self.s3.puts[0]["Key"]
		self.assertTrue(key.startswith("images/promoted/listing-main-abcd-"))
		self.assertEqual(self.s3.puts[0]["Metadata"]["promoted-from"], "/files/listing-main-abcd.png")
		self.assertEqual(image_store.key_from_url(first), key)
		self.assertEqual(image_store.key_from_url(second), key)

	def test_a_local_file_that_cannot_be_read_falls_back_to_the_site_url(self):
		with patch.object(image_store, "_local_bytes", side_effect=frappe.DoesNotExistError), \
				patch.object(frappe, "log_error"), \
				patch("frappe.utils.get_url", side_effect=lambda uri: f"https://site.example{uri}"):
			self.assertEqual(image_store.fetchable_url("/files/gone.png"), "https://site.example/files/gone.png")


class TestViewableUrl(StoreTestCase):
	def test_our_object_is_signed_for_the_browser(self):
		stored = image_store.upload("x.png", PNG, "image/png")
		self.assertIn("X-Amz-Signature", image_store.viewable_url(stored))

	def test_a_local_file_is_shown_from_the_site_and_never_uploaded(self):
		self.assertEqual(image_store.viewable_url("/files/x.png"), "/files/x.png")
		self.assertFalse(self.s3.puts)

	def test_viewable_urls_maps_each_distinct_url_once(self):
		stored = image_store.upload("x.png", PNG, "image/png")
		links = image_store.viewable_urls([stored, stored, "/files/y.png", None])
		self.assertEqual(set(links), {stored, "/files/y.png"})
		self.assertEqual(len(self.s3.presigned), 1)


class TestLocalFallback(NoBucketTestCase):
	def test_without_a_bucket_save_writes_a_file_as_before(self):
		with patch("frappe.utils.file_manager.save_file") as save_file:
			save_file.return_value = frappe._dict(file_url="/files/listing-main-abcd.png")
			url = image_store.save("listing-main-abcd.png", PNG, "image/png")
		self.assertEqual(url, "/files/listing-main-abcd.png")
		self.assertTrue(save_file.called)

	def test_without_a_bucket_nothing_is_treated_as_stored(self):
		url = f"https://{BUCKET}.s3.{REGION}.amazonaws.com/images/generated/x.png"
		self.assertFalse(image_store.is_stored_url(url))
		self.assertEqual(image_store.fetchable_url(url), url)

	def test_without_a_bucket_a_local_file_is_expanded_against_the_site(self):
		with patch("frappe.utils.get_url", side_effect=lambda uri: f"https://site.example{uri}"):
			self.assertEqual(image_store.fetchable_url("/files/x.png"), "https://site.example/files/x.png")


if __name__ == "__main__":
	unittest.main()
