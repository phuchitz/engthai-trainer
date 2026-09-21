// Draws the app icons from shapes so they can be regenerated and reviewed in a diff,
// rather than committed as opaque binaries nobody can check.
//   node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const ACCENT = [0xa9, 0x4e, 0x08];
const PAPER = [0xfb, 0xfa, 0xf8];

/** Signed distance to a rounded rectangle; negative inside. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.abs(px - (x + w / 2)) - (w / 2 - r);
  const cy = Math.abs(py - (y + h / 2)) - (h / 2 - r);
  const ox = Math.max(cx, 0);
  const oy = Math.max(cy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(cx, cy), 0) - r;
}

/**
 * A sheet with three lines of text: a sentence, which is what this app drills.
 * Everything sits inside the central 80% so the maskable variant survives any mask.
 */
function shapes(full) {
  const bg = full
    ? { sd: () => -1, color: ACCENT }
    : { sd: (x, y) => sdRoundRect(x, y, 0, 0, 512, 512, 112), color: ACCENT };
  const card = { sd: (x, y) => sdRoundRect(x, y, 120, 128, 272, 256, 32), color: PAPER };
  const lines = [
    [188, 192],
    [244, 152],
    [300, 104],
  ].map(([y, w]) => ({ sd: (px, py) => sdRoundRect(px, py, 160, y, w, 24, 12), color: ACCENT }));
  return [bg, card, ...lines];
}

function render(size, full) {
  const layers = shapes(full);
  const scale = 512 / size;
  const px = new Uint8Array(size * size * 4);
  // 3x3 supersampling: cheap, and enough to keep the 24px bars clean at 192.
  const SS = 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS) * scale;
          const uy = (y + (sy + 0.5) / SS) * scale;
          let [cr, cg, cb, ca] = [0, 0, 0, 0];
          for (const layer of layers) {
            const cov = Math.min(Math.max(0.5 - layer.sd(ux, uy) / scale, 0), 1);
            if (cov <= 0) continue;
            // Source-over, premultiplied.
            cr = layer.color[0] * cov + cr * (1 - cov);
            cg = layer.color[1] * cov + cg * (1 - cov);
            cb = layer.color[2] * cov + cb * (1 - cov);
            ca = cov + ca * (1 - cov);
          }
          r += cr;
          g += cg;
          b += cb;
          a += ca;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const alpha = a / n;
      // Un-premultiply so the stored RGB is the real colour.
      px[i] = alpha > 0 ? Math.round(r / n / alpha) : 0;
      px[i + 1] = alpha > 0 ? Math.round(g / n / alpha) : 0;
      px[i + 2] = alpha > 0 ? Math.round(b / n / alpha) : 0;
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // Filter 0 on every scanline: these are flat shapes, so deflate handles them well.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [file, size, full] of [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/maskable-512.png", 512, true],
  ["public/icons/apple-touch-icon.png", 180, true],
]) {
  writeFileSync(file, png(size, render(size, full)));
  console.log(file);
}
