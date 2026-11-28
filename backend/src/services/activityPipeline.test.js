import assert from "node:assert/strict";
import test from "node:test";
import { eventBus } from "../routes/now.js";
import { setupActivityPipeline } from "./activityPipeline.js";

async function emitKudos(payload, recipients) {
  const created = [];
  const users = [
    { id: 7, username: "BobSmith" },
    { id: 8, username: "AliceSmith" },
  ];
  let resolveCreated;
  const createdNotifications = new Promise((resolve) => { resolveCreated = resolve; });
  const prisma = {
    user: {
      findMany: async (args) => {
        assert.deepEqual(args.where, { username: { in: recipients } });
        return users.filter((user) => recipients.includes(user.username));
      },
    },
    notification: {
      create: async ({ data }) => {
        created.push(data);
        if (created.length === recipients.length) resolveCreated();
        return data;
      },
    },
  };

  const stop = setupActivityPipeline(prisma);
  let timeout;
  try {
    eventBus.emit("activity", { type: "kudos", payload });
    await Promise.race([
      createdNotifications,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("notification event timed out")), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    stop();
  }
  return created;
}

test("single-recipient Kudos event arrays create a recipient notification", async () => {
  const created = await emitKudos({ from: "AliceSmith", to: ["BobSmith"], permalink: "http://localhost:3000/kudo/one" }, ["BobSmith"]);

  assert.deepEqual(created, [{
    userId: 7,
    message: "💚 You received kudos from AliceSmith!",
    type: "kudos",
    link: "/kudo/one",
  }]);
});

test("group Kudos events create one notification for each recipient", async () => {
  const created = await emitKudos({
    from: "AliceSmith",
    to: ["BobSmith", "AliceSmith"],
    permalink: "/kudo/group",
  }, ["BobSmith", "AliceSmith"]);

  assert.deepEqual(created.map(({ userId }) => userId), [7, 8]);
  assert.ok(created.every(({ type, link }) => type === "kudos" && link === "/kudo/group"));
});
