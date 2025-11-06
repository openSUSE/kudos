// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import dotenv from "dotenv";
import EventSource from "eventsource";
import { MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk";

const envPath = ".env.matrix";
if (!fs.existsSync(envPath)) {
  console.error(`💥 Missing ${envPath}. Please create it before starting the bot.`);
  console.error("Example variables:\n  MATRIX_HOMESERVER=https://matrix-client.matrix.org\n  MATRIX_ACCESS_TOKEN=...\n  MATRIX_ROOM_ID=!roomid:matrix.org\n  STREAM_URL=https://api.kudos.opensuse.org/api/now/stream\n");
  process.exit(1);
}

dotenv.config({ path: envPath });

// ===============================================================
// Configuration
// ===============================================================
const { MATRIX_HOMESERVER, MATRIX_ACCESS_TOKEN, MATRIX_ROOM_ID, STREAM_URL } =
  process.env;

if (!MATRIX_HOMESERVER || !MATRIX_ACCESS_TOKEN || !MATRIX_ROOM_ID || !STREAM_URL) {
  console.error("💥 Missing required environment variables in .env.matrix");
  console.error("Expected: MATRIX_HOMESERVER, MATRIX_ACCESS_TOKEN, MATRIX_ROOM_ID, STREAM_URL");
  process.exit(1);
}

console.log(`🤖 Connecting to Matrix @ ${MATRIX_HOMESERVER}`);
console.log(`💬 Room: ${MATRIX_ROOM_ID}`);
console.log(`🌈 Stream: ${STREAM_URL}`);

// ===============================================================
// Matrix client
// ===============================================================
const storage = new SimpleFsStorageProvider("matrix-bot.json");
const client = new MatrixClient(MATRIX_HOMESERVER, MATRIX_ACCESS_TOKEN, storage);

// Helper: send messages safely
async function postToMatrix(message) {
  try {
    await client.sendMessage(MATRIX_ROOM_ID, { msgtype: "m.text", body: message });
    console.log("✅ Sent to Matrix:", message);
  } catch (err) {
    console.error("💥 Failed to send to Matrix:", err);
  }
}

// ===============================================================
// SSE listener (live event stream)
// ===============================================================
const source = new EventSource(STREAM_URL);

source.addEventListener("info", (e) => {
  const { message } = JSON.parse(e.data);
  console.log(`ℹ️ ${message}`);
});

// Kudos events
source.addEventListener("kudos", async (e) => {
  const d = JSON.parse(e.data);

  const msg = `💚 ${d.from} sent Geeko Kudos to ${d.to} — ${d.category}
> ${d.message}

🔗 ${d.permalink}
🎉 *Congrats!* 👏`;

  await postToMatrix(msg);
});

// Badge events
source.addEventListener("badge", async (e) => {
  const d = JSON.parse(e.data);

  const msg = `🏅 ${d.username} earned the **${d.badgeTitle}** badge!
${d.badgeDescription}

🔗 ${d.permalink}
🎉 *Congrats!* 👏`;

  await postToMatrix(msg);
});

source.onerror = (err) => {
  console.error("💥 Stream error:", err);
};
