  // ---- Geometric shape effects (CPU mirrors of FS_POLYGON / FS_SHAPEGRID / FS_CONCENTRIC
  // / FS_BOUNCE). Each *Seed(dt) advances this frame's phase and is called ONCE per frame
  // in the descriptor's draw hook; the mirror TAKES that seed and never re-seeds, so the
  // Canvas2D path can't advance the clock twice a frame (the trap the cardioid effects hit).
  const SH_TAU = 6.2831853;
  const shMod = (a, b) => a - b * Math.floor(a / b);                 // GLSL mod (handles negatives)
  const shStep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };  // smoothstep (works either direction)
  // Polygon: one rotating regular N-gon; thick=1 filled, →0 a thin outline.
  let pgSides = 5, pgRad = 0.35, pgThick = 1, pgSpinSpeed = 0.4, pgSpin = 0;
  function polygonSeed(dt) { pgSpin += dt * pgSpinSpeed; return { spin: pgSpin, sides: pgSides, rad: pgRad, thick: pgThick, zoom }; }
  function polygon(s) {
    const seg = SH_TAU / s.sides, cs = Math.cos(seg * 0.5), asp = fw / fh, aa = 1.5 / fh, ir = s.rad * (1 - s.thick);
    let idx = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      camPix(x, y);
      const px = (camPX / fw - 0.5) * asp / s.zoom, py = (camPY / fh - 0.5) / s.zoom;
      const a = Math.atan2(py, px) + s.spin, rp = Math.hypot(px, py) * Math.cos(shMod(a, seg) - seg * 0.5) / cs;
      fire[idx++] = Math.max(0, Math.min(1, shStep(s.rad + aa, s.rad - aa, rp) - shStep(ir + aa, ir - aa, rp))) * 255;
    }
  }
  // Shape grid: a tiled lattice of circles↔squares, each cell pulsing out of phase.
  let sgCells = 9, sgDot = 0.3, sgSquare = 0, sgPulse = 0.35, sgSpeed = 1.2, sgTime = 0;
  function shapegridSeed(dt) { sgTime += dt * sgSpeed; return { t: sgTime, cells: sgCells, dot: sgDot, square: sgSquare, pulse: sgPulse, zoom }; }
  function shapegrid(s) {
    const asp = fw / fh, aa = 1.5 / fh * s.cells;
    let idx = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      camPix(x, y);
      const gx = (camPX / fw - 0.5) * asp / s.zoom * s.cells, gy = (camPY / fh - 0.5) / s.zoom * s.cells;
      const cx = Math.floor(gx), cy = Math.floor(gy), fx = gx - cx - 0.5, fy = gy - cy - 0.5;
      const rad = s.dot * (1 + s.pulse * Math.sin(s.t + cx * 0.7 + cy * 1.3));
      const d = (1 - s.square) * Math.hypot(fx, fy) + s.square * Math.max(Math.abs(fx), Math.abs(fy));
      fire[idx++] = Math.max(0, Math.min(1, shStep(rad + aa, rad - aa, d))) * 255;
    }
  }
  // Concentric rings: nested N-gon contours marching outward.
  let coSides = 6, coCount = 6, coThick = 0.4, coSpeed = 0.6, coSpinSpeed = 0.1, coTime = 0, coSpin = 0;
  function concentricSeed(dt) { coTime += dt * coSpeed; coSpin += dt * coSpinSpeed; return { t: coTime, spin: coSpin, sides: coSides, count: coCount, thick: coThick, zoom }; }
  function concentric(s) {
    const seg = SH_TAU / s.sides, cs = Math.cos(seg * 0.5), asp = fw / fh, th = Math.max(0.02, Math.min(0.98, s.thick));
    let idx = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      camPix(x, y);
      const px = (camPX / fw - 0.5) * asp / s.zoom, py = (camPY / fh - 0.5) / s.zoom;
      const a = Math.atan2(py, px) + s.spin, rp = Math.hypot(px, py) * Math.cos(shMod(a, seg) - seg * 0.5) / cs;
      const ph = rp * s.count - s.t, band = Math.abs((ph - Math.floor(ph)) - 0.5) * 2;
      fire[idx++] = Math.max(0, Math.min(1, shStep(1, 1 - th, band))) * 255;
    }
  }
  // Bouncing shapes: centres are a pure triangle-wave function of ONE clock (bnTime), so
  // the motion reflects off the walls yet stays phase-trackable (no mutable velocity state).
  const BN_MAX = 8;
  let bnCount = 4, bnRad = 0.09, bnSquare = 0.6, bnSpeed = 1, bnTime = 0;
  const bnFreqX = [0.31, 0.44, 0.27, 0.52, 0.37, 0.48, 0.29, 0.41];
  const bnFreqY = [0.42, 0.29, 0.51, 0.34, 0.47, 0.26, 0.45, 0.33];
  const bnPhX = [0.0, 0.37, 0.72, 0.15, 0.58, 0.91, 0.24, 0.66];
  const bnPhY = [0.5, 0.12, 0.83, 0.41, 0.09, 0.74, 0.55, 0.28];
  const bnPos = new Float32Array(BN_MAX * 2);
  const shTri = u => { u = u - 2 * Math.floor(u / 2); return Math.abs(u - 1); };   // period-2 triangle, 0..1
  function bounceSeed(dt) {
    bnTime += dt * bnSpeed;
    const span = 1 - 2 * bnRad;
    for (let i = 0; i < BN_MAX; i++) {
      bnPos[i * 2] = bnRad + span * shTri(bnTime * bnFreqX[i] + bnPhX[i] * 2);
      bnPos[i * 2 + 1] = bnRad + span * shTri(bnTime * bnFreqY[i] + bnPhY[i] * 2);
    }
    return { pos: bnPos, count: Math.round(bnCount), rad: bnRad, square: bnSquare, zoom };
  }
  function bounce(s) {
    const asp = fw / fh, aa = 2 / fh, n = s.count;
    let idx = 0;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      camPix(x, y);
      const ux = (camPX / fw - 0.5) / s.zoom + 0.5, uy = (camPY / fh - 0.5) / s.zoom + 0.5;
      let heat = 0;
      for (let i = 0; i < n; i++) {
        const dx = (ux - s.pos[i * 2]) * asp, dy = uy - s.pos[i * 2 + 1];
        const dist = (1 - s.square) * Math.hypot(dx, dy) + s.square * Math.max(Math.abs(dx), Math.abs(dy));
        const h = shStep(s.rad + aa, s.rad - aa, dist);
        if (h > heat) heat = h;
      }
      fire[idx++] = Math.max(0, Math.min(1, heat)) * 255;
    }
  }

  // ---- Strange attractors: de Jong map stamped into the fire heat grid (point effect) ----
  // The map itself is fully deterministic — same coefficients, same figure, every
  // frame. `atJit` scatters each stamped point by up to ±jit heat pixels, which
  // dithers the hard threads into something softer. It runs free on Math.random(),
  // deliberately clear of the chaos PRNG (like auto-morph) so it can never perturb
  // the other point effects' sequences. There is no fixed-seed variant: the heat
  // grid accumulates over many ticks, so a repeating scatter and a free one both
  // fill the same ±jit neighbourhood within a few frames and look identical once
  // glow and decay are over them. It was tried, and it was invisible.
  let atA = 1.4, atB = -2.3, atC = 2.4, atD = -2.1, atJit = 0.5;
  function attractorStamp(xL, xR, yT, yB, n) {
    const cx = (xL + xR) * 0.5, cy = (yT + yB) * 0.5;
    const sx = (xR - xL) * 0.22, sy = (yB - yT) * 0.22;   // map de Jong's ±2 range into the safe box
    const jit = atJit;
    let x = 0.1, y = 0.1;
    for (let i = 0; i < n; i++) {
      const nx = Math.sin(atA * y) - Math.cos(atB * x);
      const ny = Math.sin(atC * x) - Math.cos(atD * y);
      x = nx; y = ny;
      if (i <= 20) continue;                              // skip the transient, then plot the attractor
      let px = cx + x * sx, py = cy + y * sy;
      // Guarded so jit === 0 stays byte-identical to the un-jittered map.
      if (jit > 0) { px += (Math.random() - 0.5) * 2 * jit; py += (Math.random() - 0.5) * 2 * jit; }
      plot(px, py, 255);
    }
  }

  function render() {
    for (let i = 0, len = fire.length; i < len; i++) buf32[i] = palette[fire[i]];
    offCtx.putImageData(img, 0, 0);

    // AnimeJulia & Plasma zoom inside their own shaders, so only the fire modes
    // scale the rendered image here. Scale about the canvas centre; clear first
    // when zoomed out so no smeared border remains.
    // CPU mirror of the transition pass — same modes, canvas ops instead of a shader.
    if (transActive() && transOff) {
      const t = Math.max(0, Math.min(1, trans.t)), k = 1 - Math.abs(2 * t - 1), m = trans.mode;
      const g = offCtx, W = off.width, H = off.height;
      g.save();
      if (m === 0) {                                   // crossfade
        g.globalAlpha = 1 - t; g.drawImage(transOff, 0, 0);
      } else if (m === 3 || m === 4) {                 // pixelate / blur through
        if (t < 0.5) { g.globalAlpha = 1; g.drawImage(transOff, 0, 0); }
        if (m === 3) {                                  // down- then up-sample
          const bs = Math.max(1, Math.round(1 + 46 * k * k));
          const sw = Math.max(1, Math.round(W / bs)), sh = Math.max(1, Math.round(H / bs));
          if (bs > 1 && !transTmp) transTmp = document.createElement("canvas");
          if (bs > 1) {
            transTmp.width = sw; transTmp.height = sh;
            const tg = transTmp.getContext("2d");
            tg.imageSmoothingEnabled = true; tg.drawImage(off, 0, 0, sw, sh);
            g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, H);
            g.drawImage(transTmp, 0, 0, sw, sh, 0, 0, W, H);
            g.imageSmoothingEnabled = true;
          }
        } else if (k > 0.02) { g.filter = "blur(" + (7 * k * k).toFixed(1) + "px)"; g.drawImage(off, 0, 0); g.filter = "none"; }
      } else if (m === 5 || m === 6) {                 // wipe / iris: reveal the new scene
        g.globalCompositeOperation = "destination-in";
        if (m === 5) { g.fillStyle = "#fff"; g.fillRect(0, 0, W * Math.min(1, t * 1.28), H); }
        else { g.fillStyle = "#fff"; g.beginPath(); g.arc(W / 2, H / 2, Math.hypot(W, H) * t * 0.72, 0, Math.PI * 2); g.fill(); }
        g.globalCompositeOperation = "destination-over";
        g.drawImage(transOff, 0, 0);
      } else {                                         // dip / flash: hold the old half, then veil
        g.globalAlpha = 1;
        if (t < 0.5) g.drawImage(transOff, 0, 0);
        g.globalCompositeOperation = m === 2 ? "lighter" : "source-atop";
        g.globalAlpha = m === 2 ? k * k : k;
        g.fillStyle = m === 2 ? "#fff" : "#000";
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    }
    const z = stackZoom();
    ctx.save();
    if (z !== 1) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(z, z);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    // subtle glow: an additive, blurred copy blooms the brightest pixels —
    // which are the white-hot triangle points — into a soft halo.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = bloomAmt;
    ctx.filter = "blur(4px)";
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  let last = 0, acc = 0, paused = false;
  const framesEl = document.getElementById("frames");
  let frameCount = 0, fps = 0;
  const fpsWin = [];                          // timestamps of recently rendered frames
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;

    // When paused we still re-present the last GPU frame (WebGL clears the
    // drawing buffer after compositing, so a skipped frame would flash black);
    // the Canvas2D path retains its pixels, so it just freezes.
    if (paused) { if (useGL && glReady) glRender(); return; }

    if (useGL && !glReady) return;    // context lost / not yet restored

    if (dt > 0.25) dt = 0.25;         // clamp after tab switches
    acc += dt;

    cyclePresets(now);                // auto-switch presets on the Preset TTL timer
    // Beats are detected off-thread of the render loop (audioTick, every HOP_MS);
    // here we only consume the latch and refresh the audio UI at frame rate.
    if (audio.on) { updateMeter(); flashChips(); }
    updateAnims(now, dt);             // drive the ranged sliders' erratic values
    if (audio.on) clearBeats();
    if (dbg.on) dbgDraw();

    postTime += dt;                         // clock for the self-animating post/screen passes
    if (creditLeft > 0) creditLeft -= dt;   // credits run on rendered time (see startCredits)
    transStep(dt);                          // ...and so does the preset transition

    // WHICH LAYER THE RENDER FOLLOWS. `activeIds`, the palette globals and `zoom` are the
    // SELECTED layer's live store (the "DOM is the store for the selected item" rule), but
    // selecting a layer is an EDITING action and must never change the picture. With 3 of 4
    // layers muted, selecting one of the muted ones used to render the visible layer through
    // the selected layer's filter set — a Tetrafyer losing `fire` shows no flame at all, which
    // reads as "the layer reverted to defaults" — and through its palette and its zoom.
    // So resolve all three from the DRAWING layer: the bottom-most LIVE item, which is
    // selection-independent by construction. When they are the same item (every single-layer
    // scene, and any scene where you are editing the visible layer) nothing changes at all.
    const live = stack.filter(L => !L.mute);
    const ptItems = live.filter(L => !EFFECTS[L.fx].draw);
    const shItems = live.filter(L => EFFECTS[L.fx].draw);
    const renderL = live[0] || stack[stackSel];
    // Only the paths that colour through the ONE global palette need the override: the
    // multi-layer GL path already resolves palette AND filters per layer (renderStackColor).
    const onePal = !useGL || live.length <= 1;
    const renderOther = onePal && renderL !== stack[stackSel];
    renderFilters = renderOther ? layerFilterSet(renderL) : null;
    const retain = hasFeedback();     // ...so this reads the DRAWING layer's feedback filters
    // Install the drawing layer BEFORE the morph/palette work below: banding (band/bandsize/
    // banddim) and the palette cycle (palcycle/palhold) are per-layer keys now, and morphStep /
    // composePalette read them out of the globals. This is also why morphStep moved down here
    // from above cyclePresets — it must see this frame's values for the layer being drawn, not
    // last frame's for whichever layer happens to be selected.
    installStackItem(renderL);
    if (morphing || morphOnce) morphStep(now);   // auto-morph, or a one-shot preset-switch morph

    // Palette: normally the selected layer's morphing ramp (composePalette's own defaults, so
    // this stays byte-identical whenever the drawing layer IS the selected one) — and banding
    // strength is set by its ranged slider each frame, so when not morphing (which already
    // rebakes) refresh the ramp while it is live, letting the stripes appear/shimmer/vanish as
    // the value wanders. Otherwise colour through the DRAWING layer's palette, advanced on its
    // own clock by stepLayerPal — the same per-layer machinery renderStackColor uses.
    if (renderOther) {
      const slot = stack.indexOf(renderL);
      composePalette(now, stepLayerPal(slot, layerPalIndex(renderL), now), layerPalRev(renderL), layerPalBg(renderL));
      bandLive = bandLevel > 0.001;
    } else if (!morphing && (bandLevel > 0.001 || bandLive)) {
      composePalette(now);
      bandLive = bandLevel > 0.001;
    }
    if (useGL) uploadPalette();       // push the (possibly morphed) palette

    // The sim accumulator is drained EVERY frame, not only in the fire branch —
    // otherwise a shader effect silently banks time and bursts the full 4 catch-up
    // ticks the moment you switch back to (or enable) fire. setEffect zeroes it too.
    // Keep the repeated-subtraction form, not `acc -= ticks*step`: 1/60 and 1/120
    // aren't exact binary fractions, and the two round differently enough to gain
    // or lose a tick over a few seconds — which shifts the fire's phase.
    const step = 1 / cfg.burn;
    let ticks = 0;
    while (acc >= step && ticks < 4) { acc -= step; ticks++; }
    // The Canvas2D fallback renders ONE item: every CPU mirror writes every cell with a
    // plain assignment, so a second mirror would simply erase the first, and each extra
    // mirror is a full per-pixel JS loop — an N× multiplier on the dominant cost of the
    // frame, on exactly the machines that have no GPU.
    if (!useGL) {
      const L = live[0] || stack[0];
      installStackItem(L);
      const fx = EFFECTS[L.fx];
      if (fx.draw) {
        // The mirror writes every cell unconditionally, so with retention on we hand it
        // the *other* buffer (a pointer swap, not a per-frame memcpy) and MAX-merge after.
        if (retain) {
          for (let i = 0; i < ticks; i++) heatFeedbackTick();
          const keep = fireKeep; fireKeep = fire; fire = keep;
        }
        fx.draw(dt);
        if (retain)
          for (let i = 0; i < fire.length; i++) if (fireKeep[i] > fire[i]) fire[i] = fireKeep[i];
      } else {
        for (let i = 0; i < ticks; i++) simulate(now);
      }
    } else if (live.length > 1) {
      // MULTI-LAYER: colour each layer with its OWN palette and blend in OKLab, so a
      // stack of effects keeps its distinct colours instead of sharing one palette.
      renderStackColor(live, dt, now, ticks);
    } else {
      glColorTex = null;               // one live layer ⇒ the classic single-palette path
      // Filter params are per-layer keys now, applied by installStackItem rather than in
      // updateAnims — but the feedback filters below (beginHeatTick / heatFeedbackTick)
      // read cfg.decay, fadeKeep, echoDist, … BEFORE any per-item install runs. So apply
      // the sole live layer's values up front. Same values updateAnims used to apply
      // directly, so a one-layer scene stays byte-identical.
      if (live[0]) installStackItem(live[0]);
      // POINT items own the tick loop, because propagation and stamping must interleave:
      // propagate, stamp, propagate, stamp. Hoisting the propagation out to once per
      // frame would visibly change every point effect whenever ticks > 1 — which is the
      // normal case at the shipped burn rate.
      if (ptItems.length) {
        for (let t = 0; t < ticks; t++) {
          beginHeatTick();                       // one propagation per tick, shared
          for (const L of ptItems) {
            installStackItem(L);
            installPhase(L);                     // this item's own drift/spin clocks
            glPtCount = 0;                       // a fresh point list per item...
            stampTick(L, now);
            capturePhase(L);
            glBlitPoints(L.blend, L.gain);       // ...so each blits with its own blend/gain
          }
          curHeat = pendingDst;                  // close the tick once, after every item
        }
      } else if (retain) {
        for (let i = 0; i < ticks; i++) heatFeedbackTick();
      } else {
        // Nothing advanced or cleared the buffer this frame, and the shader items below
        // now composite INTO it rather than overwriting it — so without this they would
        // MAX against last frame's image and the scene would never fade.
        glClearHeatCurrent();
      }
      // SHADER items draw once per frame, each into the scratch buffer, then composite.
      for (const L of shItems) {
        installStackItem(L);
        installPhase(L);
        EFFECTS[L.fx].draw(dt);                  // *Seed(dt) advances this item's clocks
        capturePhase(L);
        glMergeLayer(L.blend, L.gain);
      }
    }
    // Epilogue install, part 1 — THE RENDER. glRender/render() read these globals (notably
    // `zoom`, via stackZoom) outside any item's turn, so install the DRAWING layer rather
    // than whatever the last item in the loop happened to set. Using the selected item here
    // is what let picking a muted layer re-zoom and re-filter the visible scene; renderL is
    // the same object whenever you are editing the visible layer, so nothing changes then.
    installStackItem(renderL);
    installPhase(renderL);
    if (useGL) glRender();
    else render();
    renderFilters = null;              // back to activeIds for every UI caller of filterOn
    // Epilogue install, part 2 — THE EDITOR OVERLAYS. cardDraw must track the layer you are
    // EDITING, which is the original reason this epilogue exists: without it the Orbit editor
    // silently follows whichever item drew last.
    installStackItem(stack[stackSel]);
    installPhase(stack[stackSel]);
    // juliaPower is set ONLY by Multibrot's draw, so a multi-layer scene leaves the LAST
    // Multibrot layer's power in this global — but the Orbit editor / cardLocus track the
    // SELECTED layer. Re-derive it for that layer, same reason the two installs above run
    // (installStackItem has just set mbPower to the selected layer's animated Power); gated
    // on the editor being open so it never perturbs the render path otherwise. AnimeJulia /
    // Burning Ship are d=2.
    if (card && card.on) juliaPower = EFFECTS[stack[stackSel].fx].id === "multibrot" ? mbPower : 2;
    creditDraw();                      // above the finished image — effects and filters both
    if (card && card.on) cardDraw();   // Cardioid debug view follows the live seed

    // Count only rendered frames (paused frames returned early above). FPS is a
    // sliding average over the last 3s: frames span (n-1) intervals across the
    // window, so fps = (n-1) / windowSeconds.
    frameCount++;
    fpsWin.push(now);
    while (fpsWin.length && now - fpsWin[0] > 3000) fpsWin.shift();
    if (fpsWin.length > 1) fps = (fpsWin.length - 1) * 1000 / (now - fpsWin[0]);
    framesEl.textContent = frameCount + " · " + Math.round(fps) + " fps";
  }
  requestAnimationFrame(frame);

