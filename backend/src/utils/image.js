// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import sharp from "sharp";

/**
 * Convert SVG string → PNG buffer safely for Lambda
 */
export async function svgToPng(svg) {
  const buffer = Buffer.from(svg);
  return await sharp(buffer)
    .png({ quality: 90 })
    .toBuffer();
}
