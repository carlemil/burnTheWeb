  // ---- AnimeJulia: animated Julia set ----
  // z_{n+1} = z^2 + c with z0 = pixel; the seed c is a point in the Mandelbrot
  // plane that we orbit. c is the sum of two loops:
  //  · a large slow loop tracing just outside the inner bound of the Mandelbrot
  //    set. That inner bound is the main cardioid (cusp at only +0.25 real),
  //    NOT a circle — so we follow the cardioid boundary itself, scaled outward
  //    by a small margin. This keeps c right at the frontier where Julia sets
  //    are most intricate instead of dead dust or a solid blob.
  //  · a much smaller, faster circle riding on top. Its radius is under the
  //    outward margin, so it only ever wobbles the seed further out — never
  //    deep enough to touch the interior.
  // The big loop turns at ~0.05 rpm, the small one a fair bit faster, so the
  // fractal reshapes continuously. Escape time is written as heat into `fire`
  // and rendered through the same palette/glow pipeline as the fire.
  const RPM = (Math.PI * 2) / 60;      // one rpm in radians/second
  const JULIA_MARGIN = 0.06;           // push the big loop this far outside the cardioid
  const CARDIOID_SIZE = 1.05;          // overall scale of the seed cardioid
  const JULIA_SMALL_R = 0.03;          // reference small-circle radius (for the ratio-default calc)
  let juliaInnerR = JULIA_SMALL_R;     // small riding-circle radius (live-tunable via slider)
  let juliaOuterR = CARDIOID_SIZE;     // big cardioid-loop scale (live-tunable via slider)
  let juliaBigRpm = 0.03;              // outer spin (live-tunable via slider)
  const JULIA_MAX_ITER = 160;
  const JULIA_SPAN = 2.8;              // vertical extent of the complex view
  const JULIA_INV_LN2 = 1 / Math.LN2;

  // Inner spin is a *multiple* of the outer spin, like a small gear rolling
  // inside the big loop: the number of small-circle turns per outer lap is the
  // difference in circumference divided by the small circumference (hypocycloid
  // ratio). The scaled main cardioid c=0.5·e^{iθ}−0.25·e^{2iθ} has perimeter
  // 4·(1+margin); the small circle's is 2π·r. That value is the ratio slider's
  // natural centre; the slider (with animated bounds) tunes it live.
  const JULIA_C_BIG = 4 * (1 + JULIA_MARGIN) * CARDIOID_SIZE; // scaled cardioid perimeter
  const JULIA_C_SMALL = 2 * Math.PI * JULIA_SMALL_R;     // small-circle circumference
  const JULIA_RATIO_DEFAULT = (JULIA_C_BIG - JULIA_C_SMALL) / JULIA_C_SMALL; // ≈ 21.5
  let juliaRatio = JULIA_RATIO_DEFAULT;                  // inner : outer spin multiple
  let juliaPhase = 0;                                    // start-position offset, in laps (0=1 wrap)
  let juliaOffX = 0;                                     // slide the whole orbit along the real axis
  // Lap-speed easing: angular speed ∝ 1 + A·cos θ, so the fastest point (the
  // cardioid's cusp, θ=0) runs (1+A)/(1−A) times the slowest (the back, θ=π).
  // A = 0.5 ⇒ exactly 3:1. EASE_K keeps the lap *time* identical to a constant
  // sweep, so the Cardioid RPM slider still means revolutions per minute.
  const JULIA_EASE_A = 0.5;
  const EASE_K = 1 / Math.sqrt(1 - JULIA_EASE_A * JULIA_EASE_A);
  // Which exponent's locus the seed orbits. 2 for AnimeJulia and Burning Ship;
  // Multibrot's draw sets it from the live Power slider every frame, and setEffect
  // puts it back to 2 on the way out. Declared HERE, above juliaEase, because that
  // arrow reads it — leaving it below worked only as long as nothing called the ease
  // during startup, and this file has been bitten by exactly that three times.
  let juliaPower = 2;
  // ---- seed PATH shape ------------------------------------------------------------
  // Which curve the seed's outer loop traces in the c-plane. Chosen in the Orbit editor,
  // stored per effect (extras), and installed into these globals for the selected effect
  // (and per stacked layer). The default — cardioid, riding-circle on — reproduces the
  // original seed math byte-for-byte, which is what keeps juliaprobe and every existing
  // scene unchanged. Declared ABOVE juliaEase because that arrow reads seedPathMode (same
  // reason juliaPower sits here); circle/freehand have no cusps, so their ease is a flat 1.
  let seedPathMode = "cardioid";     // "cardioid" | "circle" | "freehand"
  let seedRideOn = true;             // the riding-circle epicycle on top of the base curve
  let seedPts = [];                  // freehand control points in the c-plane ([[x,y], …])
  let seedSpline = null;             // compiled arc-length LUT over seedPts (buildSeedSpline)
  const SEED_MODES = { cardioid: 1, circle: 1, freehand: 1 };
  const seedModeOk = m => SEED_MODES[m] ? m : "cardioid";
  // The warp at lap angle th. Shared by juliaSeed (which advances by it) and the
  // Orbit editor (which integrates dφ/dθ = ratio/ease to draw the true path).
  //
  // The cos runs at (power − 1) because that is exactly how many **cusps** the
  // degree-d cardioid has. dc/dθ = 0 needs e^{i(d−1)θ} = 1, so the cusps sit at
  // θ = 2πk/(d−1), k = 0…d−2 — one for d=2 (the classic cardioid), two for d=3,
  // three for d=4. Sprinting through each cusp and easing off between them is the
  // whole point of the warp, so the number of fast/slow stretches has to track the
  // number of cusps or the seed crawls straight through half of them.
  //
  // EASE_K still normalises the lap time for *every* n: ∮dθ/(1+A·cos nθ) = 2π/√(1−A²)
  // whatever the integer n, because the substitution u = nθ just covers the cosine's
  // period n times. So a lap stays exactly 1/rpm minutes at any power and no existing
  // preset changes pace. (Verified numerically for n = 1…4.) At power 2 this is
  // cos(1·θ) — the original expression, unchanged.
  // Cardioid: sprint through the cusps (see above). Circle and freehand have no cusps —
  // a circle is uniform-speed at constant angular rate, and freehand is arc-length even by
  // construction — so their ease is a flat 1, which also gives a lap time of exactly 1/rpm
  // (∮dθ at rate rpm·RPM over 2π = 1/rpm min), the same as the cardioid's EASE_K path.
  const juliaEase = th => seedPathMode === "cardioid"
    ? EASE_K * (1 + JULIA_EASE_A * Math.cos((juliaPower - 1) * th)) : 1;

  // Orbit phases accumulate per frame from the live rpm/ratio, so tuning or
  // animating either never teleports the seed. reseedJulia() sets the *start*:
  // a random lap on each reload / effect entry when "Random seed" is on (so the
  // fractal opens somewhere new), or a fixed 0 when off (fully reproducible).
  // Uses Math.random(), kept clear of the chaos-game PRNG (see Determinism).
  let juliaOuter = 0, juliaInner = 0;
  // Freeze the seed orbit while the Orbit editor's pause button is on: juliaSeed advances the
  // phase by `dt`, so a zero dt holds it put (the fractal and the editor's seed dot both stop).
  // Transient — cleared when the editor closes (see cardOpen).
  let orbitPaused = false;
  // The seed is only interesting where the *connectedness locus* is — the set of c
  // for which the filled Julia set of z^d+c is connected. For d=2 that is the
  // Mandelbrot set and its period-1 boundary is the familiar cardioid. For any other
  // d it is the degree-d **Multibrot** set, and its period-1 boundary is a different
  // curve: a fixed point solves z^d + c = z ⟹ c = z − z^d, and the component
  // boundary is where the multiplier d·z^(d−1) has modulus 1 ⟹ |z| = d^(−1/(d−1)).
  //
  // This used to be hardcoded to the d=2 cardioid whatever the Power slider said, so
  // Multibrot (which ships Power drifting 2→3.5) spent ~3/4 of every lap with its seed
  // buried *inside* the real locus — where the filled Julia set is one fat blob whose
  // interior never escapes, hence huge areas pinned at max palette instead of the
  // expected dendrites.
  //
  // At d=2 this reduces to |z| = 2⁻¹ = 0.5 and c = z − z² = 0.5e^{iθ} − 0.25e^{2iθ},
  // i.e. **bit-identical** to the old expression (every power here is exact in binary
  // floating point), so AnimeJulia and Burning Ship are untouched.
  function cardioidAt(th, d) {
    const R = Math.pow(d, -1 / (d - 1)), rd = Math.pow(R, d), a = th * d;
    return [R * Math.cos(th) - rd * Math.cos(a), R * Math.sin(th) - rd * Math.sin(a)];
  }
  function reseedJulia() {
    juliaOuter = randSeed ? Math.random() * Math.PI * 2 : 0;
    juliaInner = randSeed ? Math.random() * Math.PI * 2 : 0;
  }
  // Advance the two orbit phases one frame and return the seed c plus the
  // complex-plane span. Shared by the CPU loop and the GPU Julia shader so the
  // seed animation is identical on either path.
  // The seed for a given pair of orbit phases — pure, so the Cardioid debug view
  // can sample the whole path (and the live point) without advancing the animation.
  // A closed periodic Catmull-Rom spline through the freehand control points, resampled
  // into a dense polyline with a cumulative arc-length table. Traversing it by arc length
  // (seedSplineAt) gives even speed regardless of how the points are spaced — the "closed
  // smooth loop, even speed" the freehand mode promises. Rebuilt only when the points
  // change (on draw / clear / load), never per frame.
  function buildSeedSpline(pts) {
    if (!pts || pts.length < 3) return null;
    const n = pts.length, SAMP = 10, at = i => pts[((i % n) + n) % n];
    const samples = [];
    for (let i = 0; i < n; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < SAMP; s++) {
        const t = s / SAMP, t2 = t * t, t3 = t2 * t;
        samples.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    const m = samples.length, cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) { const a = samples[i], b = samples[(i + 1) % m]; cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
    return { samples, cum, len: cum[m] || 1 };
  }
  // Point at fraction f∈[0,1) of the closed spline's arc length (wraps).
  function seedSplineAt(sp, f) {
    const target = (f - Math.floor(f)) * sp.len, cum = sp.cum, m = sp.samples.length;
    let lo = 0, hi = m;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] <= target) lo = mid + 1; else hi = mid; }
    const i = Math.max(0, lo - 1), seg = cum[i + 1] - cum[i] || 1, t = (target - cum[i]) / seg;
    const a = sp.samples[i], b = sp.samples[(i + 1) % m];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  // The base curve the seed's outer loop follows at lap angle th, before the riding circle.
  // juliaOffX slides the whole orbit along the real axis in every mode.
  function basePathAt(th) {
    if (seedPathMode === "circle") {
      const R = (1 + JULIA_MARGIN) * juliaOuterR;   // Outer-radius slider scales it, like the cardioid
      return [R * Math.cos(th) + juliaOffX, R * Math.sin(th)];
    }
    if (seedPathMode === "freehand") {
      // Freehand is strict: it does NOT fall back to the cardioid. With a loop drawn, the
      // seed follows the spline; with nothing drawn yet it simply holds at a neutral point,
      // so both the editor and the render show only the selected shape, never a stray cardioid.
      if (seedSpline) { const p = seedSplineAt(seedSpline, th / (Math.PI * 2)); return [p[0] + juliaOffX, p[1]]; }
      return [juliaOffX, 0];
    }
    // cardioid: the period-1 boundary of the connectedness locus, scaled outward by the
    // margin so the seed sits just *outside* it — which is what makes the Julia set
    // intricate rather than a blob.
    const c0 = cardioidAt(th, juliaPower), s = (1 + JULIA_MARGIN) * juliaOuterR;
    return [c0[0] * s + juliaOffX, c0[1] * s];
  }
  function juliaSeedAt(outer, inner) {
    const th = outer + juliaPhase * Math.PI * 2;
    const b = basePathAt(th);
    // small circle riding on top, spinning ratio× faster than the big loop; its radius is
    // the Inner-radius slider. Off (per-path toggle) ⇒ the seed follows the bare curve.
    const r = seedRideOn ? juliaInnerR : 0;
    return { cx: b[0] + r * Math.cos(inner), cy: b[1] + r * Math.sin(inner), bx: b[0], by: b[1] };
  }
  function juliaSeed(dt) {
    // Non-uniform traversal of the BIG loop only: the seed sprints through the cusp
    // (θ=0, the start/end of a lap) and eases off at the back (θ=π), on a cosine —
    // 3× faster at the cusp than at the back. EASE_K normalises it so a lap still
    // takes exactly 1/rpm minutes: ∮dθ/(1+A·cosθ) = 2π/√(1−A²), so scaling by
    // 1/√(1−A²) cancels it out; without it the same rpm would run ~15% slow.
    // The riding circle is deliberately NOT eased — it keeps its steady rate, so
    // its epicycles bunch up where the cardioid crawls and stretch out where it
    // sprints. (Lap time is preserved, so it still completes `ratio` turns a lap.)
    const th = juliaOuter + juliaPhase * Math.PI * 2;
    const base = (orbitPaused ? 0 : dt) * juliaBigRpm * RPM;   // paused ⇒ hold the phase (Orbit editor pause button)
    juliaOuter += base * juliaEase(th);   // eased outer lap
    juliaInner += base * juliaRatio;      // steady riding circle
    const p = juliaSeedAt(juliaOuter, juliaInner);
    const spanY = JULIA_SPAN / zoom, spanX = spanY * (fw / fh);
    return { cx: p.cx, cy: p.cy, spanX, spanY };
  }
  // The CPU mirrors take the seed the descriptor already advanced this frame —
  // they must NOT call juliaSeed() themselves, or the orbit runs at double speed
  // on the Canvas2D path (the GL path passes the same object to the shader).
  function julia(seed) {
    const cx = seed.cx, cy = seed.cy, spanX = seed.spanX, spanY = seed.spanY;
    const maxIter = JULIA_MAX_ITER, invLn2 = JULIA_INV_LN2;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        let zx = (camPX / fw - 0.5) * spanX, zy = (camPY / fh - 0.5) * spanY;
        let zx2 = zx * zx, zy2 = zy * zy, i = 0;
        while (zx2 + zy2 <= 4 && i < maxIter) {
          zy = 2 * zx * zy + cy;
          zx = zx2 - zy2 + cx;
          zx2 = zx * zx; zy2 = zy * zy;
          i++;
        }
        let v;
        if (i >= maxIter) {
          v = 255;                     // inside the set: hottest
        } else {
          // smooth (fractional) escape count kills the concentric banding,
          // then a sqrt gamma lifts the thin filaments into a visible glow.
          const nu = Math.log(0.5 * Math.log(zx2 + zy2) * invLn2) * invLn2;
          let f = (i + 1 - nu) / maxIter;
          v = f <= 0 ? 0 : 255 * Math.sqrt(f);
        }
        fire[idx++] = v;
      }
    }
  }
  function burningShip(seed) {             // CPU fallback — Julia-orbit Burning Ship (|Re·Im| each step)
    const cx = seed.cx, cy = seed.cy, spanX = seed.spanX, spanY = seed.spanY;
    const maxIter = JULIA_MAX_ITER, invLn2 = JULIA_INV_LN2;
    let idx = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        camPix(x, y);
        let zx = (camPX / fw - 0.5) * spanX, zy = (camPY / fh - 0.5) * spanY;
        let zx2 = zx * zx, zy2 = zy * zy, i = 0;
        while (zx2 + zy2 <= 4 && i < maxIter) {
          zy = 2 * Math.abs(zx * zy) + cy;   // burning ship: fold to |Re·Im|
          zx = zx2 - zy2 + cx;
          zx2 = zx * zx; zy2 = zy * zy;
          i++;
        }
        let v;
        if (i >= maxIter) v = 255;
        else { const nu = Math.log(0.5 * Math.log(zx2 + zy2) * invLn2) * invLn2; const f = (i + 1 - nu) / maxIter; v = f <= 0 ? 0 : 255 * Math.sqrt(f); }
        fire[idx++] = v;
      }
    }
  }

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

