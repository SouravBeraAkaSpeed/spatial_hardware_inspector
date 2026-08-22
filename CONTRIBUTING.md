# Contributing

Thank you for improving Spatial Hardware Inspector.

## Before opening a change

1. Open an issue for substantial behavior or manifest-contract changes.
2. Keep the viewer product-agnostic. Product geometry belongs in its own repository.
3. Do not weaken the distinction between measured previews and engineering manifests.
4. Do not add telemetry or upload camera frames.

## Development

```powershell
npm ci
npm test
npm run build
```

For camera and gesture changes, also complete the hardware smoke procedure in `docs/TESTING.md`. Include the tested browser, camera mode, measured AI latency, and any relevant screenshot in the pull request.

## Pull requests

- Keep each pull request focused.
- Add or update tests for contract changes.
- Update documentation and `CHANGELOG.md` when user-visible behavior changes.
- Never commit credentials, private product models, `node_modules`, or generated `dist` output.
- Confirm `git diff --check`, `npm test`, and `npm run build` pass.
