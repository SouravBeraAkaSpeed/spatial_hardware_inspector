import { readFile, writeFile } from "node:fs/promises";

const endpoint = process.env.HARDWARE_VIEWER_CDP ?? process.env.ROBOT_VIEWER_CDP ?? "http://127.0.0.1:9333";
const expectedUrl = process.env.HARDWARE_VIEWER_URL ?? process.env.ROBOT_VIEWER_URL ?? "http://127.0.0.1:4173/";
const modelFixture = process.env.HARDWARE_VIEWER_MODEL ?? process.env.ROBOT_VIEWER_MODEL;
const manifestFixture = process.env.HARDWARE_VIEWER_MANIFEST ?? process.env.ROBOT_VIEWER_MANIFEST;
if (!modelFixture || !manifestFixture) {
  throw new Error(
    "Set HARDWARE_VIEWER_MODEL and HARDWARE_VIEWER_MANIFEST to a compatible local GLB/JSON pair",
  );
}
const fixtureManifest = JSON.parse(await readFile(manifestFixture, "utf8"));
const expectedPartCount = fixtureManifest.model?.partCount
  ?? Object.keys(fixtureManifest.parts ?? {}).length;
if (!Number.isInteger(expectedPartCount) || expectedPartCount < 1) {
  throw new Error("Engineering manifest has no valid part count");
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findPage() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`${endpoint}/json/list`).then((response) => response.json());
      const page = pages.find((candidate) => candidate.type === "page" && candidate.url.startsWith(expectedUrl));
      if (page) return page;
    } catch {
      // The test browser is still starting.
    }
    await sleep(200);
  }
  throw new Error("Could not connect to the test browser page");
}

const page = await findPage();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const exceptions = [];
const consoleMessages = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    exceptions.push(details.exception?.description ?? details.text);
  }
  if (message.method === "Runtime.consoleAPICalled") {
    consoleMessages.push(message.params.args.map((argument) => argument.value ?? argument.description ?? argument.type).join(" "));
  }
});

function command(method, params = {}) {
  const id = nextId;
  nextId += 1;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

await command("Runtime.enable");
await command("DOM.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", {
  width: Number(process.env.HARDWARE_VIEWER_TEST_WIDTH ?? 1600),
  height: Number(process.env.HARDWARE_VIEWER_TEST_HEIGHT ?? 900),
  deviceScaleFactor: 1,
  mobile: false,
});
await command("Page.navigate", { url: expectedUrl });
await waitFor("document.readyState === 'complete'");

async function setFileInput(selector, files) {
  const documentNode = await command("DOM.getDocument", { depth: 1 });
  const result = await command("DOM.querySelector", {
    nodeId: documentNode.root.nodeId,
    selector,
  });
  if (!result.nodeId) throw new Error(`File input not found: ${selector}`);
  await command("DOM.setFileInputFiles", { nodeId: result.nodeId, files });
}

try {
  await waitFor("document.getElementById('model-state')?.textContent.includes('Choose a product')");
  await waitFor("document.getElementById('product-source-panel')?.hidden === false");
} catch (error) {
  const diagnostic = await evaluate(`({
    model: document.getElementById('model-state')?.textContent,
    panelHidden: document.getElementById('product-source-panel')?.hidden,
    readyState: document.readyState
  })`);
  console.error(JSON.stringify({ diagnostic, exceptions, consoleMessages }, null, 2));
  throw error;
}
if (process.env.HARDWARE_VIEWER_LOADER_SCREENSHOT) {
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(
    process.env.HARDWARE_VIEWER_LOADER_SCREENSHOT,
    Buffer.from(screenshot.data, "base64"),
  );
}

// A plain GLB must remain inspectable, but it must be identified as a measured
// preview rather than an engineering release artifact.
await setFileInput("#product-model-file", [modelFixture]);
await setFileInput("#product-manifest-file", []);
await evaluate(`{
  document.getElementById('product-source-units').value = 'mm';
  document.getElementById('product-up-axis').value = 'Z';
  document.getElementById('product-load-local').click();
}`);
await waitFor(`/${expectedPartCount}\\s+measured parts ready/.test(document.getElementById('model-state')?.textContent)`);
await waitFor("document.getElementById('product-source-status')?.dataset.status === 'preview'");

await evaluate("document.getElementById('product-source-toggle').click()");
await waitFor("document.getElementById('product-source-panel')?.hidden === false");
await setFileInput("#product-model-file", [modelFixture]);
await setFileInput("#product-manifest-file", [manifestFixture]);
await evaluate("document.getElementById('product-load-local').click()");
try {
  await waitFor(`/${expectedPartCount}\\s+(dimensioned\\s+)?parts ready/.test(document.getElementById('model-state')?.textContent)`);
} catch (error) {
  const diagnostic = await evaluate(`({
    model: document.getElementById('model-state')?.textContent,
    toast: document.getElementById('toast')?.textContent,
    body: document.body?.innerText.slice(0, 500)
  })`);
  console.error(JSON.stringify({ diagnostic, exceptions, consoleMessages }, null, 2));
  throw error;
}
await waitFor("document.getElementById('overall-size')?.textContent.includes('mm')");
await waitFor("document.getElementById('product-source-status')?.dataset.status === 'verified'");

await evaluate(`{
  const button = document.getElementById('dimensions-button');
  if (button.getAttribute('aria-pressed') !== 'true') button.click();
}`);
await waitFor("document.getElementById('dimensions-button').getAttribute('aria-pressed') === 'true'");

const canvasCenter = await evaluate(`(() => {
  const canvas = document.getElementById('scene');
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
})()`);
await command("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: canvasCenter.x,
  y: canvasCenter.y,
  button: "left",
  clickCount: 1,
});
await command("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: canvasCenter.x,
  y: canvasCenter.y,
  button: "left",
  clickCount: 1,
});
await waitFor("!document.getElementById('selected-dimensions').textContent.includes('—')");

