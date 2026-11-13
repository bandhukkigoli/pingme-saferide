// Makes the Android app assets from the website's logo:
// - app icons (all densities) from public/icon.svg
// - a white notification icon (Android shows small notification icons as white shapes)
// - res/raw/saferide_alarm.wav: a loud two-tone "ring" used by the alarm notification channel
// Run from the project root:  node mobile/make-assets.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";

const RES = "mobile/android/app/src/main/res";
const svg = readFileSync("public/icon.svg");

// 1) Launcher icons. We remove the "adaptive icon" XML so Android uses these PNGs directly.
rmSync(`${RES}/mipmap-anydpi-v26`, { recursive: true, force: true });
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, px] of Object.entries(sizes)) {
  mkdirSync(`${RES}/mipmap-${d}`, { recursive: true });
  for (const name of ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"]) {
    await sharp(svg, { density: 400 }).resize(px, px).png().toFile(`${RES}/mipmap-${d}/${name}.png`);
  }
}

// 2) Notification icon: white bag-tag with a bus window, on transparent.
const statSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><mask id="m"><rect width="96" height="96" fill="#fff"/><circle cx="48" cy="25" r="5" fill="#000"/><rect x="34" y="40" width="28" height="11" rx="2" fill="#000"/><circle cx="39" cy="62" r="3" fill="#000"/><circle cx="57" cy="62" r="3" fill="#000"/></mask><path mask="url(#m)" d="M30 14h36a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill="#fff"/></svg>`
);

for (const [d, px] of Object.entries({ mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 })) {
  mkdirSync(`${RES}/drawable-${d}`, { recursive: true });
  await sharp(statSvg, { density: 400 }).resize(px, px).png().toFile(`${RES}/drawable-${d}/ic_stat_saferide.png`);
}

// 3) Alarm sound: 6 seconds of a two-tone ring (880 Hz / 660 Hz), 16-bit mono WAV.
const rate = 22050, seconds = 6, n = rate * seconds;
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const t = i / rate;
  const inBeat = t % 1.2; // a ring every 1.2 s, like the website
  let v = 0;
  if (inBeat < 0.25) v = Math.sin(2 * Math.PI * 880 * t);
  else if (inBeat > 0.3 && inBeat < 0.55) v = Math.sin(2 * Math.PI * 660 * t);
  data.writeInt16LE(Math.round(v * 0.8 * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(data.length, 40);
mkdirSync(`${RES}/raw`, { recursive: true });
writeFileSync(`${RES}/raw/saferide_alarm.wav`, Buffer.concat([header, data]));
console.log("assets ok");
