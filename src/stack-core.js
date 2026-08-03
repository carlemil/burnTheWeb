  // ---- the effect STACK ------------------------------------------------------
  // A scene is an ordered list of effects composited into the one heat buffer, not a
  // single effect. Deliberately NOT called "layers" anywhere in the code: `layers` is
  // already a control key (layerCount / LAYER_MAX — the count of progressively smaller
  // copies of the *fractal*), and it is persisted in every states[e]. "Layer" is the
  // user-facing word in the menu and the README only.
  //
  // An item carries only what belongs to one effect. The palette, the filter chain,
  // the camera, beat tuning and slider ranges are scene-level and live where they
  // always did — see snapshotScene.
  //
  // `state`/`beat`/`pulse`/`plen` are frozen copies, and are NULL while the item is
  // selected: the selected item's live store is the DOM, exactly as it has always
  // been. Exactly one of "selected" / "holds numbers" is true for an item, ever.
  function newStackItem(fx) {
    // `palette`/`filters` are per-LAYER (not per-effect), so two layers of the same
    // effect can look different. null means "not captured yet" — applyLayerExtras fills
    // them from the effect's stored/default extras on first use. They can't be seeded
    // here: this runs at `let stack = […]` before EFFECTS / presetExtra exist (TDZ).
    return { fx, state: null, beat: null, pulse: null, plen: null,
      palette: null, paletteRev: null, paletteBg: null, filters: null, ranges: null,
      seedPath: null, seedRide: null, seedPts: null, showBox: null,
      blend: "max", gain: 1, mute: false, anim: {}, phase: Object.assign({}, PHASE_INIT) };
  }
  let stack = [newStackItem(0)], stackSel = 0;
  const selItem = () => stack[stackSel];
  // Display zoom is scene-level and applied ONCE, to the composite. An effect that
  // bakes zoom into its own shader has already consumed it, so applying it again would
  // zoom that item twice. "Any", not "all": an unzoomed point item is a smaller lie
  // than a doubly-zoomed fractal. A one-item stack reduces to the original rule exactly.
  // Visible consequence, and intended: adding a shader item to a point scene un-zooms
  // the point item.
  // Display zoom for the composite. EVERY effect in the registry now bakes its own zoom —
  // the shaders divide their coordinates by it, the point effects scale the stamp in
  // plot() — so in practice this always returns 1 and the FS_ZOOM pass is an identity.
  // Kept as-is rather than ripped out: it is the one place that would have to come back if
  // an effect ever zoomed by magnification again, the CPU path reads it too, and at z == 1
  // the pass samples exact texel centres, so it costs a blit and changes nothing.
  // Its old job — one un-baked point layer beside a baking shader layer un-zoomed the point
  // layer — is gone with it: every layer zooms itself now, so a mixed stack is correct.
  const stackZoom = () => stack.some(L => !L.mute && EFFECTS[L.fx].bakesOwnZoom) ? 1 : zoom;
  // The four accessors that make the "DOM is the selected item's store" rule work.
  // With a one-item stack they all short-circuit to today's singletons on every call,
  // which is what makes the stack refactor inert rather than merely tested.
  function bandOf(L, id) {
    if (L === stack[stackSel]) { const a = anims[id]; return a ? [+a.lo.value, +a.hi.value] : null; }
    const v = L.state && L.state[id];
    return Array.isArray(v) ? v : null;
  }
  const beatOf = (L, id) => L === stack[stackSel] ? beatReact[id] : (L.beat && L.beat[id]);
  const shapeOf = (L, id) => L === stack[stackSel] ? pulseShape[id] : (L.pulse && L.pulse[id]);
  const plenOf = (L, id) => L === stack[stackSel] ? pulseLen[id] : (L.plen && L.plen[id]);
  // The selected item's animation phase IS the singleton animPhase record — not a copy
  // seeded from it. Seeding lazily from the DOM instead would diverge on the first
  // frame for any slider whose thumbs moved between wiring and the first tick (restore,
  // loadState), because the original code seeds `val` once at bind time and never again.
  function itemAnim(L, id) {
    if (L === stack[stackSel]) return animPhase[id];
    return L.anim[id] || (L.anim[id] = newPhase(bandOf(L, id) ? bandOf(L, id)[0] : 0));
  }
  const anims = {};
  // Mutable animation phase, split out of the anims entry: `val` is where the erratic
  // drift currently sits, `out` is the value last handed to apply() (they differ while
  // a slider is beat-armed — the pulse must NOT move the drift position, or a slider
  // resumes drifting from wherever the last beat left it). One record per key today;
  // one record per key PER LAYER once effects stack.
  const animPhase = {};
  const newPhase = v => ({ val: v, out: v, from: v, to: v, t0: 0, dur: 1, pulse: 0 });
  const beatReact = {};        // id -> {low,mid,high} : which bands kick this slider (per-effect)
  const chipEls = {};          // id -> {low,mid,high} : the chip <button>s (never persisted)
  const dotEls = {};           // id -> {low,mid,high} : the menu row's beat dots (ditto)
  const PULSE_DROP = CONFIG.pulse.drop;   // s for a beat pulse to fall from the high thumb back to the low — now only the DEFAULT
  const PLEN_MIN = CONFIG.pulse.min, PLEN_MAX = CONFIG.pulse.max;   // bounds of the per-slider pulse-length slider (s)

  // Beat-pulse SHAPE (per slider, per effect). On a beat an armed slider snaps to
  // its high thumb and `a.pulse` decays linearly 1→0 over PULSE_DROP; the chosen
  // envelope reshapes that decay into the value actually applied. Each fn maps the
  // linear phase p (1 at the beat, 0 at rest) to an amplitude in [0,1] — so the
  // value stays inside [lo,hi] whatever the shape. `snap` is the identity = the
  // original linear fall, i.e. the default preserves prior behaviour exactly.
  const PULSE_SHAPES = [
    { key: "snap",    name: "Snap",    fn: p => p },                                          // linear (default)
    { key: "pluck",   name: "Pluck",   fn: p => p * p },                                      // fast percussive release
    { key: "sustain", name: "Sustain", fn: p => p * (2 - p) },                                // holds high, then drops
    { key: "ease",    name: "Ease",    fn: p => p * p * (3 - 2 * p) },                         // smooth S-curve fall
    { key: "bounce",  name: "Bounce",  fn: p => Math.abs(Math.cos((1 - p) * Math.PI * 2.5)) * p },  // decaying bounces
    { key: "steps",   name: "Steps",   fn: p => Math.ceil(p * 5) / 5 },                        // retro quantized decay
  ];
  const PULSE_FN = {}; PULSE_SHAPES.forEach(s => PULSE_FN[s.key] = s.fn);
  const PULSE_DEFAULT = "snap";
  const pulseShape = {};       // id -> shape key : live per-effect selection (drives updateAnims)
  const pulseEls = {};         // id -> <select> : the shape pickers (never persisted)
  // Beat-pulse LENGTH (per slider, per effect): how long that decay takes. It used
  // to be the hardcoded PULSE_DROP for every slider; each slider now owns its own,
  // set by a small range in its pop-out box, so a kick can flick one param and
  // swell another. PULSE_DROP stays the default, so untouched scenes are unchanged.
  const pulseLen = {};         // id -> seconds : live per-effect value (drives updateAnims)
  const plenEls = {};          // id -> {inp,out} : the length slider + readout (never persisted)
  // Three L/M/H toggle chips next to a slider's label, feeding beatReact[id].
  function makeChips(id, label) {
    beatReact[id] = { low: false, mid: false, high: false };
    chipEls[id] = {};
    const wrap = document.createElement("span");
    wrap.className = "bandchips";
    for (const k of ["low", "mid", "high"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = k[0].toUpperCase();
      btn.title = k + " beat";
      btn.addEventListener("click", () => {
        beatReact[id][k] = !beatReact[id][k];
        btn.classList.toggle("on", beatReact[id][k]);
        syncDots();              // the menu row shows the same armed state
        // A <button> click fires neither input nor change, so the delegated onEdit
        // never sees it — do its job by hand, autosave included. Without the
        // autosave the chip reached localStorage but not the *selected preset*,
        // so re-selecting that preset silently disarmed it again.
        chipEdited();
      });
      wrap.appendChild(btn);
      chipEls[id][k] = btn;
    }
    // Shape picker: how this slider's value animates back down after a beat. Its
    // `change` bubbles to the panel's delegated onEdit, which persists + autosaves,
    // so we only update the live value here (like the palette <select>).
    const psel = document.createElement("select");
    psel.className = "pulsesel";
    psel.title = "Beat pulse shape";
    PULSE_SHAPES.forEach(s => psel.appendChild(new Option(s.name, s.key)));
    psel.value = PULSE_DEFAULT;
    psel.addEventListener("change", () => { pulseShape[id] = psel.value; });
    pulseEls[id] = psel;
    pulseShape[id] = PULSE_DEFAULT;
    // ---- pop-out box layout: value on top, then the SLIDER, then the beat controls ----
    // The chips used to be tucked into the label's right edge, above the slider. They are
    // their own titled block under it now, because the slider is the thing you are actually
    // tuning and it should sit directly under its own name and readout; the beat wiring is
    // a second subject and reads better labelled than inferred from three lettered buttons.
    //
    // Appended to the .ctl (label.parentNode), which at this point holds only [label,
    // slider] — so appending lands everything after the slider, in the order added. The
    // owner line is prepended and the range editor appended later, so both still bracket
    // this correctly.
    const host = label.parentNode;
    const trigT = document.createElement("div");
    trigT.className = "trig-t"; trigT.textContent = "Triggers";
    trigT.title = "Which beat bands make this slider jump";
    host.append(trigT, wrap);
    // The fall-back CURVE, titled like everything else here rather than left as an unlabelled
    // dropdown floated to the right of the chips. Named "Trigger shape" to match "Trigger
    // duration" — the two describe the same fall together, one its curve and one its length.
    const shapeT = document.createElement("div");
    shapeT.className = "trig-t"; shapeT.textContent = "Trigger shape";
    shapeT.title = "The curve this slider follows on its way back down after a trigger";
    host.append(shapeT, psel);
    // How long that jump takes to fall back, for THIS slider. Title above its own slider
    // rather than inline, to match the control it belongs to.
    pulseLen[id] = PULSE_DROP;
    const durT = document.createElement("div");
    durT.className = "plen-name"; durT.textContent = "Trigger duration";
    const row = document.createElement("div");
    row.className = "plen";
    const sl = document.createElement("input");
    sl.type = "range"; sl.id = "plen-" + id; sl.min = PLEN_MIN; sl.max = PLEN_MAX; sl.step = 0.01; sl.value = PULSE_DROP;
    sl.title = "How long a trigger takes to fall back";
    sl.setAttribute("aria-label", "Trigger duration");
    const out = document.createElement("span");
    out.className = "plen-val"; out.textContent = plenFmt(PULSE_DROP);
    sl.addEventListener("input", () => { pulseLen[id] = +sl.value; out.textContent = plenFmt(+sl.value); });
    row.append(sl, out);
    plenEls[id] = { inp: sl, out };
    host.append(durT, row);              // foot of the control block (above the range editor)
  }
  const plenFmt = v => (v < 1 ? Math.round(v * 1000) + "ms" : v.toFixed(2) + "s");
  function bindRange(id, valId, fmt, apply, durScale, beat, scene) {
    const lo = ctl(id + "-lo"), hi = ctl(id + "-hi"), out = ctl(valId);
    const fill = lo.closest(".dual").querySelector(".fill");
    // a11y: each dual slider is two anonymous inputs — name the low/high thumbs.
    const lbl = lo.closest(".dual").previousElementSibling;
    const nm = (lbl && lbl.childNodes[0] ? lbl.childNodes[0].nodeValue : id).trim();
    lo.setAttribute("aria-label", nm + " (low)");
    hi.setAttribute("aria-label", nm + " (high)");
    // The DEFINITION lives here; the mutable animation PHASE lives in animPhase[id]
    // (see newPhase). They are split because a stack of effects needs one phase record
    // per layer per key while sharing one definition, one pair of DOM thumbs and one
    // apply closure. With a single layer there is exactly one phase record and the
    // behaviour is identical.
    // `scene` marks a control that belongs to the whole scene rather than to one
    // effect — the palette, banding, the camera, display zoom and every filter param.
    // Those animate once per frame no matter how many effects are stacked. Derived
    // from CONTROLS (host/group), NOT from the FILTERS registry, which is defined
    // further down the file and does not exist yet when this wiring runs.
    const a = anims[id] = { lo, hi, apply, name: nm, durScale: durScale || 1, scene: scene !== false };
    animPhase[id] = newPhase(+lo.value);
    function ui() {
      // min/max are read live, not closed over: each box's range editor
      // rewrites them at runtime and the fill must follow.
      const mn = +lo.min, mx = +lo.max, span = (mx - mn) || 1;
      const A = Math.min(+lo.value, +hi.value), B = Math.max(+lo.value, +hi.value);
      fill.style.left = (A - mn) / span * 100 + "%";
      fill.style.width = (B - A) / span * 100 + "%";
      // READOUT ONLY — never the applied value, which stays a free float (see stepAnim).
      // A slider whose range spans more than 1 gets at most one decimal: three significant
      // digits is right for a 0–1 knob but absurd on a wider one, where it produced readouts
      // like "0.00815×–1.5×" for a bloom that goes to 1.5. Rounding before fmt keeps each
      // control's own units and suffixes intact, and sig3 of an already-1dp number is that
      // same number, so nothing narrower than 1 changes.
      const show = v => fmt(mx - mn > 1 ? Math.round(v * 10) / 10 : v);
      out.textContent = A === B ? show(A) : show(A) + "–" + show(B);
    }
    a.ui = ui;
    lo.addEventListener("input", () => { if (+lo.value > +hi.value) hi.value = lo.value; ui(); });
    hi.addEventListener("input", () => { if (+hi.value < +lo.value) lo.value = hi.value; ui(); });
    if (beat !== false) makeChips(id, lo.closest(".dual").previousElementSibling);
    ui(); apply(animPhase[id].val);
  }
  // A control belongs to the SCENE rather than to one effect when it is not an effect
  // control (palette, banding) or the shared camera/display zoom. Everything else — every
  // effect param, AND now most filter params — is owned per stacked LAYER, so each effect
  // in a stack carries its own filter settings (each layer runs its own filter chain, see
  // renderStackColor). The exceptions stay scene-wide because they act on the ONE finished
  // image, not a layer: the sim tick-rate `burn` (a shared clock), the glow `bloom`, and
  // the four "screen" filters (Scanlines / Vignette / Film grain / Barrel).
  const SHARED_FILTER_KEYS = new Set(["burn", "bloom", "barrel", "scan", "scancount", "vignette", "grain"]);
  // Hosts whose sliders are PER-LAYER. "fx" is every effect slider, including the whole camera
  // group (zoom AND camera X/Y/Z) — each stacked effect samples its own space, so it holds its
  // own camera, pushed into camRX/RY/RZ by installStackItem before that layer draws.
  // "band" (banding) and "pal" (palette cycle/hold) are here because their values ALREADY live
  // per-effect in states[e], so loadState rewrote these supposedly scene-wide globals on every
  // layer selection — selecting a layer visibly re-banded the scene and changed its cycle timing.
  // They are per-layer in the render too: bakeLayerBytes bands each layer's own ramp and
  // stepLayerPal runs each layer's own clock, so nothing had to change downstream.
  const LAYER_HOSTS = new Set(["fx", "band", "pal"]);
  const isSceneCtl = c => c.host === "filter"
    ? SHARED_FILTER_KEYS.has(c.key)                       // filter params: per-layer unless shared
    : !LAYER_HOSTS.has(c.host);                           // TTL / transition / the scene filters stay scene-wide
  // Wire every generated dual slider from the schema (fmt/apply/durScale live in CONTROLS).
  CONTROLS.filter(c => c.type === "dual").forEach(c => bindRange(c.key, c.valId, c.fmt, c.apply, c.durScale, c.beat, isSceneCtl(c)));
  // Effect TTL is a range in *seconds*, not an animated value: each effect is
  // held for a random time drawn from [lo,hi] before switching. lo=hi=0 ⇒ never
  // switch. No-op apply; its thumbs are read directly by the cycler.
  bindRange("ttl", "vTtl", v => sig3(v) + "s", () => {}, 1, false, true);   // no chips; scene-level
  // Transition length, same shape as TTL: a range in seconds, read per switch by
  // transBegin. Pinch both thumbs to 0 for a hard cut. No chips, no per-effect state.
  bindRange("tdur", "vTdur", v => v <= 0 ? "cut" : sig3(v) + "s", () => {}, 1, false, true);

  // Advance ONE slider's animation by one frame. `a` is the definition (anims[id]),
  // `st` the mutable phase — a separate argument because a stack of effects keeps one
  // phase record per layer against the same definition. The band [mn,mx], the beat
  // arming, the pulse shape and the pulse length are all passed in for the same reason:
  // for the selected layer they come from the DOM and the singleton maps, for any other
  // layer from that layer's stored copy.
  // `doApply` false computes the value without touching the global, so the stack loop
  // can install each layer's values immediately before that layer draws.
  // Snap an animated value onto the slider's step grid, so an animating slider only ever
  // lands on values a manual drag could — a slider [3,11] step 2 sits on 3/5/7/9/11 and
  // never 6 or 5.5. Anchored to the slider's `min` (native HTML range semantics — a drag
  // snaps to min + n·step), then clamped into the live band. Only the OUTPUT is snapped;
  // the drift integrator (st.val) stays continuous so the motion between grid points is
  // smooth and can't get wedged. step "any"/0 ⇒ returned unchanged.
  function snapStep(a, v, mn, mx) {
    const step = a.lo ? +a.lo.step : NaN;
    if (!(step > 0)) return v;
    const base = +a.lo.min;
    const q = base + Math.round((v - base) / step) * step;
    return q < mn ? mn : q > mx ? mx : q;
  }
  function stepAnim(a, st, mn, mx, br, shape, plen, now, dt, doApply) {
    // Armed: audio reaching the visual and at least one L/M/H chip selected. Armed sliders
    // stop drifting and only move on a beat — snap to the high thumb, drop back to
    // the low thumb over this slider's own pulse length (default PULSE_DROP).
    // audioLive(), not audio.on, so muting drops straight through to the wander below
    // instead of leaving every armed slider parked at its low thumb with no beats coming.
    const armed = audioLive() && br && (br.low || br.mid || br.high);

    if (armed) {
      const beat = (br.low && audio.beatNow[0]) || (br.mid && audio.beatNow[1]) || (br.high && audio.beatNow[2]);
      const drop = plen > 0 ? plen : PULSE_DROP;
      if (beat) st.pulse = 1;                                    // immediate, significant
      else st.pulse = st.pulse - dt / drop > 0 ? st.pulse - dt / drop : 0;
      const fn = PULSE_FN[shape] || PULSE_FN[PULSE_DEFAULT];
      // Deliberately writes `out`, not `val`: the drift position must survive the
      // pulse untouched, so unarming resumes the wander where it left off.
      st.out = snapStep(a, mn + fn(st.pulse) * (mx - mn), mn, mx);   // rest at mn, snap to mx, decay back along the chosen curve
      if (doApply) a.apply(st.out);
      return;
    }

    // otherwise: erratic wander between [mn,mx] (pinned ⇒ constant)
    if (mx - mn < 1e-9) {
      st.val = mn;
    } else {
      let f = (now - st.t0) / st.dur;
      if (f >= 1) {                      // begin a fresh erratic segment
        st.from = st.val;
        st.to = mn + Math.random() * (mx - mn);
        st.t0 = now; st.dur = (350 + Math.random() * 1650) * a.durScale;
        f = 0;
      }
      const s = f * f * (3 - 2 * f);     // smoothstep between targets
      st.val = st.from + (st.to - st.from) * s;
      st.val = st.val < mn ? mn : st.val > mx ? mx : st.val;
    }
    st.out = snapStep(a, st.val, mn, mx);
    if (doApply) a.apply(st.out);
  }
  // The loop is KEY-major, not item-major, and that ordering is load-bearing: every
  // fresh drift segment draws twice from Math.random, so stepping key-by-key keeps a
  // one-item stack drawing in exactly the sequence the un-stacked code did, and the
  // rendered frames stay bit-identical. Item-major would be equally correct and would
  // silently change every scene.
  // Scene keys (palette, banding, camera, zoom, filter params) step once from the DOM
  // and apply immediately — frame() reads cfg.burn, cfg.decay, zoom and bloomAmt
  // between here and the draw. Layer keys are computed only; installStackItem() puts
  // each item's values into the globals just before that item draws.
  function updateAnims(now, dt) {
    for (const id in anims) {
      const a = anims[id];
      if (a.scene) {
        const mn = Math.min(+a.lo.value, +a.hi.value), mx = Math.max(+a.lo.value, +a.hi.value);
        stepAnim(a, animPhase[id], mn, mx, beatReact[id], pulseShape[id], pulseLen[id], now, dt, true);
        continue;
      }
      for (const L of stack) {
        const b = bandOf(L, id);
        if (!b) continue;                 // this item's effect doesn't carry the key
        stepAnim(a, itemAnim(L, id), Math.min(b[0], b[1]), Math.max(b[0], b[1]),
          beatOf(L, id), shapeOf(L, id), plenOf(L, id), now, dt, false);
      }
    }
  }
  // Push one stack item's animated values into the module-level globals the effects
  // read (plasmaSpeed, cfg.points, juliaOuterR, …). Scene keys are skipped — they were
  // applied in updateAnims and must not be rewritten per item.
  function installStackItem(L) {
    for (const id in anims) {
      const a = anims[id];
      if (a.scene) continue;
      const st = L === stack[stackSel] ? animPhase[id] : L.anim[id];
      if (st) a.apply(st.out);
    }
    // "layers" (the per-effect object / fractal-copy count) is a −/+ stepper, not a ranged
    // slider, so it is NOT in `anims` above and was never installed per item — layerCount kept
    // the SELECTED layer's value. With two point layers that meant the visible layer's object
    // count jumped to whatever layer you selected. Install it per item: the selected item's
    // store is the DOM (#layers), a frozen item's is L.state.layers.
    const lv = (L === stack[stackSel]) ? +ctl("layers").value : (L.state ? L.state.layers : layerCount);
    layerCount = Math.max(1, Math.min(LAYER_MAX, (lv | 0) || 1));
    camMat();       // camera X/Y/Z are per-layer now — refold camM for THIS layer's angles, so
                    // plot()'s point stamping and the CPU mirrors rotate about this layer's camera
                    // (the GL shaders read camRX/RY/RZ live for uCam, so they need nothing here)
    showBox = layerShowBox(L);   // ...and the box belongs to the LAYER, not to whatever is selected
    if (EFFECTS[L.fx].cardioid) installSeedPath(L);
    // Bouncing solids carries a list of rigid bodies, not a scalar clock, so it can't ride
    // PHASE_VARS — it follows the tetrahedron's L.tetras arrangement instead: the bodies
    // live on the layer and this points the globals at THIS layer's set before it draws.
    // Without it two Bouncing solids layers would share one set and render as one.
    if (EFFECTS[L.fx].solids) installSolids(L);
  }
  // Seed-path config is PER-LAYER (L.seedPath/seedRide/seedPts), so two layers of the same
  // effect keep separate orbits. The render loop installs each layer's config into the seed
  // globals before it draws; the epilogue restores the selected layer's, which is what the
  // editor (cardDraw) reads. A layer that hasn't captured its own — a fresh layer, or a scene
  // saved before per-layer seed — falls back to the effect's extras. The spline is cached per
  // layer by the points array's identity, so it recompiles only when those points change (an
  // edit swaps in a NEW array, which is what invalidates it — never mutate seedPts in place).
  const seedSplineCache = new WeakMap();
  // The fallback for a layer that hasn't captured its own seed is the DESCRIPTOR default
  // (presetExtra ⇒ empty freehand / cardioid), NOT the runtime `extras[L.fx]`. extras is the
  // per-effect *last-used* value that `saveExtra` overwrites on every edit, so falling back to
  // it made every not-yet-drawn same-effect layer mirror the last loop drawn — the "all layers
  // share one polygon" bug. A layer with a concrete `L.seedPts` (drawn, or loaded from a scene
  // that stored it) is unaffected either way.
  function layerSeedPts(L) {
    return L.seedPts != null ? L.seedPts : presetExtra(L.fx).seedPts;
  }
  function seedSplineFor(L) {
    const pts = layerSeedPts(L), c = seedSplineCache.get(L);
    if (c && c.pts === pts) return c.sp;
    const sp = buildSeedSpline(pts);
    seedSplineCache.set(L, { pts, sp });
    return sp;
  }
  function installSeedPath(L) {
    const fx = presetExtra(L.fx);
    seedPathMode = seedModeOk(L.seedPath != null ? L.seedPath : fx.seedPath);
    seedRideOn = (L.seedRide != null ? L.seedRide : fx.seedRide) !== false;
    seedPts = layerSeedPts(L);
    seedSpline = seedSplineFor(L);
  }
  // Capture the live seed globals into a layer — its orbit path, remembered per layer.
  function captureSeed(L) {
    L.seedPath = seedPathMode;
    L.seedRide = seedRideOn;
    L.seedPts = seedPts;
  }

  const effectSel = el("effect");
  const sub = el("sub");
  const grpTtl = el("grp-ttl");   // effect-specific groups are shown/hidden via each descriptor's `controls`
  // Preset TTL only matters while auto-cycle is on — gray it out and block input
  // (plus disable the thumbs for keyboard) when the cycle toggle is off.
  function syncTtlEnabled() {
    const on = cycleChk.checked;
    grpTtl.classList.toggle("ctl-off", !on);
    el("ttl-lo").disabled = el("ttl-hi").disabled = !on;
  }
  const paletteSel = el("palette");
