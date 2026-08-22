# Architecture

Spatial Hardware Inspector is a static browser application served by Vite.

```text
GLB + optional manifest
          │
          ▼
 runtime product loader ──► named Three.js meshes ──► selection / dimensions
          │                           │
          │                           └──────────────► explode / focus / lighting
          │
camera ──► fresh-frame scheduler ──► Web Worker ──► MediaPipe results
                                                   │
                                                   └► gesture state machine ─► viewer controls
```

## Main thread

`src/app.js` owns the Three.js scene, model loading, engineering-record association, interaction state, camera configuration, and user interface. It sends at most one analysis frame to the worker and does not create an inference queue.

## Gesture worker

`src/gesture-worker.js` loads the local MediaPipe task and WebAssembly runtime. It benchmarks CPU and GPU delegates, performs a short calibration on live frames, and returns compact landmark and gesture data. The worker closes transferable frames after each result or error.

## Product boundary

No product is embedded in the viewer. A product repository supplies a GLB and can optionally supply the engineering manifest described in `MODEL_CONTRACT.md`. This separation lets the same application inspect robots, enclosures, jigs, mechanisms, and other assemblies.

## Trust boundary

A plain GLB is treated as an inspectable preview. A compatible manifest adds declared engineering evidence, but the viewer does not independently prove tolerances, watertightness, materials, clearances, or physical safety. Those checks belong to the product's release workflow.
