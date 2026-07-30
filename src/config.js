  // ============================================================================
  // CONFIG — every DEFAULT that is not part of a preset, in one place.
  //
  // A preset (snapshotScene) carries a whole scene you hand to someone else. These
  // are the app/build-level defaults OUTSIDE that: stack limits, the initial fire
  // state, credits, palette timing, the beat detector's shipped tuning, the "sync
  // your music" nudge, analytics, and the effect/physics tuning constants.
  //
  // Each value below is sourced by exactly one `const NAME = CONFIG.path` at its
  // original site (so hoisting/order is unchanged) — change it HERE, nowhere else.
  // Loaded first (manifest position 1), so every later slice can read it. Some
  // `tuning.*` values are load-bearing maths (see CLAUDE.md) — change with care.
  // ============================================================================
  const CONFIG = {
    // --- release identity ---
    // THE single source of truth for the app version. The menu's footer link reads it, and
    // the /deploy skill bumps it here and writes the matching CHANGELOG.md section — so a
    // released build always names the version whose notes describe it. Semver: patch for
    // fixes, minor for a new effect/filter/control, major for a breaking scene format.
    version: "1.1.0",
    changelogUrl: "https://github.com/carlemil/burnTheWeb/blob/main/CHANGELOG.md",

    // --- effect stack / fractal layering ---
    stackMax: 4,          // max effects composited into one scene        (STACK_MAX)
    layerMax: 6,          // max progressively-smaller fractal copies      (LAYER_MAX)

    // --- initial live fire state (cfg). scale is the DEFAULT resolution: 1 Full … 4 Potato ---
    fire: { points: 1500, speed: 0.92, decay: 129, scale: 1, burn: 120 },

    // --- scene knobs that are global, NOT per-preset (auto-cycle, TTL, transition) ---
    scene: { autoCycle: true, ttl: [10, 30], transition: [0.45, 0.9] },   // ttl/transition in seconds [min,max]

    // --- startup credits overlay ---
    credits: { hold: 5, fade: 3, on: true },   // seconds at full / fade seconds / shown on first visit

    // --- palette ---
    paletteMorphMs: 8000, // fallback auto-morph duration; live value comes from the slider (MORPH_MS)
    bandCount: 18,        // posterized flat colours across a banded ramp   (BAND_COUNT)

    // --- beat-driven slider pulse ---
    pulse: { drop: 0.2, min: 0.02, max: 1 },   // default fall time (s); per-slider length slider bounds (s) = 20–1000 ms

    // --- audio beat detector: the SHIPPED tuning (a preset's beatTune overrides per-scene) ---
    beatDefaults: { fluxK: [2.0, 2.0, 2.0], floor: 0.10,                  // flux threshold per band; global floor
      refract: [110, 100, 70], bands: [[30, 150], [150, 2500], [2500, 12000]] },  // refractory ms / Hz edges per band

    // --- "Sync with your music" nudge + analytics ---
    sync: { delays: [30000, 300000, 3600000] },   // active-tab ms before each of the (max 3) nudges (SYNC_DELAYS)
    analyticsId: "G-7CMDJP72N7",                  // GA4 Measurement id; "" makes analytics completely inert

    // --- cloud profiles (Firebase Auth + Firestore, over REST; no SDK) ---
    // apiKey "" makes the WHOLE feature inert: no Google script is loaded, no request is
    // made, and the Cloud row is hidden from the menu — the same kill switch analyticsId
    // above has. Fill both in from the Firebase console (Project settings → Web app) to
    // turn it on. The web API key is PUBLIC by design: it names the project, it does not
    // authorise anything. firestore.rules (repo root) is the actual authorization boundary.
    cloud: {
      apiKey: "AIzaSyB_VfQ6W0ui79rMzHrYvbe8f_1OkSSymRM",   // Firebase Web API key ⇒ "" = feature off
      projectId: "burntheweb-3cd05",              // Firebase project id
      clientId: "",                               // Google OAuth client id, for the sign-in button
      galleryTtlMs: 300000,                       // cache the gallery listing 5 min (reads are quota)
      galleryLimit: 20,                           // profiles per gallery page
      maxPayload: 300000,                         // must match the cap in firestore.rules
    },

    // --- effect / physics tuning (implementation constants; several are load-bearing) ---
    tuning: {
      hopMs: 10,          // beat-analysis tick, ms — 100Hz, framerate-independent   (HOP_MS)
      nodRate: 0.12,      // Tetrafyer's slow idle nod rate                          (NOD_RATE)
      cardPowQ: 0.05,     // Multibrot locus quantisation = the Power slider's step  (CARD_POW_Q)
      juliaMargin: 0.06,  // push the seed's big loop this far outside the cardioid  (JULIA_MARGIN)
      juliaEaseA: 0.5,    // cardioid lap-speed easing amplitude; EASE_K is derived  (JULIA_EASE_A)
    },
  };
  // ==== end CONFIG ==== (probes slice `const CONFIG =` … this line; keep it)


