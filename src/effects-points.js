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

  // ---- Fractal flames: IFS chaos game with nonlinear variations (point effect) ----
  // Two affine transforms whose coefficients orbit slowly (flPhase), then one of six
  // classic flame variations applied after each affine step. Stamped ADDITIVELY
  // (`stampAdd` on the descriptor + plot's add mode): where the orbit lands often burns
  // brighter, which is the log-density look that makes flames flames — MAX stamping
  // flattens it to a silhouette. Uses the seeded chaos PRNG (rnd), so the point
  // sequence is per-frame deterministic like the other point effects.
  let flVar = 3, flMorph = 0.3, flGlow = 45, flPhase = 0;
  function flamesStamp(xL, xR, yT, yB, n) {
    rngState = (SEED + 0x51ab) >>> 0;      // per-frame reseed: same point SEQUENCE every tick
    flPhase += flMorph * 2 / cfg.burn;     // coefficient orbit advances per TICK, like nodPhase
    const cx = (xL + xR) * 0.5, cy = (yT + yB) * 0.5;
    const sx = (xR - xL) * 0.30, sy = (yB - yT) * 0.30;
    const p = flPhase, V = Math.round(flVar), inc = flGlow;
    // two affine maps, coefficients breathing about a good-coverage base
    const A = [0.62 + 0.20 * Math.sin(p * 0.71), -0.48 + 0.18 * Math.sin(p * 0.53 + 1.7), 0.30 + 0.12 * Math.sin(p * 0.37 + 4.1),
               0.48 + 0.18 * Math.cos(p * 0.61 + 0.6), 0.60 + 0.20 * Math.cos(p * 0.43 + 2.9), 0.20 + 0.14 * Math.sin(p * 0.29 + 5.3)];
    const B = [-0.55 + 0.20 * Math.sin(p * 0.47 + 3.3), 0.52 + 0.18 * Math.cos(p * 0.67 + 1.1), -0.25 + 0.12 * Math.sin(p * 0.31 + 2.2),
               -0.42 + 0.18 * Math.sin(p * 0.59 + 4.8), -0.58 + 0.20 * Math.cos(p * 0.41 + 0.3), -0.15 + 0.14 * Math.cos(p * 0.23 + 3.7)];
    let x = 0.1, y = 0.1;
    for (let i = 0; i < n; i++) {
      const T = rnd() < 0.5 ? A : B;
      let nx = T[0] * x + T[1] * y + T[2];
      let ny = T[3] * x + T[4] * y + T[5];
      const r2 = nx * nx + ny * ny;
      if (V === 1) {                                        // sinusoidal
        x = Math.sin(nx); y = Math.sin(ny);
      } else if (V === 2) {                                 // spherical
        const k = 0.7 / (r2 + 0.05); x = nx * k; y = ny * k;
      } else if (V === 3) {                                 // swirl
        const sr = Math.sin(r2), cr = Math.cos(r2);
        x = nx * sr - ny * cr; y = nx * cr + ny * sr;
      } else if (V === 4) {                                 // horseshoe
        const r = Math.sqrt(r2) + 0.05;
        x = (nx - ny) * (nx + ny) / r * 0.7; y = 2 * nx * ny / r * 0.7;
      } else if (V === 5) {                                 // polar
        x = Math.atan2(ny, nx) * 0.3183; y = Math.sqrt(r2) - 1;
      } else {                                              // disc
        const th = Math.atan2(ny, nx) * 0.3183, r = Math.sqrt(r2);
        x = th * Math.sin(3.14159 * r); y = th * Math.cos(3.14159 * r);
      }
      if (!(x * x + y * y < 16)) { x = 0.1; y = 0.1; continue; }   // catches NaN too
      if (i <= 20) continue;                                // skip the transient
      plot(cx + x * sx, cy + y * sy, inc, true);            // ADD, not max — density is the picture
    }
  }

