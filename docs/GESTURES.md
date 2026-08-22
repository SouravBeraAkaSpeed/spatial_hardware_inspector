# Gesture guide

## Recommended setup

- Put the camera near the display and keep both hands inside the frame.
- Use even front lighting and avoid a bright window behind you.
- Start with the **Fast tracking** preset. Higher capture resolution rarely improves hand inference because the analysis frame is intentionally resized to 384×216.
- Choose the highest stable frame rate exposed by the browser and camera driver.
- Keep hand motion controlled during the short gesture transition; action begins after the gesture state is confirmed.

## Interaction flow

1. Use the 🤟 aim gesture or the two-grip midpoint to place the reticle on a component.
2. Touch thumb and index fingertips on both hands to establish the midpoint.
3. Spread both grips to lock the current target and focus inward.
4. Bring both grips together to return toward the saved camera view.

Target locking prevents the reticle from drifting during the transition into the focus gesture.

## Performance labels

Camera FPS is the delivered capture rate. Result FPS is the rate at which gesture inference completes. AI latency is the camera-to-result round trip. A higher advertised camera FPS does not guarantee lower recognition latency if the browser, USB bus, lighting, exposure time, or inference delegate is the limiting factor.

## Privacy

Frames are transferred to a local Web Worker and are not sent to an application server. See `PRIVACY.md` for the complete boundary.
