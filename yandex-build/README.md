# Kazo — Yandex Games build

This branch is an isolated Yandex Games adaptation. The production Cloudflare Worker is not modified or deployed.

## Source preservation
- Exact source snapshot: `backup/kaza-worker-original.js`
- Yandex build: `yandex-build/worker.js`
- SDK adapter: `yandex-build/yandex-sdk.js`

## Implemented
- Added the official relative SDK loader `/sdk.js` and adapter `/yandex-sdk.js` to the hub and all six game pages.
- The adapter initializes `YaGames`, calls `LoadingAPI.ready()` after page load and SDK initialization, handles platform pause/resume and tab visibility, and exposes explicit gameplay/ad methods on `window.KazoYandexSDK`.
- Connected `GameplayAPI.start()` to actual start actions in Alias, Code Names, Spy, Imaginarium, Who Am I, and Who Is It.
- Connected `GameplayAPI.stop()` to exit/menu actions, tab hiding, and page unload where those hooks are available.
- Updated the service-worker cache version and excluded `/sdk.js` from service-worker caching.

## Ads
Ads are available through:
- `KazoYandexSDK.showFullscreenAd()`
- `KazoYandexSDK.showRewardedVideo()`

They are not triggered automatically. Connect them only to appropriate breaks/reward moments; do not interrupt active gameplay.

## Remaining validation
This is source preparation, not a completed upload archive. Before submission:
1. Build the static files into an HTML5 archive with `index.html` at archive root.
2. Verify the online multiplayer backend and WebSocket path in the Yandex iframe environment.
3. Test actual start/stop transitions for all six modes with Yandex debug mode.
4. Verify the SDK loader and Game Ready indicators in the Yandex debug panel.
5. Test room creation/joining, reconnects, and ad callbacks.
