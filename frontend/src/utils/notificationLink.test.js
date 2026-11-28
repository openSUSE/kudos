import assert from "node:assert/strict";
import test from "node:test";
import { safeNotificationPath } from "./notificationLink.js";

test("accepts in-app paths and keeps query and fragment", () => {
  assert.equal(safeNotificationPath("/teams?team=agama#members"), "/teams?team=agama#members");
});

test("rejects non-path and protocol-relative links", () => {
  assert.equal(safeNotificationPath("https://example.com"), null);
  assert.equal(safeNotificationPath("//example.com/path"), null);
  assert.equal(safeNotificationPath("/\\\\example.com"), null);
  assert.equal(safeNotificationPath("javascript:alert(1)"), null);
});
