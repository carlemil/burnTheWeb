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
  // round(): the cusp count must stay an INTEGER for the warp to be periodic over a lap
  // (cos(nθ) with fractional n doesn't close, so the seed would get a speed hiccup at the
  // seam). juliaPower itself may be fractional now — the render takes it raw and the path
  // rides cardioidBlendAt — but the easing snaps to the nearest whole cusp pattern.
  // Crossing a half-integer changes the PATTERN only (a speed modulation), never the
  // position. At integer powers round() is the identity, so nothing shipped changes pace.
  const juliaEase = th => seedPathMode === "cardioid"
    ? EASE_K * (1 + JULIA_EASE_A * Math.cos((Math.round(juliaPower) - 1) * th)) : 1;

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
  // The parametric boundary above only CLOSES for integer d — cos(dθ) must complete whole
  // turns over a lap, so a fractional power on the raw curve teleports the seed at the
  // θ=0/2π seam (and the raw fractional curve measured ~40–55% of a lap inside the locus).
  // A fractional power therefore rides the BLEND of its two neighbouring integer curves:
  // closed for every d, continuous in θ AND in d, and EXACTLY cardioidAt at integers (the
  // f === 0 short-circuit) — which is what keeps juliaprobe's integer pins bit-identical
  // and every shipped scene unchanged. The true fractional locus is lopsided (principal
  // branch); the blend plus JULIA_MARGIN — and the Outer-radius slider, the Burning Ship
  // precedent — keep the seed outside it in practice. juliaprobe measures both properties.
  function cardioidBlendAt(th, d) {
    const lo = Math.floor(d), f = d - lo;
    if (f === 0) return cardioidAt(th, d);
    const a = cardioidAt(th, lo), b = cardioidAt(th, lo + 1);
    // JULIA_FRAC_BOOST: the true fractional locus bulges past the blend of its integer
    // neighbours, so the blend is pushed outward — most at half-integers, not at all at
    // whole numbers (the f === 0 short-circuit above never even reads it). A uniform
    // scale, so the seam closure below is unaffected.
    const boost = 1 + JULIA_FRAC_BOOST * 4 * f * (1 - f);
    return [(a[0] + (b[0] - a[0]) * f) * boost, (a[1] + (b[1] - a[1]) * f) * boost];
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
    const c0 = cardioidBlendAt(th, juliaPower), s = (1 + JULIA_MARGIN) * juliaOuterR;
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

