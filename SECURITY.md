# Security policy

## Supported versions

Security fixes are applied to the latest release and the `main` branch.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository when available. If it is unavailable, contact the maintainer privately through the contact method on the GitHub profile for `SouravBeraAkaSpeed`. Do not include private models, camera images, access tokens, or personal data in a public issue.

Include the affected version, reproduction steps, impact, and any proposed mitigation. Please allow reasonable time for investigation before public disclosure.

## Security boundaries

- Local model files and camera frames are processed in the browser.
- The app has no application server, account system, telemetry, or upload endpoint.
- Hosted model URLs are fetched only after the user supplies or opens them.
- Browser, camera-driver, MediaPipe, Three.js, Vite, and npm supply-chain vulnerabilities remain upstream dependencies.
- An engineering manifest is descriptive data, not a trusted executable format and not a manufacturing certificate.
