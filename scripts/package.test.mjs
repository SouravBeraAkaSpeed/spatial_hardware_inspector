import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "index.html",
  "src/app.js",
  "src/gesture-worker.js",
  "public/gesture_recognizer.task",
  "public/wasm/vision_wasm_module_internal.js",
  "public/wasm/vision_wasm_module_internal.wasm",
  "docs/engineering-manifest.schema.json",
  "START_VIEWER.cmd",
];

test("release contains every local runtime asset", async () => {
  for (const path of requiredFiles) {
    await access(path);
    assert.ok((await stat(path)).size > 0, `${path} must not be empty`);
  }
});

test("application shell is local-first and branded", async () => {
  const html = await readFile("index.html", "utf8");
  assert.match(html, /Spatial Hardware Inspector/);
  assert.match(html, /spatial-hardware-inspector-logo\.png/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
});

test("gesture inference remains off the renderer thread", async () => {
  const app = await readFile("src/app.js", "utf8");
  const worker = await readFile("src/gesture-worker.js", "utf8");
  assert.match(app, /new Worker\(/);
  assert.match(worker, /GestureRecognizer/);
  assert.match(worker, /ANALYSIS_WIDTH = 384/);
  assert.match(worker, /ANALYSIS_HEIGHT = 216/);
});

test("smoke test has no machine-specific product dependency", async () => {
  const smoke = await readFile("scripts/smoke-test.mjs", "utf8");
  assert.doesNotMatch(smoke, /D:\\\\work/);
  assert.match(smoke, /HARDWARE_VIEWER_MODEL/);
  assert.match(smoke, /HARDWARE_VIEWER_MANIFEST/);
});

test("engineering manifest schema preserves the universal contract", async () => {
  const schema = JSON.parse(await readFile("docs/engineering-manifest.schema.json", "utf8"));
  assert.deepEqual(schema.required, ["schemaVersion", "project", "model", "parts"]);
  assert.equal(schema.properties.model.properties.units.const, "mm");
  assert.ok(schema.$defs.part.properties.engineering.properties.geometry_status.enum.includes("design_exact"));
  assert.ok(schema.$defs.part.properties.engineering.properties.geometry_status.enum.includes("reference_only"));
});
