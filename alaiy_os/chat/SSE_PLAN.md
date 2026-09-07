# Ask Alaiy: replacing polling with push

## Current state

Both UI surfaces poll. Nobody streams over HTTP today.

- **Desk** (`alaiy_os/alaiy_os/page/ask_alaiy/ask_alaiy.js`): `_schedule_poll()` /
  `_poll()` call `alaiy_os.api.chat.get_messages` on a `setTimeout` loop —
  1000ms normally, 400ms (`POLL_INTERVAL_STREAM_MS`) while a message is
  `partial`.
- **Custom UI** (`interface/src/hooks/use-ask-alaiy.ts`, and the Desk-embedded
  copy at `interface/desk-widget/src/askAlaiy/useAskAlaiy.ts`): identical
  shape, `poll()` / `setTimeout`, 1500ms / 400ms (`POLL_MS` / `POLL_STREAM_MS`).
- **Backend** (`alaiy_os/api/chat.py`): `send_message` enqueues a background
  job (`chat/runner.py::run_turn`) and returns immediately. `get_messages` is
  a plain whitelisted snapshot read (`after` cursor, `partial=1` to include
  the in-progress row). The turn runs in a worker process, separate from any
  web request. Token-level output only exists as increasingly-complete writes
  to an `OS Chat Message` row, flushed by `_streaming_step()` in
  `chat/runner.py` every `STREAM_FLUSH_CHARS = 200` chars or
  `STREAM_FLUSH_SECONDS = 0.4`s.

[`CHAT.md`](./CHAT.md)'s existing Streaming section states the constraint that
motivated this design:

> A turn runs in a worker, in a different process from any web request, so at
> the moment tokens are produced there is no response left open to push them
> down. There cannot be one.

That's true for the naive version of "hold a response open in the same
process that's running the turn" — but Frappe already runs a separate,
always-on process for exactly this kind of push (`bench socketio`), which
sidesteps the constraint entirely. Both a literal SSE endpoint and Frappe's
own realtime channel are laid out below; **the recommendation is the
realtime channel**, for reasons that come down to how this bench is actually
served in production.

## Why the production server matters

