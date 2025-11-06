// scripts/extract-gettext.js
// Copyright © 2025–present Lubos Kocman
// SPDX-License-Identifier: Apache-2.0

import { GettextExtractor, JsExtractors, HtmlExtractors } from "@connectedcars/gettext-extractor";
import fs from "fs";

// 🧩 Initialize extractor
const extractor = new GettextExtractor();

// ───────────────────────────────────────────────
// 📜 Extract strings from JavaScript
// ───────────────────────────────────────────────
extractor
  .createJsParser([
    JsExtractors.callExpression("_", { arguments: { text: 0 } }),
    JsExtractors.callExpression("gettext", { arguments: { text: 0 } }),
    JsExtractors.callExpression("ngettext", {
      arguments: { text: 0, textPlural: 1, count: 2 },
    }),
  ])
  .parseFilesGlob("frontend/src/**/*.@(js|vue)");

// ───────────────────────────────────────────────
// 🧩 Extract strings from HTML/Vue templates
// ───────────────────────────────────────────────
extractor
  .createHtmlParser([
    HtmlExtractors.elementContent("v-translate,[v-translate]"), // <div v-translate>Text</div>
    HtmlExtractors.elementContent("translate,[translate]"),     // <p translate>Text</p>
    HtmlExtractors.elementContent("p,span,h1,h2,h3,h4,h5,h6,button,a,div,li"), // visible text nodes
  ])
  .parseFilesGlob("frontend/src/**/*.vue");

// ───────────────────────────────────────────────
// 💾 Save POT and print summary
// ───────────────────────────────────────────────
fs.mkdirSync("frontend/locale", { recursive: true });
extractor.savePotFile("frontend/locale/messages.pot");
extractor.printStats();

console.log("✅ Extracted strings to frontend/locale/messages.pot");