await evaluate("document.getElementById('explode-button').click()");
await waitFor("document.getElementById('explosion-slider').value === '100'");
if ((process.env.HARDWARE_VIEWER_LEAVE_EXPLODED ?? process.env.ROBOT_VIEWER_LEAVE_EXPLODED) !== "1") {
  await evaluate("document.getElementById('assemble-button').click()");
  await waitFor("document.getElementById('explosion-slider').value === '0'");
}

await evaluate(`{
  if (document.getElementById('camera-state').textContent !== 'LIVE') {
    document.getElementById('camera-toggle').click();
  }
}`);
try {
  await waitFor("document.getElementById('camera-state').textContent === 'LIVE'", 30000);
} catch (error) {
  const diagnostic = await evaluate(`({
    camera: document.getElementById('camera-state').textContent,
    toast: document.getElementById('toast').textContent,
    latency: document.getElementById('gesture-latency').textContent,
    buttonDisabled: document.getElementById('camera-toggle').disabled
  })`);
  console.error(JSON.stringify({ diagnostic, exceptions, consoleMessages }, null, 2));
  throw error;
}
await waitFor("!/--/.test(document.getElementById('gesture-latency').textContent)", 30000);
await waitFor("document.getElementById('gesture-latency').dataset.analysisSize === '384x216'", 30000);
await waitFor("document.getElementById('gesture-latency').dataset.delegateSource === 'live-camera-frames'", 30000);
await evaluate(`{
  const toggle = document.getElementById('camera-settings-toggle');
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
}`);
await waitFor("document.getElementById('camera-settings-panel').hidden === false");
await waitFor("document.getElementById('camera-active-mode').textContent !== 'Camera offline'");
const cameraConfiguration = await evaluate(`({
  activeMode: document.getElementById('camera-active-mode').textContent.trim(),
  modeNote: document.getElementById('camera-mode-note').textContent.trim(),
  devices: [...document.getElementById('camera-device').options].map((option) => option.textContent),
  resolutions: [...document.getElementById('camera-resolution').options].map((option) => option.textContent),
  frameRates: [...document.getElementById('camera-fps').options].map((option) => option.textContent),
  recommendedResolution: [...document.getElementById('camera-resolution').options].some((option) => option.textContent.includes('BEST SPEED')),
  recommendedFps: [...document.getElementById('camera-fps').options].some((option) => option.textContent.includes('BEST LATENCY')),
  hardwareCount: document.getElementById('camera-hardware-count').textContent.trim()
})`);
if (!cameraConfiguration.recommendedResolution || !cameraConfiguration.recommendedFps) {
  throw new Error(`Recommended camera modes are missing: ${JSON.stringify(cameraConfiguration)}`);
}
if ((process.env.HARDWARE_VIEWER_EXPECT_TWO_HAND_FOCUS ?? process.env.ROBOT_VIEWER_EXPECT_TWO_HAND_FOCUS) === "1") {
  await waitFor(
    "!document.getElementById('selected-part').textContent.trim().startsWith('None')",
    20000,
  );
}
if ((process.env.HARDWARE_VIEWER_EXPECT_TWO_HAND_RETURN ?? process.env.ROBOT_VIEWER_EXPECT_TWO_HAND_RETURN) === "1") {
  await waitFor(
    "document.getElementById('toast').textContent.includes('Previous camera view restored')",
    20000,
  );
}

const report = await evaluate(`({
  model: document.getElementById('model-state').textContent.trim(),
  overallSize: document.getElementById('overall-size').textContent.trim(),
  explosion: document.getElementById('explosion-slider').value,
  camera: document.getElementById('camera-state').textContent,
  gestureLatency: document.getElementById('gesture-latency').textContent,
  delegate: document.getElementById('gesture-latency').dataset.delegate,
  benchmarkMs: document.getElementById('gesture-latency').dataset.benchmarkMs,
  inferenceMs: document.getElementById('gesture-latency').dataset.inferenceMs,
  resultFps: document.getElementById('gesture-latency').dataset.resultFps,
  inputKind: document.getElementById('gesture-latency').dataset.inputKind,
  analysisSize: document.getElementById('gesture-latency').dataset.analysisSize,
  delegateBenchmarks: document.getElementById('gesture-latency').dataset.delegateBenchmarks,
  delegateSource: document.getElementById('gesture-latency').dataset.delegateSource,
  gesture: document.getElementById('gesture-name').textContent,
  selectedPart: document.getElementById('selected-part').textContent.trim(),
  selectedDimensions: document.getElementById('selected-dimensions').textContent.trim(),
  engineeringStatus: document.getElementById('selected-engineering-status').textContent.trim(),
  dimensionsVisible: document.getElementById('dimensions-button').getAttribute('aria-pressed'),
  activeProduct: document.getElementById('active-product-name').textContent.trim(),
  productCompatibility: document.getElementById('product-compatibility').textContent.trim(),
  productStatus: document.getElementById('product-source-status').dataset.status,
  cameraConfiguration: ${JSON.stringify(cameraConfiguration)},
  canvasWidth: document.getElementById('scene').width,
  canvasHeight: document.getElementById('scene').height
})`);

const screenshotPath = process.env.HARDWARE_VIEWER_SCREENSHOT ?? process.env.ROBOT_VIEWER_SCREENSHOT;
if (screenshotPath) {
  await command("Page.enable");
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

socket.close();
console.log(JSON.stringify({ ok: exceptions.length === 0, report, exceptions }, null, 2));
if (exceptions.length) process.exitCode = 1;