- **Dev**: `bench serve` → `frappe.app.serve()` → werkzeug's `run_simple(...,
  threaded=True)`. One thread per connection. A held-open SSE response costs
  nothing here.
- **Production**: stock `bench setup production` → gunicorn, **default sync
  workers** (`benches/solist/sites/common_site_config.json` has
  `gunicorn_workers: 33`; nothing in this repo overrides `worker_class`). A
  sync worker handles exactly one request at a time, start to finish.

Frappe opens a DB connection per request in `init_request()` and only tears
it down in `frappe.destroy()`, which — per `after_response_wrapper` in
`frappe/app.py` — doesn't fire until the response's WSGI iterator is fully
exhausted. For a streaming generator, that's the entire duration of the SSE
connection.

So a literal SSE endpoint, on this production setup, would pin **one gunicorn
worker and one DB connection per open chat stream** for as long as that turn
takes (tool calls included — could be tens of seconds). With 33 workers, ~33
concurrent chats and the site stops serving anything else, including plain
page loads. Fixing this properly means moving to an async/greenlet worker
class (`gevent`/`eventlet`) for the web process, plus disabling response
buffering at the nginx layer (`proxy_buffering off`, `X-Accel-Buffering: no`)
— a real infrastructure change, not just an app-code one.

## Option A — Literal SSE

Achievable. Frappe has no built-in SSE response type, but a whitelisted
method can return a raw `werkzeug.wrappers.Response` and it bypasses
`frappe.response`/`build_response()` entirely — both `frappe/handler.py`
(`/api/method/*`) and `frappe/api/__init__.py` (`/api/v2/*`) short-circuit
with `if isinstance(data, Response): return data`.

```python
# alaiy_os/api/chat.py
import json
from werkzeug.wrappers import Response

@frappe.whitelist()
def stream_messages(session: str, after: int = 0):
    frappe.response["type"] = "page"  # prevent the default json wrapper from ever touching this

    def gen():
        last_seq = int(after)
        while True:
            rows = _fetch_new_messages(session, after=last_seq)  # same query get_messages already uses
            for row in rows:
                last_seq = max(last_seq, row.seq)
                yield f"id: {row.seq}\ndata: {json.dumps(row)}\n\n"
            status = _turn_status(session)
            if status != "Running":
                yield f"event: done\ndata: {json.dumps({'status': status})}\n\n"
                return
            time.sleep(0.4)  # same cadence as today's STREAM_FLUSH_SECONDS

    return Response(gen(), mimetype="text/event-stream", direct_passthrough=True)
```

Client side (any of the three surfaces), the polling `setTimeout` loop is
replaced by an `EventSource` (or a `fetch` + manual `ReadableStream` read, if
custom headers are ever needed — `EventSource` can't send them, but Frappe
auth here is cookie-based so that's not a blocker):

```ts
const es = new EventSource(`/api/method/alaiy_os.api.chat.stream_messages?session=${session}&after=${lastSeq.current}`);
es.onmessage = (e) => absorbMessage(JSON.parse(e.data));
es.addEventListener("done", () => { setRunning(false); es.close(); });
es.onerror = () => { /* fall back to one get_messages catch-up call, then retry */ };
```

`Last-Event-ID` (sent automatically by `EventSource` on reconnect) maps
directly onto the existing `after` cursor — reconnect support is close to
free.

**What this requires before it's safe to ship:**
1. Switch the production gunicorn worker class to `gevent` (or run a
   dedicated small pool of async workers just for this endpoint, proxied
   separately — more work, less blast radius).
2. `proxy_buffering off` and `X-Accel-Buffering: no` on the nginx location
   block bench's production setup writes to.
3. A hard cap on stream lifetime (e.g. close and let the client reconnect
   after N minutes) so a stuck worker can't hold a connection forever.
4. Capacity planning: each concurrent open chat now holds a worker + a DB
   connection for the life of the turn, not just for a ~50ms poll request.

## Option B — Frappe Realtime (Socket.IO) — recommended

Frappe already runs a separate, persistent Node process for exactly this —
`bench socketio` (present in both `benches/solist/Procfile` and
`benches/commerce/Procfile`). Publishing from a worker is a **Redis
`PUBLISH`**, not a held-open HTTP response:

- `frappe.publish_realtime(event, message, user=..., after_commit=False)` →
  `emit_via_redis()` (`frappe/realtime.py`) → one Redis `PUBLISH` on the
  `events` channel.
- The `socketio` process subscribes to that channel and re-emits to
  connected browsers over Socket.IO — entirely outside the gunicorn worker
  pool. Publishing from `chat/runner.py` (already running as a `long`-queue
  worker job) costs nothing web-tier-wise: no new HTTP connection, no extra
  DB connection held, no gunicorn worker pinned.

This gets everything Option A gets — no more fixed-interval re-fetching,
near-real-time token deltas — without touching the production server model
at all. `CHAT.md`'s "no response left open to push them down" is correct and
irrelevant here: nothing needs to stay open, because the worker and the
transport are decoupled by Redis.

### Backend changes

`chat/runner.py`, inside `_streaming_step()`'s `on_text` closure (currently
~line 386-399, where it decides whether to flush to the DB):

```python
def on_text(chunk: str) -> None:
    nonlocal buffer, grown, last
    buffer += chunk
    grown += len(chunk)
    frappe.publish_realtime(
        "os_chat_delta",
        {"session": session, "seq": msg_seq, "text": buffer, "partial": True},
        user=frappe.session.user,
    )
    if grown >= STREAM_FLUSH_CHARS or time.monotonic() - last >= STREAM_FLUSH_SECONDS:
        frappe.db.set_value("OS Chat Message", msg_name, "text", buffer, update_modified=False)
        frappe.db.commit()
        grown, last = 0, time.monotonic()
