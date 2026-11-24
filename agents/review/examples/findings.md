# Worked findings

Three findings of increasing subtlety, and one that should never have been written.

## P1 — a real defect on a reachable path

```json
{
  "title": "[P1] Reset the retry counter before the reconnect loop",
  "body": "`attempt` is declared outside the `for` loop, so a second reconnect starts at the exhausted value and the loop body never runs again. Any caller that reconnects twice — the normal path after a dropped socket — stays disconnected. Reset it inside the loop.",
  "confidence_score": 0.85,
  "priority": 1,
  "code_location": { "absolute_file_path": "E:\\app\\src\\socket.js", "line_range": { "start": 88, "end": 90 } }
}
```

Why it works: names the mechanism, names the path that reaches it ("reconnects twice"), states the consequence, and the range is three lines.

## P2 — a maintainability cost with a mechanism

```json
{
  "title": "[P2] Share the timeout constant with the client",
  "body": "`30_000` is now written in both `server/limits.js` and `client/fetch.js`. The server reads the client's timeout to size its own deadline, so changing one without the other silently halves the usable window. Export the constant and import it in both places.",
  "confidence_score": 0.7,
  "priority": 2,
  "code_location": { "absolute_file_path": "E:\\app\\client\\fetch.js", "line_range": { "start": 12, "end": 12 } }
}
```

Why it works: "will drift" is a real cost only when you can say what breaks when it drifts. Here it does.

## P0 — reserved for the unarguable

```json
{
  "title": "[P0] Do not log the full request headers on auth failure",
  "body": "The new error path logs `req.headers`, which includes `authorization`. Every failed login writes a bearer token to the application log, where it outlives the session it belongs to. Log the header names, or redact `authorization` before logging.",
  "confidence_score": 0.95,
  "priority": 0,
  "code_location": { "absolute_file_path": "E:\\app\\src\\auth.js", "line_range": { "start": 57, "end": 58 } }
}
```

## Not a finding

> `[P3] This function is 60 lines long and could be split up.`

No consequence, no path, no rule the project states. It is a preference. Delete it — and note that writing it costs the author the trust they need for the P1 above.
