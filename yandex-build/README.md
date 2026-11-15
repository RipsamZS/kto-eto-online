# Kazo — Yandex Games build

This branch is an isolated Yandex Games adaptation. The production Cloudflare Worker is not modified or deployed.

## Source preservation
- Exact source snapshot: `backup/kaza-worker-original.js`
- Yandex build: `yandex-build/worker.js`
- SDK adapter: `yandex-build/yandex-sdk.js`

## What changed
- Added the official relative SDK loader `/sdk.js` and adapter `/yandex-sdk.js` to the hub and all six game pages.
- The adapter initializes `YaGames`, calls `LoadingAPI.ready()` after the page load and SDK initialization, handles platform pause/resume and tab visibility, and exposes explicit gameplay/ad methods on `window.KazoYandexSDK`.
- Updated the service-worker cache version and excluded `/sdk.js` from service-worker caching.

## Important remaining integration
Gameplay events must be connected to the actual start/pause/end points of each mode using:
- `KazoYandexSDK.startGameplay()`
- `KazoYandexSDK.stopGameplay()`

Ad methods are exposed but are not triggered automatically:
- `KazoYandexSDK.showFullscreenAd()`
- `KazoYandexSDK.showRewardedVideo()`

Do not show ads during active gameplay. For fullscreen/rewarded ads the adapter pauses gameplay and resumes it afterward if it was active.

## Packaging and validation
This is source preparation, not a completed upload archive. Before submission:
1. Build the worker/static files into an HTML5 archive with `index.html` at archive root.
2. Verify the online multiplayer backend and WebSocket path in the Yandex iframe environment.
3. Connect gameplay start/stop to each real game round and test with Yandex debug mode.
4. Verify SDK loader indicator and Game Ready indicator in the Yandex debug panel.
5. Test all six modes, room creation/joining, reconnects, and ad callbacks.
