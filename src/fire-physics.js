  // ---- Tetrafyer rigid-body physics ---------------------------------------
  // A Sierpiński tetrahedron bounces inside a rubbery box floating in front of
  // the camera. The four vertices are perfectly symmetric, so the inertia
  // tensor is isotropic (I = 2·m·s² about every axis). That collapses the
  // rigid-body maths to one impulse per contacting vertex: clip a corner on a
  // wall and the single impulse updates both the travel *and* the spin the way
  // a real tumbling solid would — nick an edge and it visibly kicks into a roll.
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  };
  // Rodrigues rotation of v about unit axis u (ct = cos θ, st = sin θ).
  function rotAxis(v, u, ct, st) {
    const d = v3.dot(u, v) * (1 - ct), cr = v3.cross(u, v);
    return [v[0] * ct + cr[0] * st + u[0] * d,
            v[1] * ct + cr[1] * st + u[1] * d,
            v[2] * ct + cr[2] * st + u[2] * d];
  }
  // Fire-fractal size & rotation (Sirpinfyer/Tetrafyer). `fractalSize` scales the
  // geometry; `rotSpeed` (rad/s) spins it — accumulated into `spinAngle` per tick
  // so the rate is independent of drift speed and the burn tick rate.
  let fractalSize = 1, rotSpeed = 0, spinAngle = 0, layerCount = 1, boxSize = 1;
  // Tetrafyer's second rotation: the view pitches up and down in a slow sine — the
  // "nod" that made the box look like it was drifting on its own. It used to be
  // hardcoded as 0.30·sin(simT · 0.12) with no control at all. `nodAmp` is the
  // swing in radians and `nodSpd` a multiplier on the shipped rate; the phase is
  // *accumulated* per tick rather than read off simT, so animating the speed (or
  // arming a beat chip on it) never teleports the nod mid-swing — the same reason
  // spinAngle and simT accumulate. At nodSpd 1 the phase tracks 0.12·simT exactly,
  // so the shipped default reproduces the old motion. Still scaled by cfg.speed,
  // so Drift speed drives it as it always did.
  const NOD_RATE = CONFIG.tuning.nodRate;
  let nodAmp = 0.30, nodSpd = 1, nodPhase = 0;
  const TETRA_BASE_S = 0.42;           // tetra vertex scale at Size 1×
  const TETRA_UNIT = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const TETRA_BOX = [1.0, 1.05, 1.0];    // shared container half-extents; x retuned to aspect
  // The Layers control stacks independent tetrahedra bouncing in the shared box.
  // Instance k is half the size (and later half the points) of k-1, with its own
  // seed and start state; sin(k·…) offsets are 0 at k=0, so instance 0 reproduces
  // the original solo tetra exactly.
  function makeTetra(k) {
    const bs = Math.pow(0.5, k), s = TETRA_BASE_S * bs;
    const V = [0.95 + 0.35 * Math.sin(k * 1.7), 0.62 + 0.35 * Math.sin(k * 2.9), 0.78 + 0.35 * Math.sin(k * 3.7)];
    const W = [1.1 + 0.5 * Math.sin(k * 2.3), 0.7 + 0.5 * Math.sin(k * 1.3), 1.4 + 0.5 * Math.sin(k * 3.1)];
    const P = [0.3 * Math.sin(k * 2.1), 0.3 * Math.sin(k * 1.9), 0.3 * Math.sin(k * 2.7)];
    const rv = TETRA_UNIT.map(u => v3.scale(u, s));
    const E0 = 0.5 * v3.dot(V, V) + 0.5 * (2 * s * s) * v3.dot(W, W);
    return { s, e: 0.985, P, V, W, rv, E0, impacts: [], baseScale: bs, seed: (SEED + k * 0x9E3779B1) >>> 0 };
  }
  let tetras = [];
  function ensureTetras(count) {         // grow/shrink the body list to `count`
    while (tetras.length < count) tetras.push(makeTetra(tetras.length));
    if (tetras.length > count) tetras.length = count;
  }
  // Advance one rigid body one fixed timestep and resolve vertex/wall hits.
  function tetraStep(T, dt, t) {
    const box = TETRA_BOX, e = T.e;
    const Iinv = 1 / (2 * T.s * T.s);           // isotropic inverse inertia (m = 1)

    T.P = v3.add(T.P, v3.scale(T.V, dt));        // integrate translation

    const wl = Math.hypot(T.W[0], T.W[1], T.W[2]);   // integrate orientation
    if (wl > 1e-9) {
      const u = v3.scale(T.W, 1 / wl), ang = wl * dt;
      const ct = Math.cos(ang), st = Math.sin(ang);
      T.rv = T.rv.map(r => rotAxis(r, u, ct, st));    // one rotation for all ⇒ rigid
    }

    for (let k = 0; k < 4; k++) {                // resolve each vertex against 6 walls
      const r = T.rv[k];
      for (let ax = 0; ax < 3; ax++) {
        for (let sgn = -1; sgn <= 1; sgn += 2) {
          const pax = T.P[ax] + r[ax];
          const beyond = sgn > 0 ? pax - box[ax] : -box[ax] - pax;
          if (beyond <= 0) continue;             // vertex still inside this wall
          const n = [0, 0, 0]; n[ax] = -sgn;     // inward wall normal
          const vp = v3.add(T.V, v3.cross(T.W, r));   // contact-point velocity
          const vn = v3.dot(vp, n);
          if (vn < 0) {                          // moving into the wall ⇒ impulse
            const rxn = v3.cross(r, n);
            const j = -(1 + e) * vn / (1 + Iinv * v3.dot(rxn, rxn));
            T.V = v3.add(T.V, v3.scale(n, j));                       // /m = ·1
            T.W = v3.add(T.W, v3.scale(v3.cross(r, v3.scale(n, j)), Iinv));
            T.impacts.push({ ax, sgn, u: T.P[(ax + 1) % 3] + r[(ax + 1) % 3],
                             v: T.P[(ax + 2) % 3] + r[(ax + 2) % 3],
                             t0: t, str: Math.min(1, -vn * 0.8) });
            if (T.impacts.length > 20) T.impacts.shift();
          }
          T.P[ax] += n[ax] * beyond;             // positional push-out, no penetration
        }
      }
    }

    // Keep the box lively forever: gently renormalise energy back to E0 if the
    // near-elastic losses (or a rare correction) drift it out of a sane band.
    const KE = 0.5 * v3.dot(T.V, T.V) + 0.5 * (2 * T.s * T.s) * v3.dot(T.W, T.W);
    if (T.E0 > 0 && KE > 1e-6 && (KE < 0.5 * T.E0 || KE > 2 * T.E0)) {
      const f = Math.sqrt(T.E0 / KE);
      T.V = v3.scale(T.V, f); T.W = v3.scale(T.W, f);
    }
  }