```

The realtime emit can run on *every* chunk — a Redis publish is cheap enough
that it doesn't need the same throttle that protects the DB from being
hammered with commits. That alone makes the perceived typing smoother than
today's 400ms floor, independent of anything client-side.

Two more emit points, both already natural boundaries in the code:
- End of `_streaming_step()` (~line 416-430), where the authoritative
  `text`/`blocks` get written and `is_partial` is cleared: emit
  `os_chat_message_done` with the final row.
- `_settle_partials()` (~line 433-446), the crash-cleanup path called from
  `run_turn`'s `except` block: emit `os_chat_turn_aborted` so a client that's
  listening doesn't hang forever if the worker dies mid-stream — there's no
  natural "done" event otherwise.

`api/chat.py`'s `send_message`/`get_messages` stay exactly as they are.
`get_messages` remains useful as the "catch-up" call a client makes once on
mount (or after a socket reconnect) before switching to live deltas — see
Hybrid model below.

### Frontend changes

All three surfaces have the same seam: the `setTimeout` self-reschedule loop
is the only thing that needs to change. The upsert/render logic
(`absorbMessage` in the hooks, `_absorb`/`_draw`/`_reveal` in the desk page)
already keys by message name and tolerates out-of-order/duplicate delivery —
that doesn't need to change for either option.

**Desk** (`ask_alaiy.js`) already runs inside an authenticated Desk session
with `frappe.realtime` available globally:

```js
// replace _schedule_poll()/_poll() with:
frappe.realtime.on("os_chat_delta", (data) => {
  if (data.session !== this.session) return;
  this._absorb([data]);
});
frappe.realtime.on("os_chat_message_done", (data) => {
  if (data.session !== this.session) return;
  this._absorb([data]);
});
frappe.realtime.on("os_chat_turn_aborted", (data) => {
  if (data.session !== this.session) return;
  this._set_running(false);
});
```

**Next.js custom UI** (`use-ask-alaiy.ts`) doesn't have `frappe.realtime`
loaded — it needs `socket.io-client` pointed at the bench's socketio port
(same one already used for any other realtime feature in `interface/`, or
newly wired if there isn't one yet), joining the user's room the same way
Desk's `frappe.realtime` does under the hood. Swap the `poll()` /
`pollTimer` logic for socket listeners the same shape as above, calling the
existing `absorbMessage`.

**Desk widget** (`interface/desk-widget/src/askAlaiy/useAskAlaiy.ts`) is
already injected into an authenticated Desk page, so it can use the same
`frappe.realtime.on(...)` approach as the Desk page itself rather than a raw
socket.io client.

### Hybrid model (recommended shape either way)

Keep `get_messages` as a one-shot "catch-up" call:
1. On mount / session open: call `get_messages` once to load history and the
   current `after` cursor.
2. Subscribe to the realtime events for anything from that cursor forward.
3. On socket disconnect/reconnect (socket.io-client reconnects
   automatically, but events published while disconnected are lost — Redis
   pub/sub has no replay): call `get_messages(after=lastSeq)` once on
   reconnect to fill the gap, then resume listening.

This removes the interval-based re-fetching entirely while keeping
`get_messages` as the correctness backstop it already is — no new failure
mode where a dropped socket message silently loses part of a response.

## Recommendation

Ship Option B. It gets the actual goal — no more fixed-interval re-fetching,
smoother token-level updates — without a production infrastructure change
(gunicorn worker class, nginx buffering, new capacity math). It reuses a
process (`bench socketio`) that's already running in every bench today. Only
reach for Option A if there's a reason to avoid Socket.IO specifically (e.g.
a non-Frappe consumer of the same endpoint) — in which case treat the
"before it's safe to ship" list above as required, not optional.

## Migration steps

1. Add the three `publish_realtime` emit points in `chat/runner.py`
   (`on_text`, end of `_streaming_step`, `_settle_partials`). No schema or
   API signature changes.
2. Swap Desk's `_schedule_poll`/`_poll` for `frappe.realtime.on(...)`
   listeners. Keep `_absorb`/`_draw`/`_reveal` untouched.
3. Wire a socket.io client into the Next.js `interface/` app (or confirm one
   already exists) and swap `use-ask-alaiy.ts`'s poll loop for listeners.
4. Swap the desk-widget's `useAskAlaiy.ts` the same way as (2), using
   `frappe.realtime` since it's Desk-embedded.
5. Add the catch-up-on-mount / catch-up-on-reconnect calls to `get_messages`
   described above, in all three surfaces.
6. Feature-flag the switch per-surface so Desk, custom UI, and the desk
   widget can roll over independently and fall back to the existing poll
   loop if realtime turns out to be unreliable in some deployment.
7. Once all three are confirmed stable, remove the poll loops (or leave them
   disabled-by-default as a documented fallback — cheap insurance).
8. Update `CHAT.md`'s Streaming section — its "there cannot be
   [a second channel]" claim is specifically about holding a response open
   in the worker process; note that realtime sidesteps that by decoupling
   the worker from the transport via Redis.

## Open questions worth resolving before implementation

- Does `interface/` already have any socket.io wiring for other realtime
  features (notifications, presence, etc.)? If yes, reuse that client
  rather than adding a second one.
- Multi-tab behavior: does the same user open the same session in two tabs?
  If so, both should receive the same realtime events (room is per-user, not
  per-tab) — need to confirm `absorbMessage`'s upsert-by-name logic handles
  a message arriving twice across tabs correctly (it should, but worth a
  test).
- Confirm `frappe.publish_realtime`'s default room (`get_user_room(user)`)
  doesn't leak a user's chat deltas to anyone else with realtime access to
  the same site (e.g. System Manager monitoring tools) — scope the event
  name/payload accordingly if that's a concern.
