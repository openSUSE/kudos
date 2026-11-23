import assert from "node:assert/strict";
import test from "node:test";
import { mountNotificationsRoutes } from "./notifications.js";

function setup({ user = { id: 7 }, notifications = [], updateCount = 1 } = {}) {
  const routes = new Map();
  const calls = [];
  const prisma = {
    notification: {
      findMany: async (args) => { calls.push(["findMany", args]); return notifications; },
      updateMany: async (args) => { calls.push(["updateMany", args]); return { count: updateCount }; },
    },
  };
  mountNotificationsRoutes({
    get: (path, handler) => routes.set("GET " + path, handler),
    patch: (path, handler) => routes.set("PATCH " + path, handler),
  }, prisma);
  async function request(method, path, req = {}) {
    const response = { statusCode: 200, body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      send(body) { this.body = body; return this; },
    };
    await routes.get(method + " " + path)({ currentUser: user, params: {}, ...req }, response);
    return response;
  }
  return { calls, request };
}

test("history is scoped to the current user and ordered newest first", async () => {
  const rows = [{ id: 2 }, { id: 1 }];
  const { calls, request } = setup({ notifications: rows });
  const response = await request("GET", "/api/notifications");
  assert.deepEqual(response.body, rows);
  assert.deepEqual(calls[0], ["findMany", { where: { userId: 7 }, orderBy: { createdAt: "desc" } }]);
  assert.equal(calls.some(([name]) => name === "updateMany"), false);
});

test("unread polling does not mark notifications read", async () => {
  const { calls, request } = setup();
  await request("GET", "/api/notifications/unread");
  assert.deepEqual(calls[0], ["findMany", {
    where: { userId: 7, read: false }, orderBy: { createdAt: "desc" }, take: 10,
  }]);
  assert.equal(calls.some(([name]) => name === "updateMany"), false);
});

test("mark read scopes the update to the current user", async () => {
  const { calls, request } = setup();
  const response = await request("PATCH", "/api/notifications/:id/read", { params: { id: "42" } });
  assert.deepEqual(calls[0], ["updateMany", {
    where: { id: 42, userId: 7, read: false }, data: { read: true },
  }]);
  assert.deepEqual(response.body, { read: true });
});

test("unauthenticated requests are rejected", async () => {
  const { calls, request } = setup({ user: null });
  const response = await request("GET", "/api/notifications");
  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});


test("invalid IDs are rejected without a database update", async () => {
  const { calls, request } = setup();
  const response = await request("PATCH", "/api/notifications/:id/read", { params: { id: "not-an-id" } });
  assert.equal(response.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("unknown notification IDs are reported as not found", async () => {
  const { request } = setup({ updateCount: 0 });
  const response = await request("PATCH", "/api/notifications/:id/read", { params: { id: "42" } });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Notification not found" });
});
