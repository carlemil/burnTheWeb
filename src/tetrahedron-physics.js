  // ---- Tetrahedron rigid-body physics -------------------------------------
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
  // Point-fractal size & rotation (Sierpiński / Tetrahedron). `fractalSize` scales the
  // geometry; `rotSpeed` (rad/s) spins it — accumulated into `spinAngle` per tick
  // so the rate is independent of drift speed and the sim tick rate.
  let fractalSize = 1, rotSpeed = 0, spinAngle = 0, layerCount = 1, boxSize = 1;
  // The Tetrahedron's second rotation: the view pitches up and down in a slow sine — the
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
  // With "Show box" off there are no walls, so instead of bouncing the whole body WANDERS
  // around the centre on a slow Lissajous (up/down, sideways and in/out). `swaySize` is the
  // reach — 0 keeps it at the centre (spinning in place), higher sends it further. Each body
  // has its own phase so a stack of them spreads out instead of moving as one.
  let swaySize = 0.5;
  const TETRA_BASE_S = 0.42;           // tetra vertex scale at Size 1×
  const TETRA_UNIT = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  const TETRA_BOX = [1.0, 1.05, 1.0];    // shared container half-extents; x retuned to aspect
  // The Layers control stacks independent tetrahedra bouncing in the shared box.
  // Instance k is half the size (and later half the points) of k-1, with its own
  // seed and start state; sin(k·…) offsets are 0 at k=0, so instance 0 reproduces
  // the original solo tetra exactly.
  // `salt` is the LAYER (stack index): it offsets the start so two Tetrahedron layers begin from
  // different orientations/velocities instead of in lockstep. salt 0 zeroes every offset, so the
  // first layer (and every single-layer scene) reproduces the original solo body exactly.
  function makeTetra(k, salt) {
    salt = salt || 0;
    const bs = Math.pow(0.5, k), s = TETRA_BASE_S * bs, sp = salt * 3.4;
    const V = [0.95 + 0.35 * Math.sin(k * 1.7 + sp), 0.62 + 0.35 * Math.sin(k * 2.9 + sp * 1.3), 0.78 + 0.35 * Math.sin(k * 3.7 + sp * 0.7)];
    const W = [1.1 + 0.5 * Math.sin(k * 2.3 + sp * 1.1), 0.7 + 0.5 * Math.sin(k * 1.3 + sp * 1.7), 1.4 + 0.5 * Math.sin(k * 3.1 + sp * 0.5)];
    const P = [0.3 * Math.sin(k * 2.1 + sp), 0.3 * Math.sin(k * 1.9 + sp * 1.4), 0.3 * Math.sin(k * 2.7 + sp * 0.8)];
    const rv = TETRA_UNIT.map(u => v3.scale(u, s));
    const E0 = 0.5 * v3.dot(V, V) + 0.5 * (2 * s * s) * v3.dot(W, W);
    return { s, e: 0.985, P, V, W, rv, E0, impacts: [], baseScale: bs,
             swayT: salt * 1.7, swayPhase: k * 2.399 + salt * 1.3,   // box-off wander clock + per-body/per-layer phase
             seed: (SEED + k * 0x9E3779B1 + salt * 0x85EBCA6B) >>> 0 };
  }
  // Grow/shrink ONE layer's body list to `count`. The list is passed in (each Tetrahedron
  // layer keeps its own on L.tetras), so stacking two layers no longer shares — and syncs — one
  // set of tetrahedra. `salt` is that layer, threaded into the new bodies' start state.
  function ensureTetras(arr, count, salt) {
    while (arr.length < count) arr.push(makeTetra(arr.length, salt));
    if (arr.length > count) arr.length = count;
  }
  // Keep the body lively forever: gently renormalise energy back to E0 if the
  // near-elastic losses (or a rare correction) drift it out of a sane band. Shared
  // by both modes — it keeps |V| (which sets the orbit speed) and the spin alive.
  function tetraRenorm(T) {
    const KE = 0.5 * v3.dot(T.V, T.V) + 0.5 * (2 * T.s * T.s) * v3.dot(T.W, T.W);
    if (T.E0 > 0 && KE > 1e-6 && (KE < 0.5 * T.E0 || KE > 2 * T.E0)) {
      const f = Math.sqrt(T.E0 / KE);
      T.V = v3.scale(T.V, f); T.W = v3.scale(T.W, f);
    }
  }
  // Advance one rigid body one fixed timestep. The orientation always tumbles; the
  // translation depends on **Show box**: shown ⇒ bounce off the six invisible walls
  // (the original rigid-body path); hidden ⇒ there are no walls to ricochet in, so it
  // ORBITS the centre of the box (= centre of the screen) at T.orbitR, tumbling as it
  // circles, at the same tangential speed it would have bounced with (so Drift speed
  // still sets the tempo). The radius eases in, so toggling the box slides between the
  // two motions instead of jumping.
  function tetraStep(T, dt, t) {
    const box = TETRA_BOX, e = T.e;
    const Iinv = 1 / (2 * T.s * T.s);           // isotropic inverse inertia (m = 1)

    const wl = Math.hypot(T.W[0], T.W[1], T.W[2]);   // integrate orientation (both modes)
    if (wl > 1e-9) {
      const u = v3.scale(T.W, 1 / wl), ang = wl * dt;
      const ct = Math.cos(ang), st = Math.sin(ang);
      T.rv = T.rv.map(r => rotAxis(r, u, ct, st));    // one rotation for all ⇒ rigid
    }

    if (!showBox) {                              // WANDER around the centre — no walls
      // A slow 3D Lissajous: independent x/y/z sines at irrational-ratio rates never repeat,
      // so the whole body drifts up/down, sideways and in/out around the midpoint rather than
      // just spinning. `swaySize` sets the reach (0 = pinned at the centre); the tempo follows
      // the body's speed so Drift speed still drives it. Ease toward the target so toggling the
      // box (and changing Sway) slides instead of jumping.
      const speed = Math.hypot(T.V[0], T.V[1], T.V[2]);
      T.swayT += speed * dt;
      const th = T.swayT, ph = T.swayPhase, A = swaySize, kr = 0.06;
      const tx = A * Math.sin(th + ph);
      const ty = A * Math.sin(th * 1.37 + ph + 1.1);
      const tz = A * 0.45 * Math.sin(th * 0.71 + ph + 2.3);
      T.P = [T.P[0] + (tx - T.P[0]) * kr, T.P[1] + (ty - T.P[1]) * kr, T.P[2] + (tz - T.P[2]) * kr];
      T.impacts.length = 0;                            // no wall hits ⇒ no rubbery ripples
      tetraRenorm(T);
      return;
    }

    T.P = v3.add(T.P, v3.scale(T.V, dt));        // BOUNCE: integrate translation
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
    tetraRenorm(T);
  }

