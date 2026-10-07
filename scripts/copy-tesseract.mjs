import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public/tesseract");
const coreOut = path.join(out, "core");
const langOut = path.join(out, "lang");
fs.mkdirSync(coreOut, { recursive: true });
fs.mkdirSync(langOut, { recursive: true });

fs.copyFileSync(path.join(root, "node_modules/tesseract.js/dist/worker.min.js"), path.join(out, "worker.min.js"));

for (const name of [
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
]) {
  fs.copyFileSync(path.join(root, "node_modules/tesseract.js-core", name), path.join(coreOut, name));
}

for (const [pkg, file] of [
  ["kor", "kor.traineddata.gz"],
  ["eng", "eng.traineddata.gz"],
]) {
  fs.copyFileSync(
    path.join(root, "node_modules/@tesseract.js-data", pkg, "4.0.0_best_int", file),
    path.join(langOut, file),
  );
}
