# Testing

## Deterministic checks

```powershell
npm ci
npm test
npm run build
```

These checks validate the release file contract, local inference assets, manifest schema, worker boundary, and production compilation. They do not claim that a physical camera was exercised.

## Camera and product smoke test

The smoke driver expects:

- a Vite preview at `http://127.0.0.1:4173/`;
- Chromium launched with remote debugging on port `9333`;
- a GLB and compatible manifest; and
- camera permission when the gesture portion is tested.

Environment variables can override each endpoint and fixture:

```text
HARDWARE_VIEWER_CDP
HARDWARE_VIEWER_URL
HARDWARE_VIEWER_MODEL
HARDWARE_VIEWER_MANIFEST
HARDWARE_VIEWER_SCREENSHOT
```

After the preview and debug browser are running:

```powershell
npm run test:smoke
```

The test covers loader state, plain-model preview labeling, manifest compatibility, dimensions, selection, explode/assemble, camera modes, recommended settings, worker results, and browser exceptions.
