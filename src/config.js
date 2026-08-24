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
    version: "1.45.0",
    changelogUrl: "https://github.com/carlemil/burnTheWeb/blob/main/CHANGELOG.md",

    // --- effect stack / fractal layering ---
    stackMax: 4,          // max effects composited into one scene        (STACK_MAX)
    layerMax: 6,          // max progressively-smaller fractal copies      (LAYER_MAX)

    // --- initial live fire state (cfg). scale is the DEFAULT resolution: 1 Full … 4 Potato ---
    fire: { points: 1500, speed: 0.92, decay: 129, scale: 1, burn: 120 },

    // --- scene knobs that are global, NOT per-preset (auto-cycle, TTL, transition) ---
    scene: { autoCycle: true, ttl: [10, 30], transition: [0.45, 0.9] },   // ttl/transition in seconds [min,max]

    // --- the colour that says WHICH LAYER a box belongs to ---
    // With several layer boxes and their sliders scattered over the grid, "L2 · Plasma" in
    // 9px uppercase is the only thing tying a box to its layer. A colour reads at a glance
    // and from the corner of the eye, which the label does not.
    //
    // One per stack slot, assigned by position on creation and overridable per layer. Picked
    // to stay legible against the app's amber-on-near-black and to be distinguishable from
    // each other at a 1px border width — amber is deliberately NOT among them, or the tint
    // would disappear into the untinted chrome. Order matters: slot 0 takes the first.
    layerTint: ["#5ac8ff", "#7fe08a", "#ff7ad4", "#ffd24a"],

    // --- startup credits overlay, and the per-scene title that follows it ---
    // The scene title rides the SAME canvas and the same rendered-time countdown, so it is
    // configured here beside them. Shorter than the credits on purpose: it fires on every
    // scene change, including each auto-cycle tick, so it has to read and get out of the way.
    credits: { hold: 5, fade: 3, on: true,          // seconds at full / fade seconds / shown on first visit
               titleHold: 2.5, titleFade: 1.5, titleOn: true },   // ...same three for the scene title

    // --- palette ---
    paletteMorphMs: 8000, // fallback auto-morph duration; live value comes from the slider (MORPH_MS)
    bandCount: 18,        // posterized flat colours across a banded ramp   (BAND_COUNT)

    // --- beat-driven slider pulse ---
    pulse: { drop: 0.2, min: 0.02, max: 1 },   // default fall time (s); per-slider length slider bounds (s) = 20–1000 ms

    // --- audio beat detector: the SHIPPED tuning (a preset's beatTune overrides per-scene) ---
    // The mid band starts at 250, not 150, which leaves 150–250 Hz in NEITHER band on
    // purpose. That octave is bass-guitar and low-synth territory — sustained pitched
    // material that is not a kick and not a snare, so feeding it to either band only
    // dilutes that band's flux with notes. Low keeps 30–150 (the kick fundamental) and mid
    // starts above the muddle. Bands never had to be contiguous; they are narrow by design
    // (see the detector notes in CLAUDE.md), and the gap is the same idea taken one step.
    // Per-SCENE data, so this is the default a scene starts from: a preset that stored its
    // own `bands` keeps them, and only one saved without them picks this up.
    beatDefaults: { fluxK: [2.0, 2.0, 2.0], floor: 0.10,                  // flux threshold per band; global floor
      refract: [110, 100, 70], bands: [[30, 150], [250, 2500], [2500, 12000]] },  // refractory ms / Hz edges per band

    // --- incoming payload codec safety ---
    // Budget for DECOMPRESSING any incoming deflated payload (?z= links, #zp= bundles,
    // cloud profiles, #c= scenes). Deflate expands up to ~1032:1, so a payload that
    // passes the rules' 300k-char cap could still balloon to ~300 MB in THIS tab
    // before any validator runs — a zip bomb from any published profile or link.
    // 10 MB is ~30× the largest legitimate library measured; unzipFromB64 aborts past it.
    maxUnzipBytes: 10000000,                      // (UNZIP_MAX)

    // --- "Sync with your music" nudge + analytics ---
    sync: { delays: [30000, 300000, 3600000] },   // active-tab ms before each of the (max 3) nudges (SYNC_DELAYS)
    analyticsId: "G-7CMDJP72N7",                  // GA4 Measurement id; "" makes analytics completely inert

    // --- cloud profiles (Firebase Auth + Firestore, over REST; no SDK) ---
    // apiKey "" makes the WHOLE feature inert: no Google script is loaded, no request is
    // made, and the Cloud row is hidden from the menu — the same kill switch analyticsId
    // above has. Fill both in from the Firebase console (Project settings → Web app) to
    // turn it on.
    //
    // ┌─ THE apiKey BELOW IS NOT A SECRET, AND SECRET SCANNERS WILL FLAG IT ANYWAY ─────┐
    // A Firebase *web* API key is a project IDENTIFIER, not a credential: it selects which
    // project a request is for, and grants nothing on its own. It has to reach the browser
    // for the app to work, so it is in this file, in dev-index.html, and in index.html —
    // there is nowhere to hide it and nothing is gained by trying. Rotating it changes the
    // string and nothing else, since the replacement is equally public.
    //
    // What actually protects the data:
    //   1. firestore.rules (repo root) — the authorization boundary. Verified live: an
    //      unauthenticated read of a private profile, an unauthenticated write, and an
    //      unfiltered listing are all denied.
    //   2. Only Google sign-in is enabled, so the key cannot be used to mint accounts
    //      (accounts:signUp returns ADMIN_ONLY_OPERATION). Do NOT enable Anonymous or
    //      Email/Password sign-in without re-checking that — those turn this key into a
    //      way for anyone to create users on the project.
    //   3. The key is restricted in Google Cloud Console (Credentials → this key) by HTTP
    //      referrer to the site's own origins, and to only the APIs used: Identity Toolkit,
    //      Token Service, Cloud Firestore. That is what limits quota abuse from elsewhere.
    // GitHub secret-scanning alert #1 is resolved as intentional on exactly this basis.
    // └────────────────────────────────────────────────────────────────────────────────┘
    cloud: {
      apiKey: "AIzaSyB_VfQ6W0ui79rMzHrYvbe8f_1OkSSymRM",   // public identifier, see above ⇒ "" = feature off
      projectId: "burntheweb-3cd05",              // Firebase project id
      clientId: "180474887753-jf22fn1kgkecamc2inr2eoomh0e1e0j4.apps.googleusercontent.com",
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
      // Extra outward push at FRACTIONAL Multibrot powers, peaking at half-integers and
      // exactly 0 at whole numbers (windowed by 4·f·(1−f)). The true fractional locus is
      // lopsided (principal branch) and bulges past the blended integer cardioids the seed
      // rides; 0.3 measured all fractional powers into the same ~15–22%-inside band as the
      // integers (0 gave 22–59%), while 0.4 overshot into thin, dusty Julia sets.
      juliaFracBoost: 0.3,   //                                            (JULIA_FRAC_BOOST)
      juliaEaseA: 0.5,    // cardioid lap-speed easing amplitude; EASE_K is derived  (JULIA_EASE_A)
      // Heat every chaos-game / attractor point stamps, 0..255.                    (POINT_HEAT)
      // NOT 255, and that is the whole point. Measured over the catalog: 14 of 19 palettes
      // are near-white at index 255 (Fire, Grayscale, C64, CGA and Chrome are literally
      // [255,255,255]) — the hot core a fire ramp is meant to have. Every point stamped at
      // exactly 255 therefore drew the fractal in that white whatever palette was selected,
      // and since point effects now ship with NO filters, the raw stamps ARE the picture:
      // the palette looked like it did nothing at all.
      //
      // 209 (0.82) sits below the white tip and inside the saturated band — 17 of 19 palettes
      // now draw in colour (Matrix green, Ice cyan, Copper copper). The two that don't are
      // Fire and Grayscale, which are achromatic at the top BY DESIGN and stay white/grey at
      // any value down to ~150; lowering further would only dim the rest for no gain. With
      // the Fire filter ticked on, the flame runs the ramp downward from here exactly as
      // before, just starting a hair lower.
      pointHeat: 209,
      // Ceiling on the zoom density compensation (see zoomPoints). Zooming the point
      // GEOMETRY rather than the picture spreads the stamps over zoom² the area, so the
      // count follows zoom² to hold stamps-per-screen-area steady — but that is unbounded,
      // and the slider's max is only a default the per-slider range editor can raise.
      //
      // 8, not the 16 that zoom 4 would ask for, and the reason is measured rather than
      // cautious. zoom² is the AREA rule, but a Sierpiński triangle has dimension ~1.585,
      // so it over-fills by zoom^0.415 — at full compensation zoom 4 came out at 41% of
      // the frame lit against 11.7% at zoom 1, i.e. 3.5× denser than the thing it was
      // meant to match. Halving it still lands comfortably above zoom 1 (measured 25%),
      // so nothing thins out, and it halves the worst case: the chaos game stays on the
      // CPU even on the GPU path, and at 1920×1080 one default Sierpiński layer costs
      // 0.2 ms/frame at zoom 1, 4.4 ms at zoom 4 uncapped — which four stacked point
      // layers at max Points would have turned into a dropped frame all on its own.
      zoomPointCap: 8,
    },
  };
  // ==== end CONFIG ==== (probes slice `const CONFIG =` … this line; keep it)


