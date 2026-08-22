# Privacy model

Spatial Hardware Inspector is a local browser application.

## What stays local

- Local GLB files and manifests are read through browser file inputs.
- Camera frames are analyzed in a Web Worker in the same browser session.
- The application has no account system, analytics, telemetry, upload API, or remote inference service.

## Browser storage

The app stores a small recent-product list, camera capability cache, and camera preferences in `localStorage`. Recent hosted entries may contain URLs supplied by the user. Clear the site's browser data to remove these records.

## Network access

The bundled UI, MediaPipe task, and WebAssembly runtime are served from the local Vite process. Network requests occur when:

- the user explicitly loads a hosted model or manifest URL;
- npm installs dependencies during setup; or
- the browser or operating system performs its own unrelated services.

The loaded host can observe the normal web request metadata. Use local files for confidential products.

## Camera permissions

Camera access is requested only after gesture control is enabled. Selection and permission are controlled by the browser and operating system. Disable gesture control or close the page to stop the active media stream.
