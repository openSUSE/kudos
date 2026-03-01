
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
      obj[headers[j]] = currentline[j] ? currentline[j].trim().replace(/"/g, "") : "";
    }
    result.push(obj);
  }
  return result;
}

async function main() {
  console.log("🌱 Seeding members from members.csv");

  const defaultPassword = "opensuse";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const csvPath = path.join(path.dirname(new URL(import.meta.url).pathname), "members.csv");
  const csvData = fs.readFileSync(csvPath, "utf-8");
  const members = parseCSV(csvData);

  const memberBadge = await prisma.badge.findUnique({
    where: { slug: "member" },
  });

  if (!memberBadge) {
    console.error("💥 Could not find badge with slug 'member'. Please seed base data first.");
    process.exit(1);
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const member of members) {
    if (member.status === "active") {
      if (!member.username) {
        console.warn("⏩ Skipping member with empty username:", member);
        skippedCount++;
        continue;
      }

      const user = await prisma.user.upsert({
        where: { username: member.username },
        update: {
          email: member.email_full || undefined,
        },
        create: {
          username: member.username,
          email: member.email_full || null,
          passwordHash,
        },
      });

      await prisma.userBadge.upsert({
        where: {
          userId_badgeId: {
            userId: user.id,
            badgeId: memberBadge.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          badgeId: memberBadge.id,
        },
      });

      createdCount++;
      console.log(`👤 Upserted user '${user.username}' and assigned 'member' badge.`);
    } else {
      skippedCount++;
    }
  }

  console.log(`✅ Seeded ${createdCount} active members and assigned 'member' badge.`);
  console.log(`⏩ Skipped ${skippedCount} members (emeritus, missing username, etc.).`);
}

main()
  .catch(e => {
    console.error("💥 Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
