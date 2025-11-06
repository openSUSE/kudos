// scripts/compile-gettext.js
// Copyright © 2025–present Lubos Kocman
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import path from "path";
import gettextParser from "gettext-parser";

const localeDir = "frontend/locale";
const outputFile = path.join(localeDir, "gettext.json");

const locales = {};
const files = fs.readdirSync(localeDir).filter(f => f.endsWith(".po"));

if (files.length === 0) {
  console.warn("⚠️ No .po files found — creating fallback gettext.json");
  fs.writeFileSync(outputFile, JSON.stringify({ en: {} }, null, 2));
  process.exit(0);
}

for (const file of files) {
  const locale = path.basename(file, ".po");
  const poPath = path.join(localeDir, file);
  const poContent = fs.readFileSync(poPath);
  const parsed = gettextParser.po.parse(poContent);

  const messages = {};
  for (const [msgid, msg] of Object.entries(parsed.translations[""] || {})) {
    if (!msgid) continue;
    messages[msgid] = msg.msgstr[0] || msgid;
  }

  locales[locale] = messages;
}

fs.writeFileSync(outputFile, JSON.stringify(locales, null, 2));
console.log(`✅ Compiled ${files.length} language(s) → ${outputFile}`);
