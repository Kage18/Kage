#!/usr/bin/env node
// Draws Kage's app icon and menubar mark from one shape definition, at every size each surface
// needs. No design-tool export step, no binaries committed that nobody can regenerate.
//
// The mark is the eye, FLATTENED: one stroke, one fill, no gradient. The repo's existing
// `docs/assets/kage-eye.svg` is a radial-gradient glow — right for a banner, wrong for an icon,
// because a gradient turns to mud at 16px and a glow reads as blur in a menubar.
//
// Two outputs, and they are not the same image:
//   icon.icns        the app icon — the mark in the verified green on the theme's ground
//   trayTemplate.png a macOS TEMPLATE image: monochrome, information carried ENTIRELY by alpha,
//                    so the OS tints it for a light or dark menubar. A coloured tray icon is the
//                    classic tell of a non-native app.
//
// Usage: node scripts/make-assets.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, "..", "assets");

// ── PNG encoding ─────────────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** `pixels` is RGBA, 4 bytes per pixel, row-major. */
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type. Filter 0 (none) keeps this readable; these
  // images are tiny and the compression difference is irrelevant.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── The mark ─────────────────────────────────────────────────────────────────────────────────

// Geometry in a unit square, so one definition scales to every size.
const LENS_RX = 0.42;      // half-width of the eye
const LENS_RY = 0.235;     // half-height
const STROKE = 0.052;      // lens outline weight
const IRIS_R = 0.135;
const PUPIL_R = 0.052;
const CORNER = 0.2237;     // macOS icon corner radius as a fraction of the side

/** Coverage of the mark at a point, 0..1, antialiased by supersampling. */
function markCoverage(x, y) {
  // Ellipse outline: |distance to the ellipse| within half the stroke width.
  const e = Math.hypot(x / LENS_RX, y / LENS_RY);
  // Approximate distance to the ellipse boundary, scaled back to unit space.
  const grad = Math.hypot(x / (LENS_RX * LENS_RX), y / (LENS_RY * LENS_RY)) || 1e-6;
  const distance = Math.abs(e - 1) / grad;
  if (distance <= STROKE / 2) return 1;

  const r = Math.hypot(x, y);
  if (r <= IRIS_R && r > PUPIL_R) return 1;
  return 0;
}

function rounded(x, y, half, radius) {
  // Signed distance to a rounded square centred at the origin.
  const dx = Math.abs(x) - (half - radius);
  const dy = Math.abs(y) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside - radius + Math.min(Math.max(dx, dy), 0) <= 0;
}

const SAMPLES = 4; // 4x4 supersampling — enough to keep a 16px tray mark clean

/**
 * @param size          side in pixels
 * @param opts.template true → monochrome, meaning lives only in alpha (macOS tints it)
 */
function draw(size, opts = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const ink = opts.template ? [0, 0, 0] : [0x43, 0xc9, 0x8a];
  const ground = [0x0e, 0x14, 0x11];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let mark = 0;
      let inside = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          // Unit coordinates centred on the icon, y down.
          const x = (px + (sx + 0.5) / SAMPLES) / size - 0.5;
          const y = (py + (sy + 0.5) / SAMPLES) / size - 0.5;
          mark += markCoverage(x, y);
          if (!opts.template && rounded(x, y, 0.5, CORNER)) inside += 1;
        }
      }
      const total = SAMPLES * SAMPLES;
      const markAlpha = mark / total;
      const offset = (py * size + px) * 4;

      if (opts.template) {
        // Template image: colour is ignored by macOS, alpha is the whole picture.
        pixels[offset] = ink[0];
        pixels[offset + 1] = ink[1];
        pixels[offset + 2] = ink[2];
        pixels[offset + 3] = Math.round(markAlpha * 255);
        continue;
      }

      const groundAlpha = inside / total;
      // Composite the mark over the ground, then the whole thing over transparency.
      const r = ground[0] * (1 - markAlpha) + ink[0] * markAlpha;
      const g = ground[1] * (1 - markAlpha) + ink[1] * markAlpha;
      const b = ground[2] * (1 - markAlpha) + ink[2] * markAlpha;
      pixels[offset] = Math.round(r);
      pixels[offset + 1] = Math.round(g);
      pixels[offset + 2] = Math.round(b);
      pixels[offset + 3] = Math.round(groundAlpha * 255);
    }
  }
  return encodePng(size, size, pixels);
}

// ── Emit ─────────────────────────────────────────────────────────────────────────────────────

mkdirSync(assetsDir, { recursive: true });

// The menubar mark. macOS asks for @1x and @2x; the mark is drawn a little tighter than the app
// icon because a menubar mark sits on a 22pt strip with no ground behind it.
writeFileSync(join(assetsDir, "trayTemplate.png"), draw(16, { template: true }));
writeFileSync(join(assetsDir, "trayTemplate@2x.png"), draw(32, { template: true }));
console.log("wrote trayTemplate.png, trayTemplate@2x.png");

// The app icon, as a full iconset so `iconutil` can build a real .icns.
const iconset = join(assetsDir, "icon.iconset");
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });
for (const [size, names] of [
  [16, ["icon_16x16.png"]],
  [32, ["icon_16x16@2x.png", "icon_32x32.png"]],
  [64, ["icon_32x32@2x.png"]],
  [128, ["icon_128x128.png"]],
  [256, ["icon_128x128@2x.png", "icon_256x256.png"]],
  [512, ["icon_256x256@2x.png", "icon_512x512.png"]],
  [1024, ["icon_512x512@2x.png"]],
]) {
  const png = draw(size);
  for (const name of names) writeFileSync(join(iconset, name), png);
}
writeFileSync(join(assetsDir, "icon.png"), draw(1024));

try {
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(assetsDir, "icon.icns")]);
  rmSync(iconset, { recursive: true, force: true });
  console.log("wrote icon.icns, icon.png");
} catch (error) {
  // iconutil is macOS-only. On another platform the iconset and the 1024 PNG are still useful.
  console.log(`wrote icon.png and icon.iconset (iconutil unavailable: ${error.message})`);
}
