#!/usr/bin/env node
// Dev yardımcı aracı: "2024 Yediiklim Tarih Çıkmış Sorular.pdf" taranmış bir PDF'tir
// (her sayfa CCITTFax G4 / 1-bit görüntü, metin katmanı yok). Bu script içindeki
// görüntüleri çıkarıp minimal bir TIFF'e sarar ve `sips` ile 180° döndürüp PNG üretir,
// böylece sayfalar Read (görsel okuma) ile okunup soru bankasına aktarılabilir.
//
// Kullanım:
//   node scripts/renderTarihPages.mjs <pdf> <outDir> [indexOrRange ...]
// Örnekler:
//   node scripts/renderTarihPages.mjs "~/Downloads/... .pdf" /tmp/out 0 1 2
//   node scripts/renderTarihPages.mjs "~/Downloads/... .pdf" /tmp/out 4-12
//   node scripts/renderTarihPages.mjs "~/Downloads/... .pdf" /tmp/out          # tümü + özet
//
// Not: Bu üretilen bir veri kaynağı değildir; yalnızca çıkarım sırasında sayfaları
// göz/okuma için PNG'ye çevirmeye yarar. Ürettiği PNG'ler repoya girmez.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

function expandHome(p) {
  return p.startsWith("~") ? join(os.homedir(), p.slice(1)) : p;
}

function parseIndices(args) {
  const out = [];
  for (const arg of args) {
    const m = /^(\d+)-(\d+)$/.exec(arg);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) out.push(i);
    } else {
      out.push(Number(arg));
    }
  }
  return out;
}

// PDF içindeki tüm CCITTFaxDecode image XObject'lerini kaba bir tarama ile bul.
function findCcittImages(data) {
  const images = [];
  const objRe = /obj\b/g;
  let match;
  while ((match = objRe.exec(data)) !== null) {
    const start = match.index + match[0].length;
    const end = data.indexOf("endobj", start);
    if (end < 0) continue;
    const header = data.slice(start, Math.min(end, start + 2000));
    if (!header.includes("/Subtype") || !header.includes("/Image")) continue;
    if (!header.includes("CCITTFaxDecode")) continue;

    const width = Number(/\/Width\s+(\d+)/.exec(header)?.[1]);
    const height = Number(/\/Height\s+(\d+)/.exec(header)?.[1]);
    const blackIs1 = /\/BlackIs1\s+true/.test(header);

    const streamMatch = /stream\r?\n/.exec(data.slice(start, end));
    if (!streamMatch) continue;
    let sStart = start + streamMatch.index + streamMatch[0].length;
    let sEnd = data.indexOf("endstream", sStart);
    if (sEnd < 0) continue;
    // "endstream" öncesindeki EOL'i kırp
    if (data[sEnd - 1] === "\n") sEnd -= 1;
    if (data[sEnd - 1] === "\r") sEnd -= 1;

    images.push({ width, height, blackIs1, sStart, sEnd });
  }
  return images;
}

// Tek şeritli, G4 (Compression=4) sıkıştırmalı minimal TIFF üret.
function buildTiff(width, height, blackIs1, raw) {
  const photometric = blackIs1 ? 1 : 0; // fax: 0 = WhiteIsZero
  const entries = [
    [256, 3, 1, width], // ImageWidth
    [257, 3, 1, height], // ImageLength
    [258, 3, 1, 1], // BitsPerSample
    [259, 3, 1, 4], // Compression = CCITT G4
    [262, 3, 1, photometric], // PhotometricInterpretation
    [273, 4, 1, 0], // StripOffsets (patched below)
    [277, 3, 1, 1], // SamplesPerPixel
    [278, 3, 1, height], // RowsPerStrip
    [279, 4, 1, raw.length], // StripByteCounts
  ];
  const n = entries.length;
  const headerSize = 8;
  const ifdSize = 2 + n * 12 + 4;
  const dataOffset = headerSize + ifdSize;

  const head = Buffer.alloc(headerSize + ifdSize);
  head.write("II", 0, "ascii");
  head.writeUInt16LE(42, 2);
  head.writeUInt32LE(8, 4);
  head.writeUInt16LE(n, 8);
  let p = 10;
  for (const [tag, type, count, value] of entries) {
    head.writeUInt16LE(tag, p);
    head.writeUInt16LE(type, p + 2);
    head.writeUInt32LE(count, p + 4);
    head.writeUInt32LE(tag === 273 ? dataOffset : value, p + 8);
    p += 12;
  }
  head.writeUInt32LE(0, p); // next IFD = 0
  return Buffer.concat([head, raw]);
}

function main() {
  const [pdfArg, outArg, ...rest] = process.argv.slice(2);
  if (!pdfArg || !outArg) {
    console.error(
      'Kullanım: node scripts/renderTarihPages.mjs <pdf> <outDir> [index|a-b ...]',
    );
    process.exit(1);
  }
  const pdfPath = expandHome(pdfArg);
  const outDir = expandHome(outArg);
  mkdirSync(outDir, { recursive: true });

  const buf = readFileSync(pdfPath);
  const latin1 = buf.toString("latin1");
  const images = findCcittImages(latin1);
  console.log(`Bulunan CCITT görüntü sayısı: ${images.length}`);

  const indices = rest.length ? parseIndices(rest) : images.map((_, i) => i);
  if (!rest.length) {
    console.log("(İndeks verilmedi — tüm görüntüler PNG'ye çevrilecek.)");
  }

  for (const idx of indices) {
    const img = images[idx];
    if (!img) {
      console.warn(`  [${idx}] yok, atlandı`);
      continue;
    }
    const raw = buf.subarray(img.sStart, img.sEnd);
    const tiff = buildTiff(img.width, img.height, img.blackIs1, raw);
    const tifPath = join(outDir, `p${String(idx).padStart(3, "0")}.tif`);
    const pngPath = join(outDir, `p${String(idx).padStart(3, "0")}.png`);
    writeFileSync(tifPath, tiff);
    // sips: TIFF -> PNG, 180° döndür (sayfalar ters geliyor)
    execFileSync("sips", ["-r", "180", "-s", "format", "png", tifPath, "--out", pngPath], {
      stdio: "ignore",
    });
    console.log(`  [${idx}] ${img.width}x${img.height} -> ${pngPath}`);
  }
}

main();
