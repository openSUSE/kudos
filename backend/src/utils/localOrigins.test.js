import assert from "node:assert/strict";
import test from "node:test";
import { expandEnvironment, normalizeLocalUrl } from "./localOrigins.js";

test("local HTTPS uses HTTP when development certificates are missing", () => {
  assert.equal(normalizeLocalUrl("https://localhost:3000", { hasCertificates: false }), "http://localhost:3000/");
  assert.equal(normalizeLocalUrl("https://127.0.0.1:5173", { hasCertificates: false }), "http://127.0.0.1:5173/");
});

test("HTTPS remains enabled for certificate-backed and non-local origins", () => {
  assert.equal(normalizeLocalUrl("https://localhost:3000", { hasCertificates: true }), "https://localhost:3000/");
  assert.equal(normalizeLocalUrl("https://example.test:3000", { hasCertificates: false }), "https://example.test:3000/");
});

test("environment placeholders resolve to effective local origins", () => {
  assert.equal(
    expandEnvironment("${BACKEND_ORIGIN}/auth/callback", { BACKEND_ORIGIN: "http://localhost:3000" }),
    "http://localhost:3000/auth/callback",
  );
});
