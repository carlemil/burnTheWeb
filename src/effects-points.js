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
      plot(px, py, POINT_HEAT);
    }
  }

  // ---- Harmonograph: decaying pendulum ribbons (point effect) ----
  // The Victorian drawing machine: two pendulums per axis, each a damped sine, their sum
  // traced by a pen. x and y are therefore each a beat between two nearly-equal frequencies,
  // and the DETUNE between them is the whole trick — at exactly 0 the figure is a closed
  // Lissajous that retraces itself forever, and a hair off it the loop fails to close by a
  // little each lap and the curve precesses into a ribbon.
  //
  // The whole curve is redrawn every frame, like the chaos game: the point sequence is
  // deterministic, and only the slowly-drifting phases reshape it. hgPhase advances per TICK
  // (not per frame and not off the wall clock), so the morph tracks the sim speed like
  // flPhase and nodPhase.
  let hgRatio = 3, hgDetune = 0.012, hgDecay = 0.022, hgMorph = 0.35, hgPhase = 0;
  function harmonographStamp(xL, xR, yT, yB, n) {
    hgPhase += hgMorph * 2 / cfg.burn;
    const cx = (xL + xR) * 0.5, cy = (yT + yB) * 0.5;
    const sx = (xR - xL) * 0.34, sy = (yB - yT) * 0.34;
    const p = hgPhase;
    // Four pendulum phases, drifting apart at incommensurate rates so the figure never
    // returns to a pose it has held before.
    const p1 = p * 0.31, p2 = p * 0.23 + 1.9, p3 = p * 0.17 + 3.4, p4 = p * 0.41 + 5.1;
    const f1 = hgRatio, f2 = hgRatio + hgDetune, f3 = 1, f4 = 1 + hgDetune * 1.37;
    const d = hgDecay;
    // Run the pen until the swing has decayed to a few percent — past that it is all ink in
    // one pixel. Falls back to a fixed span when damping is off, or the loop never ends.
    const tMax = d > 1e-4 ? Math.min(200, 4.6 / d) : 200;
    // Sample by ARC LENGTH, not uniformly in t. The pen's speed falls off as exp(-d·t), so
    // even time steps put the samples furthest apart exactly where the swing is widest —
    // the outer loops came out as dotted lines while the dead centre got a solid blob.
    // Inverting the integral of exp(-d·t) spreads the ink evenly along the curve instead.
    const useArc = d > 1e-4;
    const span = useArc ? 1 - Math.exp(-d * tMax) : 0;
    const step = tMax / n;
    // UNEQUAL amplitudes, 0.6/0.4 rather than half each. Two equal pendulums drifting into
    // antiphase cancel to nothing, and the figure collapsed to a flat squashed ribbon at
    // whatever phase the drift happened to be passing through. Unequal ones can only ever
    // beat down to 0.2, so the figure breathes instead of dying.
    for (let i = 0; i < n; i++) {
      const t = useArc ? -Math.log(1 - (i / n) * span) / d : i * step;
      const e = Math.exp(-d * t);
      const x = (0.6 * Math.sin(f1 * t + p1) + 0.4 * Math.sin(f2 * t + p2)) * e;
      const y = (0.6 * Math.sin(f3 * t + p3) + 0.4 * Math.sin(f4 * t + p4)) * e;
      plot(cx + x * sx, cy + y * sy, POINT_HEAT);
    }
  }

  // ---- Fractal flames: IFS chaos game with nonlinear variations (point effect) ----
  // Two affine transforms whose coefficients orbit slowly (flPhase), then one of six
  // classic flame variations applied after each affine step. Stamped ADDITIVELY
  // (`stampAdd` on the descriptor + plot's add mode): where the orbit lands often burns
  // brighter, which is the log-density look that makes flames flames — MAX stamping
  // flattens it to a silhouette. Uses the seeded chaos PRNG (rnd), so the point
  // sequence is per-frame deterministic like the other point effects.
  let flVar = 3, flMorph = 0.3, flGlow = 30, flPhase = 0;
  // Auto-exposure scratch: a coarse occupancy grid over the stamp box. Mid-morph the
  // attractor regularly spreads THIN — per-pixel hits drop tenfold and the additive
  // picture faded to near-black ("most of the time it just looks black"). Pass 1 runs
  // the orbit without stamping to measure hits-per-occupied-cell; thin phases get their
  // per-point heat boosted (up to 6×, capped at 220 so single hits stay colour, not
  // white speckle), dense phases keep the shipped look (gain 1). Pass 2 re-runs the
  // SAME seeded sequence and stamps — deterministic, no per-layer state.
  const FL_MW = 64, FL_MH = 36;
  const flMask = new Uint8Array(FL_MW * FL_MH);
  function flamesStamp(xL, xR, yT, yB, n) {
    flPhase += flMorph * 2 / cfg.burn;     // coefficient orbit advances per TICK, like nodPhase
    const cx = (xL + xR) * 0.5, cy = (yT + yB) * 0.5;
    const sx = (xR - xL) * 0.26, sy = (yB - yT) * 0.26;
    const p = flPhase, V = Math.round(flVar);
    // two affine maps, coefficients breathing about a good-coverage base
    const A = [0.62 + 0.20 * Math.sin(p * 0.71), -0.48 + 0.18 * Math.sin(p * 0.53 + 1.7), 0.30 + 0.12 * Math.sin(p * 0.37 + 4.1),
               0.48 + 0.18 * Math.cos(p * 0.61 + 0.6), 0.60 + 0.20 * Math.cos(p * 0.43 + 2.9), 0.20 + 0.14 * Math.sin(p * 0.29 + 5.3)];
    const B = [-0.55 + 0.20 * Math.sin(p * 0.47 + 3.3), 0.52 + 0.18 * Math.cos(p * 0.67 + 1.1), -0.25 + 0.12 * Math.sin(p * 0.31 + 2.2),
               -0.42 + 0.18 * Math.sin(p * 0.59 + 4.8), -0.58 + 0.20 * Math.cos(p * 0.41 + 0.3), -0.15 + 0.14 * Math.cos(p * 0.23 + 3.7)];
    // 2x the shared Points budget: density IS this effect's picture, and the other point
    // effects' costs are per-VERTEX where this is a bare orbit step — 2n is still cheap.
    const N = n * 2;
    const run = emit => {
      rngState = (SEED + 0x51ab) >>> 0;    // same seed each pass ⇒ identical point SEQUENCE
      let x = 0.1, y = 0.1;
      for (let i = 0; i < N; i++) {
        const T = rnd() < 0.5 ? A : B;
        const nx = T[0] * x + T[1] * y + T[2];
        const ny = T[3] * x + T[4] * y + T[5];
        const r2 = nx * nx + ny * ny;
        if (V === 1) {                                      // sinusoidal
          x = Math.sin(nx); y = Math.sin(ny);
        } else if (V === 2) {                               // spherical
          const k = 0.7 / (r2 + 0.05); x = nx * k; y = ny * k;
        } else if (V === 3) {                               // swirl
          const sr = Math.sin(r2), cr = Math.cos(r2);
          x = nx * sr - ny * cr; y = nx * cr + ny * sr;
        } else if (V === 4) {                               // horseshoe
          const r = Math.sqrt(r2) + 0.05;
          x = (nx - ny) * (nx + ny) / r * 0.7; y = 2 * nx * ny / r * 0.7;
        } else if (V === 5) {                               // polar
          x = Math.atan2(ny, nx) * 0.3183; y = Math.sqrt(r2) - 1;
        } else {                                            // disc
          const th = Math.atan2(ny, nx) * 0.3183, r = Math.sqrt(r2);
          x = th * Math.sin(3.14159 * r); y = th * Math.cos(3.14159 * r);
        }
        if (!(x * x + y * y < 16)) { x = 0.1; y = 0.1; continue; }   // catches NaN too
        if (i <= 20) continue;                              // skip the transient
        emit(cx + x * sx, cy + y * sy);
      }
    };
    flMask.fill(0);
    let landed = 0, occupied = 0;
    const mw = FL_MW / (xR - xL), mh = FL_MH / (yB - yT);
    run((px, py) => {                      // PASS 1 — measure the spread
      if (px < xL || px >= xR || py < yT || py >= yB) return;
      landed++;
      const ci = (((py - yT) * mh) | 0) * FL_MW + (((px - xL) * mw) | 0);
      if (!flMask[ci]) { flMask[ci] = 1; occupied++; }
    });
    const hitsPerCell = landed / Math.max(1, occupied);
    const gain = Math.max(1, Math.min(6, 30 / Math.max(1, hitsPerCell)));
    const inc = Math.min(220, flGlow * gain);
    run((px, py) => plot(px, py, inc, true));   // PASS 2 — ADD, density is the picture
  }

  // ---- Boids murmuration: a flock stamping heat (point effect) ----------------------
  // The flock lives ON THE LAYER (L.boids) exactly like L.solids — installBoids points the
  // global at this layer's birds before it draws, or two flocks would share one sky.
  // Hash-seeded start (no Math.random), no randomness in flight: per-frame deterministic.
  // Scatter is the value-is-trigger pattern again: a rising Scatter edge (a beat chip
  // snap, or a hand flick) blasts every bird away from the flock's centroid.
  let bdCount = 80, bdSpeedV = 1, bdCoh = 1, bdFearV = 0, bdPrev = 0;
  let bdFlock = null;
  const bdH = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  function ensureBoids(arr, n, salt) {
    while (arr.length < n) {
      const i = arr.length;
      arr.push({ x: 0.15 + 0.7 * bdH(i, salt + 1), y: 0.15 + 0.7 * bdH(i, salt + 2),
                 vx: (bdH(i, salt + 3) - 0.5) * 0.24, vy: (bdH(i, salt + 4) - 0.5) * 0.24 });
    }
    if (arr.length > n) arr.length = n;
  }
  function installBoids(L) {
    L.boids = L.boids || [];
    ensureBoids(L.boids, Math.max(2, Math.min(200, Math.round(bdCount))), stack.indexOf(L) + 1);
    bdFlock = L.boids;
  }
  function boidsStamp(xL, xR, yT, yB, n) {
    const B = bdFlock;
    if (!B) return;
    ensureBoids(B, Math.max(2, Math.min(200, Math.round(bdCount))), 1);
    const dt = 1 / Math.max(30, cfg.burn);
    const scatter = bdFearV > bdPrev + 0.2;   // rising edge = one blast, however long the decay
    bdPrev = bdFearV;
    const N = B.length, base = 0.16 * bdSpeedV;
    let mx = 0, my = 0;
    for (const b of B) { mx += b.x; my += b.y; }
    mx /= N; my /= N;
    // stride-sampled neighbours: every 3rd bird is plenty for flock shape at these counts
    for (let i = 0; i < N; i++) {
      const b = B[i];
      let ax = 0, ay = 0, cxs = 0, cys = 0, vxs = 0, vys = 0, near = 0;
      for (let j = i % 3; j < N; j += 3) {
        if (j === i) continue;
        const o = B[j];
        const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 0.045) continue;
        near++;
        cxs += o.x; cys += o.y; vxs += o.vx; vys += o.vy;
        if (d2 < 0.0016) { const k = 0.0016 / Math.max(d2, 1e-5); ax -= dx * k; ay -= dy * k; }   // separation
      }
      if (near > 0) {
        ax += ((cxs / near - b.x) * 1.4 * bdCoh + (vxs / near - b.vx) * 1.1);   // cohesion + alignment
        ay += ((cys / near - b.y) * 1.4 * bdCoh + (vys / near - b.vy) * 1.1);
      }
      ax += (0.5 - b.x) * 0.35; ay += (0.5 - b.y) * 0.35;                       // soft box pull
      if (scatter) { ax += (b.x - mx) * 60; ay += (b.y - my) * 60; }            // the blast
      b.vx += ax * dt; b.vy += ay * dt;
      const sp = Math.hypot(b.vx, b.vy) || 1e-5;
      const want = base * (1 + bdFearV * 1.5);                                  // fear also means haste
      const k = sp > want * 1.6 ? (want * 1.6) / sp : sp < want * 0.5 ? (want * 0.5) / sp : 1;
      b.vx *= k; b.vy *= k;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0.02) { b.x = 0.02; b.vx = Math.abs(b.vx); }
      if (b.x > 0.98) { b.x = 0.98; b.vx = -Math.abs(b.vx); }
      if (b.y < 0.02) { b.y = 0.02; b.vy = Math.abs(b.vy); }
      if (b.y > 0.98) { b.y = 0.98; b.vy = -Math.abs(b.vy); }
    }
    // stamp: each bird is a short streak along its velocity — with the shipped Fade the
    // streaks become the murmuration's smoky trails
    const w = xR - xL, h = yB - yT;
    for (const b of B) {
      const sp = Math.hypot(b.vx, b.vy) || 1e-5;
      const tx = b.vx / sp, ty = b.vy / sp;
      for (let k = 0; k < 4; k++) {
        plot(xL + (b.x - tx * k * 0.006) * w, yT + (b.y - ty * k * 0.006) * h, POINT_HEAT * (1 - k * 0.16));
      }
    }
  }

