// Makes public/icon-192.png and public/icon-512.png from public/icon.svg.
// Run once:  node scripts/make-icons.mjs   (needs the dev dependency "sharp")
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg");
for (const size of [192, 512]) {
  // density makes the small SVG render sharply at the bigger size
  await sharp(svg, { density: 72 * (size / 96) }).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`wrote public/icon-${size}.png`);
}
