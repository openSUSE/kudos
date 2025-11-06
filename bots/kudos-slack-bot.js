// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import dotenv from "dotenv";
import EventSource from "eventsource";
import { WebClient } from "@slack/web-api";

const envPath = ".env.slack";
if (!fs.existsSync(envPath)) {
  console.error(`💥 Missing ${envPath}. Please create it before starting the bot.`);
  console.error("Example variables:\n  SLACK_BOT_TOKEN=...\n  SLACK_CHANNEL=#test-channel\n  STREAM_URL=https://api.kudos.opensuse.org/api/now/stream\n");
  process.exit(1);
}

dotenv.config({ path: envPath });

// ===============================================================
// 🔧 Configuration
// ===============================================================
const { SLACK_BOT_TOKEN, SLACK_CHANNEL, STREAM_URL } = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL || !STREAM_URL) {
  console.error("💥 Missing required environment variables in .env.slack");
  console.error("Expected: SLACK_BOT_TOKEN, SLACK_CHANNEL, STREAM_URL");
  process.exit(1);
}

const slack = new WebClient(SLACK_BOT_TOKEN);

console.log(`🌈 Connecting to live stream: ${STREAM_URL}`);
console.log(`💬 Posting updates to Slack channel: ${SLACK_CHANNEL}`);

const source = new EventSource(STREAM_URL);

// ===============================================================
// 🧠 Event Handlers
// ===============================================================

source.addEventListener("info", (e) => {
  const data = JSON.parse(e.data);
  console.log(`ℹ️ ${data.message}`);
});

source.addEventListener("kudos", async (e) => {
  const data = JSON.parse(e.data);
  console.log("💚 Kudos event:", data);

  const text = `💚 *${data.from}* sent Geeko Kudos to *${data.to}* — _${data.category}_\n> ${data.message}\n\n🔗 <${data.permalink}|View Kudos>\n🎉 *Congrats!* 👏`;

  try {
    await slack.chat.postMessage({
      channel: SLACK_CHANNEL,
      text,
      icon_emoji: ":lizard:",
      username: "Geeko Kudos",
    });
  } catch (err) {
    console.error("💥 Failed to post kudos to Slack:", err);
  }
});

source.addEventListener("badge", async (e) => {
  const data = JSON.parse(e.data);
  console.log("🏅 Badge event:", data);

  const iconUrl = data.badgePicture?.startsWith("http")
    ? data.badgePicture
    : `${STREAM_URL.replace(/\/api\/now\/stream$/, "")}${data.badgePicture}`;

  const text = `🏅 *${data.username}* earned the *${data.badgeTitle}* badge!\n_${data.badgeDescription}_\n\n🔗 <${data.permalink}|View Badge>\n🎉 *Congrats!* 👏`;

  try {
    await slack.chat.postMessage({
      channel: SLACK_CHANNEL,
      text,
      icon_url: iconUrl,
      username: "openSUSE Badges",
    });
  } catch (err) {
    console.error("💥 Failed to post badge to Slack:", err);
  }
});

source.onerror = (err) => {
  console.error("💥 SSE stream error:", err);
};
