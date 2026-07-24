  // ---- Plasma: old-school sin/cos interference field ----
  // A sum of phase-animated sinusoids (plus a domain warp) over aspect-corrected,
  // zoomed coords, written as heat every frame — same direct-heat model as Julia,
  // so it rides the shared palette/banding/glow pipeline. Live-tunable via sliders.
  // NB: start the phase at 0, not the unix-time T0 — a ~1.7e9 value passed to the
  // shader's float32 uTime collapses sin() precision and flattens the field.
  let plasmaSpeed = 1, plasmaScale = 1, plasmaWarp = 0.5, plasmaTime = 0;
  function plasmaSeed(dt) {
    plasmaTime += dt * plasmaSpeed;      // phase advances at the live Speed
    return { t: plasmaTime, scale: plasmaScale, warp: plasmaWarp, zoom };
  }
  function plasma(dt) {                   // CPU fallback — mirrors FS_PLASMA
    const s = plasmaSeed(dt);
    const ar = fw / fh, k = s.scale / s.zoom * 6.2831853, t = s.t, warp = s.warp;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const yy = (camPY / fh - 0.5) * k;
        const xx = (camPX / fw - 0.5) * ar * k;
        const wx = xx + warp * Math.sin(yy * 0.5 + t * 0.7);
        const wy = yy + warp * Math.cos(xx * 0.5 + t * 0.9);
        const v = Math.sin(wx + t)
                + Math.sin(wy * 1.3 - t * 0.8)
                + Math.sin((wx + wy) * 0.7 + t * 1.1)
                + Math.sin(Math.hypot(wx, wy) * 0.9 - t * 1.3);
        fire[idx++] = (0.5 + 0.5 * Math.sin(v * 1.6)) * 255;   // full-range plasma cycling
      }
    }
  }

  // ---- Tunnel: polar-mapped demoscene flythrough (shader effect) ----
  let tunSpeed = 1, tunTwist = 0.3, tunRings = 10, tunTime = 0, tunTwistPhase = 0;
  function tunnelSeed(dt) {
    tunTime += dt * tunSpeed;             // fly forward down the pipe
    tunTwistPhase += dt * tunTwist;       // rotate the pipe
    return { t: tunTime, twist: tunTwistPhase, rings: tunRings, zoom };
  }
  function tunnel(dt) {                    // CPU fallback — mirrors FS_TUNNEL
    const s = tunnelSeed(dt), ar = fw / fh, TAU = 6.2831853;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py = (camPY / fh - 0.5) / s.zoom;
        const px = (camPX / fw - 0.5) * ar / s.zoom;
        const r = Math.hypot(px, py) + 1e-4;
        const a = Math.atan2(py, px) + s.twist * TAU;
        const v = 1 / r + s.t;
        const ang = 0.5 + 0.5 * Math.sin(a * 6);
        const dep = 0.5 + 0.5 * Math.sin(v * s.rings * TAU);
        const heat = dep * (0.55 + 0.45 * ang) * Math.min(1, r / 0.5);
        fire[idx++] = Math.max(0, Math.min(1, heat)) * 255;
      }
    }
  }

  // ---- Metaballs: summed radial fields, soft-saturated (shader effect) ----
  let mbCount = 4, mbRadius = 0.12, mbSpeed = 1, mbGain = 1, mbTime = 0;
  function metaSeed(dt) {
    mbTime += dt * mbSpeed;
    return { t: mbTime, count: mbCount, radius: mbRadius, gain: mbGain, zoom };
  }
  function metaCenter(i, t) {              // shared by shader/CPU: Lissajous path
    return [0.32 * Math.sin(t * (0.5 + i * 0.17) + i * 2.1), 0.32 * Math.cos(t * (0.4 + i * 0.23) + i * 1.3)];
  }
  function metaballs(dt) {                 // CPU fallback — mirrors FS_METABALL
    const s = metaSeed(dt), ar = fw / fh, n = Math.round(s.count), rr = s.radius * s.radius, g = s.gain;
    const cs = []; for (let i = 0; i < n; i++) cs.push(metaCenter(i, s.t));
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py = (camPY / fh - 0.5) / s.zoom;
        const px = (camPX / fw - 0.5) * ar / s.zoom;
        let field = 0;
        for (let i = 0; i < n; i++) { const dx = px - cs[i][0], dy = py - cs[i][1]; field += Math.exp(-(dx * dx + dy * dy) / rr); }
        const heat = 1 - Math.exp(-field * g);
        fire[idx++] = Math.max(0, Math.min(1, heat)) * 255;
      }
    }
  }

  // ---- Kaleidoscope: fold into mirror wedges, sample a plasma-like field (shader) ----
  let kSeg = 6, kRotSpeed = 0.2, kNoiseSpeed = 1, kRotPhase = 0, kNoiseTime = 0;
  function kaleidoSeed(dt) {
    kRotPhase += dt * kRotSpeed;
    kNoiseTime += dt * kNoiseSpeed;
    return { seg: kSeg, rot: kRotPhase, t: kNoiseTime, zoom };
  }
  function kaleidoscope(dt) {              // CPU fallback — mirrors FS_KALEIDO
    const s = kaleidoSeed(dt), ar = fw / fh, wedge = Math.PI * 2 / Math.round(s.seg), t = s.t;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py = (camPY / fh - 0.5) / s.zoom;
        const px = (camPX / fw - 0.5) * ar / s.zoom;
        const r = Math.hypot(px, py);
        let a = Math.atan2(py, px) + s.rot;
        a = Math.abs(((a % wedge) + wedge) % wedge - wedge * 0.5);   // fold + mirror into a wedge
        const qx = Math.cos(a) * r * 3, qy = Math.sin(a) * r * 3;
        const v = Math.sin(qx + t) + Math.sin(qy * 1.3 - t * 0.8) + Math.sin((qx + qy) * 0.7 + t * 1.1) + Math.sin(Math.hypot(qx, qy) * 1.5 - t);
        fire[idx++] = (0.5 + 0.5 * Math.sin(v * 1.3)) * 255;
      }
    }
  }

  // ---- Rotozoomer: rotate + pulse-zoom a tiled grid texture (shader effect) ----
  let rzRot = 0.4, rzZoomAmt = 0.5, rzTile = 4, rzAngle = 0, rzTime = 0;
  function rotozoomSeed(dt) {
    rzAngle += dt * rzRot;
    rzTime += dt;
    return { angle: rzAngle, scale: Math.exp(rzZoomAmt * Math.sin(rzTime * 0.7)), tile: rzTile, zoom };
  }
  function rotozoom(dt) {                  // CPU fallback — mirrors FS_ROTOZOOM
    const s = rotozoomSeed(dt), ar = fw / fh, c = Math.cos(s.angle), sn = Math.sin(s.angle), k = s.tile * Math.PI;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py = (camPY / fh - 0.5) / s.zoom;
        const px = (camPX / fw - 0.5) * ar / s.zoom;
        const ux = (c * px - sn * py) * s.scale, uy = (sn * px + c * py) * s.scale;
        fire[idx++] = (0.5 + 0.5 * Math.sin(ux * k) * Math.sin(uy * k)) * 255;
      }
    }
  }

  // ---- Munching squares: heat = ((x^y)+t) & mask — pure XOR pattern (shader effect) ----
  let xorSpeed = 20, xorScale = 0.4, xorMask = 255, xorTime = 0;
  function munchSeed(dt) {
    xorTime += dt * xorSpeed;
    return { t: xorTime, scale: xorScale, mask: Math.round(xorMask), zoom };
  }
  function munch(dt) {                     // CPU fallback — mirrors FS_MUNCH
    const s = munchSeed(dt), ti = Math.floor(s.t), m = s.mask, inv = 1 / m;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const yi = Math.floor(camPY / s.zoom * s.scale);
        const xi = Math.floor(camPX / s.zoom * s.scale);
        fire[idx++] = (((xi ^ yi) + ti) & m) * inv * 255;
      }
    }
  }

  // ---- Moiré: two drifting concentric-ring sets, added/multiplied (shader effect) ----
  let moFreq = 10, moDrift = 1, moMix = 0.3, moTime = 0;
  function moireSeed(dt) {
    moTime += dt * moDrift;
    return { t: moTime, freq: moFreq, mix: moMix, zoom };
  }
  function moire(dt) {                     // CPU fallback — mirrors FS_MOIRE
    const s = moireSeed(dt), ar = fw / fh, t = s.t, TAU = 6.2831853;
    const c1x = 0.3 * Math.sin(t * 0.6), c1y = 0.3 * Math.cos(t * 0.5);
    const c2x = 0.3 * Math.cos(t * 0.4), c2y = 0.3 * Math.sin(t * 0.7);
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py = (camPY / fh - 0.5) / s.zoom;
        const px = (camPX / fw - 0.5) * ar / s.zoom;
        const a = 0.5 + 0.5 * Math.sin(Math.hypot(px - c1x, py - c1y) * s.freq * TAU);
        const b = 0.5 + 0.5 * Math.sin(Math.hypot(px - c2x, py - c2y) * s.freq * TAU);
        const heat = a * b * (1 - s.mix) + 0.5 * (a + b) * s.mix;
        fire[idx++] = heat * 255;
      }
    }
  }

  // ---- Newton fractal: basins of z³−1 under Newton's method (shader effect) ----
  let nwSpin = 0.15, nwRelax = 1, nwPhase = 0;
  function newtonSeed(dt) {
    nwPhase += dt * nwSpin;
    return { spin: nwPhase, relax: nwRelax, zoom };
  }
  function newton(dt) {                    // CPU fallback — mirrors FS_NEWTON
    const s = newtonSeed(dt), ar = fw / fh, c = Math.cos(s.spin), sn = Math.sin(s.spin), TAU = 6.2831853;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        const py0 = (camPY / fh - 0.5) * 3 / s.zoom;
        const px0 = (camPX / fw - 0.5) * ar * 3 / s.zoom;
        let zx = c * px0 - sn * py0, zy = sn * px0 + c * py0, iter = 0;
        for (let k = 0; k < 40; k++) {
          const zx2 = zx * zx - zy * zy, zy2 = 2 * zx * zy;          // z²
          const fx = zx2 * zx - zy2 * zy - 1, fy = zx2 * zy + zy2 * zx;   // z³ − 1
          if (fx * fx + fy * fy < 1e-6) break;
          const dpx = 3 * zx2, dpy = 3 * zy2, dd = dpx * dpx + dpy * dpy + 1e-9;   // f' = 3z²
          zx -= s.relax * (fx * dpx + fy * dpy) / dd;
          zy -= s.relax * (fy * dpx - fx * dpy) / dd;
          iter++;
        }
        const root = Math.floor((Math.atan2(zy, zx) / TAU * 3 + 3) % 3);
        fire[idx++] = Math.max(0, Math.min(1, (root + 1 - iter / 40) / 3)) * 255;
      }
    }
  }

  // ---- Multibrot: Julia-orbit z^d + c with an animatable exponent (shader effect) ----
  let mbPower = 2.5;
  function multibrot(seed) {                // CPU fallback — mirrors FS_MULTIBROT
    const cx = seed.cx, cy = seed.cy, spanX = seed.spanX, spanY = seed.spanY, d = mbPower;
    const maxIter = JULIA_MAX_ITER, invLn2 = JULIA_INV_LN2;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        let zx = (camPX / fw - 0.5) * spanX, zy = (camPY / fh - 0.5) * spanY, i = 0, mag2 = zx * zx + zy * zy;
        while (mag2 <= 4 && i < maxIter) {
          const r = Math.pow(Math.sqrt(mag2), d), th = Math.atan2(zy, zx) * d;
          zx = r * Math.cos(th) + cx; zy = r * Math.sin(th) + cy;
          mag2 = zx * zx + zy * zy; i++;
        }
        let v;
        if (i >= maxIter) v = 255;
        else { const nu = Math.log(0.5 * Math.log(mag2) * invLn2) / Math.log(d); const f = (i + 1 - nu) / maxIter; v = f <= 0 ? 0 : 255 * Math.sqrt(f); }  // outer base = degree d, not 2 (see FS_MULTIBROT)
        fire[idx++] = v;
      }
    }
  }

  // ---- Copper bars: horizontal gradient bars sliding on sine motion (shader effect) ----
  let cbCount = 5, cbSpeed = 1, cbWidth = 0.12, cbTime = 0;
  function copperSeed(dt) {
    cbTime += dt * cbSpeed;
    return { t: cbTime, count: cbCount, width: cbWidth, zoom };
  }
  function copperbars(dt) {                // CPU fallback — mirrors FS_COPPER
    const s = copperSeed(dt), n = Math.round(s.count), w = s.width, bys = [];
    for (let i = 0; i < n; i++) bys.push(0.5 + 0.4 * Math.sin(s.t * (0.6 + i * 0.13) + i * 1.7));
    const barAt = yy => {
      let heat = 0;
      for (let i = 0; i < n; i++) { const bar = Math.max(0, 1 - Math.abs(yy - bys[i]) / w); if (bar * bar > heat) heat = bar * bar; }
      return heat * 255;
    };
    for (let y = 0; y < fh; y++) {
      const row = y * fw;
      if (!camOn()) {                                  // upright: bars are constant across a row
        const v = barAt((y / fh - 0.5) / s.zoom + 0.5);
        for (let x = 0; x < fw; x++) fire[row + x] = v;
      } else {                                         // rotated: yy varies with x, so go per pixel
        for (let x = 0; x < fw; x++) {
          camPix(x, y);
          fire[row + x] = barAt((camPY / fh - 0.5) / s.zoom + 0.5);
        }
      }
    }
  }

