(function () {
  "use strict";

  const state = {
    ysdk: null,
    initialized: false,
    readySent: false,
    gameplayRequested: false,
    gameplayRunning: false,
    platformPaused: false,
    visibilityPaused: false
  };

  function api() {
    return state.ysdk && state.ysdk.features ? state.ysdk.features : {};
  }

  function syncGameplay() {
    const shouldRun = state.gameplayRequested &&
      !state.platformPaused &&
      !state.visibilityPaused &&
      document.visibilityState === "visible";

    const gameplay = api().GameplayAPI;
    if (!gameplay) return;

    if (shouldRun && !state.gameplayRunning) {
      state.gameplayRunning = true;
      try { gameplay.start(); } catch (error) { console.warn("[Kazo/Yandex] GameplayAPI.start failed", error); }
    } else if (!shouldRun && state.gameplayRunning) {
      state.gameplayRunning = false;
      try { gameplay.stop(); } catch (error) { console.warn("[Kazo/Yandex] GameplayAPI.stop failed", error); }
    }
  }

  function startGameplay() {
    state.gameplayRequested = true;
    syncGameplay();
  }

  function stopGameplay() {
    state.gameplayRequested = false;
    syncGameplay();
  }

  function markReady() {
    if (!state.ysdk || state.readySent || !document.body) return;
    state.readySent = true;
    try {
      api().LoadingAPI && api().LoadingAPI.ready();
    } catch (error) {
      console.warn("[Kazo/Yandex] LoadingAPI.ready failed", error);
    }
  }

  function pauseForAd() {
    const wasRunning = state.gameplayRequested;
    state.platformPaused = true;
    syncGameplay();
    return wasRunning;
  }

  function resumeAfterAd(wasRunning) {
    state.platformPaused = false;
    if (wasRunning) state.gameplayRequested = true;
    syncGameplay();
  }

  function showFullscreenAd() {
    const adv = state.ysdk && state.ysdk.adv;
    if (!adv || typeof adv.showFullscreenAdv !== "function") return Promise.resolve(false);
    const wasRunning = pauseForAd();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (shown) => {
        if (settled) return;
        settled = true;
        resumeAfterAd(wasRunning);
        resolve(!!shown);
      };
      try {
        adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown) => finish(wasShown),
            onError: (error) => {
              console.warn("[Kazo/Yandex] Fullscreen ad failed", error);
              finish(false);
            }
          }
        });
      } catch (error) {
        console.warn("[Kazo/Yandex] Fullscreen ad failed", error);
        finish(false);
      }
    });
  }

  function showRewardedVideo() {
    const adv = state.ysdk && state.ysdk.adv;
    if (!adv || typeof adv.showRewardedVideo !== "function") return Promise.resolve(false);
    const wasRunning = pauseForAd();
    return new Promise((resolve) => {
      let rewarded = false;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resumeAfterAd(wasRunning);
        resolve(rewarded);
      };
      try {
        adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => { rewarded = true; },
            onClose: finish,
            onError: (error) => {
              console.warn("[Kazo/Yandex] Rewarded video failed", error);
              finish();
            }
          }
        });
      } catch (error) {
        console.warn("[Kazo/Yandex] Rewarded video failed", error);
        finish();
      }
    });
  }

  window.KazoYandexSDK = {
    get instance() { return state.ysdk; },
    get isReady() { return state.initialized && state.readySent; },
    startGameplay,
    stopGameplay,
    showFullscreenAd,
    showRewardedVideo
  };

  window.addEventListener("load", markReady, { once: true });
  window.addEventListener("pagehide", stopGameplay);
  document.addEventListener("visibilitychange", () => {
    state.visibilityPaused = document.visibilityState !== "visible";
    syncGameplay();
  });

  async function initialize() {
    if (!window.YaGames || typeof window.YaGames.init !== "function") {
      console.info("[Kazo/Yandex] SDK is not available in this environment; browser preview continues without it.");
      return;
    }
    try {
      state.ysdk = await window.YaGames.init();
      state.initialized = true;
      window.ysdk = state.ysdk;

      state.ysdk.on && state.ysdk.on("game_api_pause", () => {
        state.platformPaused = true;
        syncGameplay();
      });
      state.ysdk.on && state.ysdk.on("game_api_resume", () => {
        state.platformPaused = false;
        syncGameplay();
      });

      markReady();
      syncGameplay();
      window.dispatchEvent(new CustomEvent("kazo:yandex-sdk-ready", { detail: state.ysdk }));
    } catch (error) {
      console.error("[Kazo/Yandex] SDK initialization failed", error);
    }
  }

  initialize();
})();