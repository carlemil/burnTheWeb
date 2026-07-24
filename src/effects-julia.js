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
