import { GestureRecognizer } from "@mediapipe/tasks-vision";
import wasmLoaderPath from "./mediapipe-assets/vision_wasm_module_internal.js?url";

let recognizer = null;
let delegate = "CPU";
let benchmarkMs = 0;
let delegateBenchmarks = {};
let delegateRecognizers = {};
let liveCalibrationFramesRemaining = 0;
let liveDelegateSamples = { CPU: [], GPU: [] };
const ANALYSIS_WIDTH = 384;
const ANALYSIS_HEIGHT = 216;
const LIVE_CALIBRATION_SAMPLES_PER_DELEGATE = 4;

function compactResults(results) {
  return {
    landmarks: (results.landmarks ?? []).map((hand) => hand.map(({ x, y, z }) => ({ x, y, z }))),
    gestures: (results.gestures ?? []).map((categories) => categories.slice(0, 1).map((category) => ({
      categoryName: category.categoryName,
      score: category.score,
    }))),
  };
}

async function createRecognizer() {
  const visionFiles = (instance) => ({
    // A distinct module URL is required when benchmarking a second delegate;
    // ES module imports are cached after the first Emscripten factory is used.
    wasmLoaderPath: `${wasmLoaderPath}${wasmLoaderPath.includes("?") ? "&" : "?"}instance=${instance}`,
    wasmBinaryPath: "/wasm/vision_wasm_module_internal.wasm",
  });
  const optionsFor = (candidateDelegate) => ({
    baseOptions: {
      modelAssetPath: "/gesture_recognizer.task",
      delegate: candidateDelegate,
    },
    canvas: candidateDelegate === "GPU" && typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(ANALYSIS_WIDTH, ANALYSIS_HEIGHT)
      : undefined,
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.42,
    minHandPresenceConfidence: 0.38,
    minTrackingConfidence: 0.35,
    cannedGesturesClassifierOptions: {
      maxResults: 1,
      scoreThreshold: 0.28,
    },
  });

  const benchmark = (instance, startTimestamp) => {
    if (typeof OffscreenCanvas === "undefined") return 0;
    const frame = new OffscreenCanvas(ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    instance.recognizeForVideo(frame, startTimestamp);
    instance.recognizeForVideo(frame, startTimestamp + 1);
    const samples = [];
    for (let index = 0; index < 3; index += 1) {
      const startedAt = performance.now();
      instance.recognizeForVideo(frame, startTimestamp + index + 2);
      samples.push(performance.now() - startedAt);
    }
    samples.sort((a, b) => a - b);
    return samples[1];
  };

  let cpuRecognizer = null;
  let gpuRecognizer = null;
  let cpuError = null;
  let gpuError = null;

  try {
    cpuRecognizer = await GestureRecognizer.createFromOptions(visionFiles("cpu"), optionsFor("CPU"));
    delegateBenchmarks.CPU = benchmark(cpuRecognizer, 0);
  } catch (error) {
    cpuError = error;
    console.warn("Worker CPU delegate unavailable", error);
  }

  try {
    gpuRecognizer = await GestureRecognizer.createFromOptions(visionFiles("gpu"), optionsFor("GPU"));
    delegateBenchmarks.GPU = benchmark(gpuRecognizer, 100);
  } catch (error) {
    gpuError = error;
    console.warn("Worker GPU delegate unavailable", error);
  }

  if (!cpuRecognizer && !gpuRecognizer) throw gpuError ?? cpuError ?? new Error("No MediaPipe delegate available");

  // GPU must win by a useful margin. A near tie goes to CPU because the GPU is
  // shared with the Three.js renderer and is more prone to contention spikes.
  const useGpu = Boolean(gpuRecognizer) && (
    !cpuRecognizer || delegateBenchmarks.GPU <= delegateBenchmarks.CPU * 0.88
  );
  if (useGpu) {
    recognizer = gpuRecognizer;
    delegate = "GPU";
    benchmarkMs = delegateBenchmarks.GPU;
  } else {
    recognizer = cpuRecognizer;
    delegate = "CPU";
    benchmarkMs = delegateBenchmarks.CPU;
  }
  if (cpuRecognizer) delegateRecognizers.CPU = cpuRecognizer;
  if (gpuRecognizer) delegateRecognizers.GPU = gpuRecognizer;
  liveCalibrationFramesRemaining = cpuRecognizer && gpuRecognizer
    ? LIVE_CALIBRATION_SAMPLES_PER_DELEGATE * 2
    : 0;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
}

function finalizeLiveDelegateSelection() {
  const cpuMs = median(liveDelegateSamples.CPU);
  const gpuMs = median(liveDelegateSamples.GPU);
  delegateBenchmarks = { CPU: cpuMs, GPU: gpuMs };
  const selected = gpuMs <= cpuMs * 0.88 ? "GPU" : "CPU";
  const rejected = selected === "GPU" ? "CPU" : "GPU";
  delegateRecognizers[rejected]?.close();
  delete delegateRecognizers[rejected];
  delegate = selected;
  recognizer = delegateRecognizers[selected];
  benchmarkMs = delegateBenchmarks[selected];
  self.postMessage({
    type: "delegate-selected",
    delegate,
    benchmarkMs,
    delegateBenchmarks,
    source: "live-camera-frames",
  });
}

self.addEventListener("message", async (event) => {
  const message = event.data;

  if (message.type === "init") {
    const startedAt = performance.now();
    try {
      await createRecognizer();
      self.postMessage({
        type: "ready",
        delegate,
        benchmarkMs,
        delegateBenchmarks,
        analysisWidth: ANALYSIS_WIDTH,
        analysisHeight: ANALYSIS_HEIGHT,
        initializationMs: performance.now() - startedAt,
      });
    } catch (error) {
      self.postMessage({ type: "fatal", message: error?.message || String(error) });
    }
    return;
  }

  if (message.type === "frame") {
    const { frame, timestamp, sequence, inputKind } = message;
    const startedAt = performance.now();
    try {
      let results;
      let inferenceMs;
      if (liveCalibrationFramesRemaining > 0) {
        const candidate = liveCalibrationFramesRemaining % 2 === 0 ? "CPU" : "GPU";
        const candidateStartedAt = performance.now();
        results = delegateRecognizers[candidate].recognizeForVideo(frame, timestamp);
        inferenceMs = performance.now() - candidateStartedAt;
        liveDelegateSamples[candidate].push(inferenceMs);
        liveCalibrationFramesRemaining -= 1;
        if (liveCalibrationFramesRemaining === 0) finalizeLiveDelegateSelection();
      } else {
        results = recognizer.recognizeForVideo(frame, timestamp);
        inferenceMs = performance.now() - startedAt;
      }
      self.postMessage({
        type: "result",
        sequence,
        inputKind,
        inferenceMs,
        delegate,
        results: compactResults(results),
      });
    } catch (error) {
      self.postMessage({
        type: "frame-error",
        sequence,
        inputKind,
        message: error?.message || String(error),
      });
    } finally {
      frame?.close?.();
    }
    return;
  }

  if (message.type === "close") {
    for (const instance of new Set(Object.values(delegateRecognizers))) instance?.close();
    delegateRecognizers = {};
    recognizer = null;
  }
});
