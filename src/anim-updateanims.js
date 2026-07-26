  // ---- animation ----
  // Drift/physics phase is *accumulated* per fire tick (dt = 1/burn) scaled by
  // the live drift speed, instead of read straight off the wall clock. That lets
  // the (now erratically animated) speed change smoothly frame to frame without
  // teleporting the phase — while still seeding from unix time at load so each
  // reload starts somewhere different.
  const T0 = performance.timeOrigin * 0.001;       // load time in seconds
  let simT = T0 * cfg.speed;
  // One tick of the feedback stage: advance the retained heat (Fire's upward
  // propagation, Fade's decay, …) and leave it ready for this tick's fresh output to
  // be MAX-injected on top. On the GPU this is a fragment shader; the CPU double loop
  // is the fallback path. Does NOT flip curHeat — glEndHeat owns that for the point
  // path, so that the flip lives in exactly one place.
  function beginHeatTick() {
    if (useGL) {
      glBeginHeat();
      glPtCount = 0;             // start a fresh stamp list for this tick
    } else if (!filterOn("fire")) {
      fire.fill(0);              // Fire off: this tick's output stands alone
      for (const f of activeFilters()) if (f.cpuFeedback) f.cpuFeedback();
    } else {
      const decay = cfg.decay, src = fire, dst = fireNext;
      for (let x = 0; x < fw; x++) {
        const edgeX = x === 0 || x === fw - 1;
        const xl = x > 0 ? x - 1 : 0;          // clamp horizontally (was wrap)
        const xr = x < fw - 1 ? x + 1 : fw - 1;
        for (let y = 0; y < fh; y++) {
          if (edgeX || y === 0 || y === fh - 1) { dst[y * fw + x] = 0; continue; }   // 1px black crop
          const y1 = (y + 1 < fh ? y + 1 : fh - 1) * fw;
          const y2 = (y + 2 < fh ? y + 2 : fh - 1) * fw;
          const y3 = (y + 3 < fh ? y + 3 : fh - 1) * fw;
          const sum = src[y1 + xl] + src[y2 + x] + src[y1 + xr] + src[y3 + x];
          let v = (sum * 32 / decay) | 0;
          dst[y * fw + x] = v > 255 ? 255 : v;
        }
      }
      fire = fireNext; fireNext = src;   // swap: `fire` now holds the new frame
      for (const f of activeFilters()) if (f.cpuFeedback) f.cpuFeedback();
    }
  }
  // Same tick, but closed: for shader effects, which have no stamp phase to close it.
  function heatFeedbackTick() { beginHeatTick(); if (useGL) curHeat = pendingDst; }

  // The fire simulation advances at a fixed (slow) tick rate, decoupled from
  // the render frame rate, so the burn can be as slow as we like while the
  // canvas still repaints smoothly.
  // Today's whole-tick call: propagate, stamp the selected item, close. Kept for the
  // Canvas2D path, which renders one stack item only.
  function simulate(now) {
    beginHeatTick();                   // 1) propagate existing fire upward
    stampTick(stack[stackSel], now);
    if (useGL) glEndHeat();
  }
  // The stamp half of a tick: advance this item's phase clocks and lay down its points.
  // Split out of simulate so the frame loop can run ONE propagation per tick and then
  // let every point item in the stack stamp into it — propagation is a property of the
  // shared heat buffer, stamping is per item.
  function stampTick(L, now) {
    simT += cfg.speed / cfg.burn;      // one fixed tick of drift phase
    const t = simT;
    spinAngle += rotSpeed / cfg.burn;  // rotation phase — 1/burn s per tick, so rad/s
    nodPhase += NOD_RATE * nodSpd * cfg.speed / cfg.burn;   // == 0.12·simT at nodSpd 1

    // 2) stamp the Sierpiński fractal as fresh heat via the chaos game.
    // Keep it inside a safe box — a single heat pixel of margin on every side, so
    // it fills the frame without stamping into the very edge row/column. Effect 0
    // is the 2D triangle; effect 1 is the 3D tetrahedron. Both re-seed the PRNG to
    // SEED each frame, so only the moving geometry reshapes the fractal — no
    // random shimmer.
    const xL = 1, xR = fw - 1;
    const yT = 1, yB = fh - 1;
    const n = cfg.points;
    // each layer/body re-seeds the PRNG below, so no global reset is needed here.

    if (EFFECTS[L.fx].stamp) {
      EFFECTS[L.fx].stamp(xL, xR, yT, yB, n);   // point-accumulation effect (e.g. attractors)
    } else if (EFFECTS[L.fx].fractal2d) {
      // Sierpiński — 2D triangle. Three corners drift on their own sin/cos mix,
      // scaled (Size) about the safe-box centre. Layers stacks progressively
      // smaller, fewer-point, differently-seeded copies.
      const hx = w => xL + (w + 1) * (xR - xL) * 0.5;
      const vy = w => yT + (w + 1) * (yB - yT) * 0.5;
      const ccx = (xL + xR) * 0.5, ccy = (yT + yB) * 0.5;
      for (let li = 0; li < layerCount; li++) {
        const bs = Math.pow(0.5, li);              // half size & points each layer
        const nk = Math.max(1, Math.round(n * bs));
        const sf = fractalSize * bs;
        const place = (X, Y) => [ccx + (X - ccx) * sf, ccy + (Y - ccy) * sf];
        const ph = li * 2.2;                       // phase offset ⇒ each copy drifts differently
        const corners = [
          place(hx(Math.sin(t * 0.70 + ph)),        vy(Math.cos(t * 0.90 + ph))),
          place(hx(Math.sin(t * 1.10 + 2.10 + ph)), vy(Math.cos(t * 0.50 + 1.30 + ph))),
          place(hx(Math.cos(t * 0.60 + 4.20 + ph)), vy(Math.sin(t * 0.80 + 0.70 + ph))),
        ];
        rngState = (SEED + li * 0x9E3779B1) >>> 0; // distinct chaos sequence per copy
        let px = fw * 0.5, py = fh * 0.575;
        for (let i = 0; i < nk + 16; i++) {
          const c = corners[(rnd() * 3) | 0];
          px = (px + c[0]) * 0.5;
          py = (py + c[1]) * 0.5;
          if (i > 15) plot(px, py, 255);
        }
      }
    } else {
      // Tetrafyer — Sierpiński tetrahedra bouncing inside a shared rubbery box a
      // fixed camera looks into. Physics advances one fixed tick (Drift speed sets
      // the tempo); then the box, impact ripples and each tetra are projected
      // through the same pin-hole camera. Rotation orbits the whole scene. Layers
      // adds smaller, fewer-point, independently-seeded tetrahedra in the same box.
      const halfW = (xR - xL) * 0.5, halfH = (yB - yT) * 0.5;
      TETRA_BOX[1] = 1.05;                        // fixed container half-extents (y,z);
      TETRA_BOX[2] = 1.0;                         // x follows from the frame aspect below.
      TETRA_BOX[0] = TETRA_BOX[1] * (fw / fh);   // Box size is a whole-scene zoom (below),
      L.tetras = L.tetras || [];                 // per-LAYER bodies (salted by stack position), so two
      ensureTetras(L.tetras, layerCount, stack.indexOf(L));   // Tetrahedron layers diverge instead of following
      const tetras = L.tetras;                   // this layer's bodies for the loop below

      const bx = TETRA_BOX[0], by = TETRA_BOX[1], bz = TETRA_BOX[2];
      // Camera distance (pin-hole focal) set relative to the box's corner radius,
      // so it never falls inside the box (which would break the projection).
      // Smaller factor = closer camera.
      const F = Math.hypot(bx, by, bz) * 1.8;
      const yaw = spinAngle, pitch = nodAmp * Math.sin(nodPhase);   // Rotation yaws, Box nod pitches
      const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
      const cpit = Math.cos(pitch), spit = Math.sin(pitch);
      const viewRot = p => {                     // yaw about Y, then pitch about X
        const x = p[0] * cyaw + p[2] * syaw, z = p[2] * cyaw - p[0] * syaw;
        return [x, p[1] * cpit - z * spit, p[1] * spit + z * cpit];
      };
      const perspMax = F / (F - Math.hypot(bx, by, bz));   // nearest possible corner
      // Box size zooms the whole scene (box + tetrahedra) about the frame centre;
      // 2x sends the box corners past the frame edges (intended).
      const scale = Math.min(halfW, halfH) * 0.92 / (Math.max(bx, by) * perspMax) * boxSize;
      const cx = (xL + xR) * 0.5, cy = fh * 0.5;   // centre the scene on the canvas
      const project = p => {                     // view-space → screen; z<F always
        const persp = F / (F - p[2]);
        return [cx + p[0] * persp * scale, cy - p[1] * persp * scale];
      };
      const stamp = (sx, sy, val) => plot(sx, sy, val);
      const drawLine = (A, B, val) => {          // stamp a projected 3D segment
        const steps = Math.max(2, (Math.hypot(B[0] - A[0], B[1] - A[1])) | 0);
        for (let s = 0; s <= steps; s++) {
          const f = s / steps;
          stamp(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, val);
        }
      };

      // box wireframe (12 edges) — the shared container the fractals ricochet in
      if (showBox) {
        const bc = [[-bx, -by, -bz], [bx, -by, -bz], [bx, by, -bz], [-bx, by, -bz],
                    [-bx, -by, bz], [bx, -by, bz], [bx, by, bz], [-bx, by, bz]]
                   .map(c => project(viewRot(c)));
        const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
                       [0, 4], [1, 5], [2, 6], [3, 7]];
        for (const [a, b] of edges) drawLine(bc[a], bc[b], 140);
      }

      const RTTL = 0.5, RN = 48, GOLD = 2.399963229728653;   // golden angle
      for (let li = 0; li < tetras.length; li++) {
        const T = tetras[li];
        const targetS = TETRA_BASE_S * fractalSize * T.baseScale;   // Size × per-layer half
        if (T.s > 1e-6 && Math.abs(T.s - targetS) > 1e-6) {
          const kf = targetS / T.s;               // rescale vertex offsets, keep orientation
          T.rv = T.rv.map(r => v3.scale(r, kf));
          T.s = targetS;
        }
        tetraStep(T, cfg.speed / cfg.burn, t);

        // rubbery ripples: each recent hit sends a fading *sphere* of points
        // swelling outward from the impact point — tied to "Show box".
        T.impacts = T.impacts.filter(im => t - im.t0 < RTTL);   // prune regardless
        if (showBox) for (const im of T.impacts) {
          const age = t - im.t0, rad = age * 2.4, bright = 255 * (1 - age / RTTL);
          const c0 = [0, 0, 0];                        // impact centre on the wall
          c0[im.ax] = im.sgn * TETRA_BOX[im.ax];
          c0[(im.ax + 1) % 3] = im.u;
          c0[(im.ax + 2) % 3] = im.v;
          for (let s = 0; s < RN; s++) {               // fibonacci sphere of points
            const y = 1 - (s + 0.5) / RN * 2, rr = Math.sqrt(1 - y * y), phi = s * GOLD;
            const pr = project(viewRot([c0[0] + Math.cos(phi) * rr * rad,
                                        c0[1] + y * rad,
                                        c0[2] + Math.sin(phi) * rr * rad]));
            stamp(pr[0], pr[1], bright);
          }
        }

        // the tetrahedron itself: chaos game between the four physics-driven world
        // vertices, with this body's own seed and point budget.
        rngState = T.seed;
        const nk = Math.max(1, Math.round(n * T.baseScale));
        const wv = T.rv.map(r => viewRot(v3.add(T.P, r)));
        let cur = wv[0].slice();
        for (let i = 0; i < nk + 16; i++) {
          const kk = (rnd() * 4) | 0;
          cur[0] = (cur[0] + wv[kk][0]) * 0.5;
          cur[1] = (cur[1] + wv[kk][1]) * 0.5;
          cur[2] = (cur[2] + wv[kk][2]) * 0.5;
          if (i > 15) { const pr = project(cur); stamp(pr[0], pr[1], 255); }
        }
      }
    }

    // The collected stamps are blitted and the tick closed by the CALLER — simulate()
    // on the Canvas2D path, the frame loop on the GPU path, which blits each point
    // item separately so each can carry its own blend and gain.
  }

