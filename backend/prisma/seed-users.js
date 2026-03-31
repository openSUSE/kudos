// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Simple CSV parser
function parseCSV(csv) {
  const lines = csv.split("\n");
  const result = [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;

    const obj = {};
    const currentline = lines[i].split(",");

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j]
        ? currentline[j].trim().replace(/"/g, "")
        : "";
    }

    result.push(obj);
  }

  return result;
}

async function main() {
  console.log("🌱 Seeding users from users.csv");

  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const csvPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "users.csv"
  );

  const csvData = fs.readFileSync(csvPath, "utf-8");
  const users = parseCSV(csvData);

  let createdCount = 0;
  let skippedCount = 0;

  for (const entry of users) {
    if (!entry.username) {
      console.warn("⏩ Skipping entry with empty username:", entry);
      skippedCount++;
      continue;
    }

    const user = await prisma.user.upsert({
      where: { username: entry.username },
      update: {
        email: entry.email || undefined,
      },
      create: {
        username: entry.username,
        email: entry.email || null,
        passwordHash,
      },
    });

    createdCount++;
    console.log(`👤 Upserted user '${user.username}'.`);
  }

  console.log(`✅ Seeded ${createdCount} users.`);
  console.log(`⏩ Skipped ${skippedCount} entries.`);
}

main()
  .catch(e => {
    console.error("💥 Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

