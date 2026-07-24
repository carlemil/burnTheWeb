  //  WebGL2 renderer — mirrors the CPU pipeline exactly (see initGL shaders).
  //  Heat lives in a ping-ponged R8 texture at fw×fh; propagation is a fragment
  //  shader; the CPU chaos game is uploaded as GL_POINTS (MAX-blended); Julia is
  //  a fragment shader; the display maps heat→palette and adds a blurred glow.
  // -----------------------------------------------------------------------
  function glCompile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error("shader: " + gl.getShaderInfoLog(s) + "\n" + src);
    return s;
  }
  function glLink(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error("link: " + gl.getProgramInfoLog(p));
    return p;
  }
  // Camera: every EFFECT shader samples a rotated coordinate instead of the raw
  // fragment position, so the effect's own space turns rather than the finished
  // picture (no black corners — the fields are procedural and defined everywhere).
  // Rather than edit 12 shaders by hand, camProg() rewrites the source at compile
  // time: gl_FragCoord becomes `fragCam`, and main() opens by computing it. The
  // rotation is orthographic (rotate as a 3D point about the screen centre, drop
  // z), so X/Y read as a lean and Z as a spin, and it is always well defined —
  // a perspective divide would put a horizon on screen with nothing beyond it.
  // NB this must NOT be applied to the pipeline shaders (prop/pal/zoom/blur/comp/
  // pts): rotating those would rotate the fire sim and the glow composite.
  // A hoisted function, not a const: initGL() is called above this line, so a const
  // would still be in its temporal dead zone when camProg() first runs.
  function camGlsl() { return `
    uniform vec3 uCam; uniform vec2 uCamSize;
    vec4 camFrag4() {
      vec2 c = gl_FragCoord.xy - 0.5 * uCamSize;
      vec3 q = vec3(c, 0.0);
      float s, k;
      s = sin(uCam.x); k = cos(uCam.x); q = vec3(q.x, q.y * k - q.z * s, q.y * s + q.z * k);
      s = sin(uCam.y); k = cos(uCam.y); q = vec3(q.x * k + q.z * s, q.y, -q.x * s + q.z * k);
      s = sin(uCam.z); k = cos(uCam.z); q = vec3(q.x * k - q.y * s, q.x * s + q.y * k, q.z);
      return vec4(q.xy + 0.5 * uCamSize, gl_FragCoord.z, gl_FragCoord.w);
    }`; }
  function camProg(vsSrc, fsSrc, names) {
    // rewrite first, then inject — so the injected block's own gl_FragCoord survives
    const src = fsSrc.replace(/gl_FragCoord/g, "fragCam")
      .replace("void main(){", camGlsl() + "\n    void main(){ vec4 fragCam = camFrag4();");
    return makeProg(vsSrc, src, names.concat(["uCam", "uCamSize"]));
  }
  function makeProg(vsSrc, fsSrc, names) {
    const p = glLink(glCompile(gl.VERTEX_SHADER, vsSrc), glCompile(gl.FRAGMENT_SHADER, fsSrc));
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  }
  function createTex(internal, format, type, filter, wrap) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, 1, 1, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    t._i = internal; t._f = format; t._t = type;
    return t;
  }
  function resizeTex(t, w, h) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, t._i, w, h, 0, t._f, t._t, null);
  }
  function createFbo(tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }
  function bindFbo(f, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.viewport(0, 0, w, h); }
  function bindDefault(w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); }
  function bindTexUnit(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  function drawQuad() { gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function initGL() {
    // full-screen triangle (no vertex buffer; positions from gl_VertexID)
    const VS_QUAD = `#version 300 es
    out vec2 vUv;
    void main(){
      vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
      vUv = p;
      gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
    }`;
    // propagation — cgtutor averaging, integer-exact vs the CPU (recover the
    // stored byte, sum the 4 taps below, *32/decay, floor, clamp 255).
    const FS_PROP = `#version 300 es
    precision highp float;
    uniform highp sampler2D uHeat;
    uniform vec2 uSize;
    uniform float uDecay;
    out vec4 o;
    void main(){
      int fw = int(uSize.x), fh = int(uSize.y);
      int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y);
      // crop a 1px black border so heat can't smear a bright trail along the
      // edges (the wrapped/clamped boundary rows used to accumulate one).
      if (x == 0 || x == fw-1 || y == 0 || y == fh-1) { o = vec4(0.0); return; }
      int xl = x - 1;   // clamp horizontally (was wrap, which trailed the sides)
      int xr = x + 1;
      int y1 = min(y+1, fh-1);
      int y2 = min(y+2, fh-1);
      int y3 = min(y+3, fh-1);
      float a = floor(texelFetch(uHeat, ivec2(xl, y1), 0).r*255.0 + 0.5);
      float b = floor(texelFetch(uHeat, ivec2(x , y2), 0).r*255.0 + 0.5);
      float c = floor(texelFetch(uHeat, ivec2(xr, y1), 0).r*255.0 + 0.5);
      float d = floor(texelFetch(uHeat, ivec2(x , y3), 0).r*255.0 + 0.5);
      float v = floor((a+b+c+d) * 32.0 / uDecay);
      v = min(v, 255.0);
      o = vec4(v/255.0, 0.0, 0.0, 1.0);
    }`;
    // chaos-game point stamps (MAX-blended into the heat texture)
    const VS_PTS = `#version 300 es
    layout(location=0) in vec3 aPt;   // x, y, value(0..255) in fire-pixel space
    uniform vec2 uSize;
    out float vVal;
    void main(){
      vVal = aPt.z / 255.0;
      vec2 c = (aPt.xy + 0.5) / uSize * 2.0 - 1.0;
      gl_Position = vec4(c, 0.0, 1.0);
      gl_PointSize = 1.0;
    }`;
    const FS_PTS = `#version 300 es
    precision highp float;
    uniform float uGain;
    in float vVal; out vec4 o;
    void main(){ o = vec4(vVal * uGain, 0.0, 0.0, 1.0); }`;
    // Composite one stack item's heat into the shared buffer. The gain HAS to be a
    // multiply in here rather than a blend factor: blendEquation(MAX) ignores blendFunc
    // entirely, so a gain applied through blend state would work for Add and be
    // silently ignored for Max. That asymmetry is the whole reason this pass exists
    // instead of the effect shaders blending straight into the heat buffer.
    const FS_MERGE = `#version 300 es
    precision highp float;
    uniform highp sampler2D uSrc; uniform float uGain;
    in vec2 vUv; out vec4 o;
    void main(){ o = vec4(texture(uSrc, vUv).r * uGain, 0.0, 0.0, 1.0); }`;
    // ---- OKLab per-layer colour merge (multi-layer stacks only) ----------------
    // Each stacked effect keeps its OWN palette: its scratch heat is mapped through
    // its own LUT to an sRGB colour, then blended into an accumulator in OKLab so
    // hues combine perceptually instead of turning to grey. The accumulator ping-pongs
    // (a colour blend is not a GPU blend-func); its alpha carries the running brightness
    // weight, scaled by WMAX so it fits an 8-bit channel (≤ STACK_MAX layers). Björn
    // Ottosson's sRGB↔OKLab. uBlend: 0 = brightness-weighted (screen L + weighted-mean
    // hue), 1 = max (the brighter layer wins the pixel). Gain scales each layer's weight.
    const OKLAB_GLSL = `
      const float WMAX = 4.0;   // >= STACK_MAX: the running weight is stored as alpha·WMAX
      float s2l(float c){ return c <= 0.04045 ? c/12.92 : pow((c+0.055)/1.055, 2.4); }
      float l2s(float c){ return c <= 0.0031308 ? 12.92*c : 1.055*pow(c, 1.0/2.4) - 0.055; }
      vec3 srgb2oklab(vec3 c){
        vec3 lin = vec3(s2l(c.r), s2l(c.g), s2l(c.b));
        float l = 0.4122214708*lin.r + 0.5363325363*lin.g + 0.0514459929*lin.b;
        float m = 0.2119034982*lin.r + 0.6806995451*lin.g + 0.1073969566*lin.b;
        float s = 0.0883024619*lin.r + 0.2817188376*lin.g + 0.6299787005*lin.b;
        float l_=pow(l,1.0/3.0), m_=pow(m,1.0/3.0), s_=pow(s,1.0/3.0);
        return vec3(0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_,
                    1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_,
                    0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_);
      }
      vec3 oklab2srgb(vec3 lab){
        float l_ = lab.x + 0.3963377774*lab.y + 0.2158037573*lab.z;
        float m_ = lab.x - 0.1055613458*lab.y - 0.0638541728*lab.z;
        float s_ = lab.x - 0.0894841775*lab.y - 1.2914855480*lab.z;
        float l=l_*l_*l_, m=m_*m_*m_, s=s_*s_*s_;
        vec3 lin = vec3( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
                        -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
                        -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
        return clamp(vec3(l2s(lin.r), l2s(lin.g), l2s(lin.b)), 0.0, 1.0);
      }`;
    const FS_OKMERGE = `#version 300 es
    precision highp float;
    uniform sampler2D uLayer; uniform sampler2D uAcc;
    uniform float uGain; uniform int uBlend;
    in vec2 vUv; out vec4 o;` + OKLAB_GLSL + `
    void main(){
      vec3 col = texture(uLayer, vUv).rgb;               // this layer's finished colour
      vec4 acc = texture(uAcc, vUv);
      float accW = acc.a * WMAX;
      vec3 labC = srgb2oklab(col);
      float w = clamp(labC.x * uGain, 0.0, WMAX);        // weight = perceptual L · gain
      if (accW + w < 1.0e-4) { o = vec4(0.0); return; }  // nothing lit here yet
      // Per-channel (RGB) screen: blend red, green and blue INDEPENDENTLY so overlapping
      // layers keep their full colour instead of collapsing to one OKLab lightness+hue.
      // Straight on sRGB, no colour-space round-trip — that is what preserves the detail.
      // First layer is handled for free: screening against the empty (black) accumulator
      // returns the gained layer exactly. Alpha just marks the pixel lit, like the other modes.
      if (uBlend == 5) {
        vec3 c = clamp(col * uGain, 0.0, 1.0);
        o = vec4(1.0 - (1.0 - acc.rgb) * (1.0 - c), clamp((accW + w) / WMAX, 0.0, 1.0));
        return;
      }
      float Lc = clamp(labC.x * uGain, 0.0, 0.999);      // this layer's gained lightness
      vec3 layerLab = vec3(Lc, labC.yz);
      // Nothing underneath yet ⇒ every mode just shows the layer. add/max already reduce
      // to exactly this; colour/luminosity/difference need something below to act on, and
      // without this guard would render the first layer black (they read the empty acc's L).
      if (accW < 1.0e-4) { o = vec4(oklab2srgb(layerLab), clamp(w / WMAX, 0.0, 1.0)); return; }
      // Per-channel sRGB blends (8–15): operate straight on the two sRGB triples, no OKLab
      // round-trip — that is what gives them their characteristic per-channel behaviour. All
      // sit past the guard above, so a (below) is always a real, lit colour. c is this
      // layer's gained colour. Each returns directly; alpha marks the pixel lit for the next.
      {
        vec3 a = clamp(acc.rgb, 0.0, 1.0), c = clamp(col * uGain, 0.0, 1.0);
        float wUp = clamp((accW + w) / WMAX, 0.0, 1.0), wKeep = clamp(max(accW, w) / WMAX, 0.0, 1.0);
        if (uBlend == 8)  { o = vec4(a * c, wKeep); return; }                                  // multiply: darken, rich saturated overlaps
        if (uBlend == 9)  { vec3 lo = 2.0*a*c, hi = 1.0 - 2.0*(1.0-a)*(1.0-c);                 // overlay: multiply on dark, screen on light
                            o = vec4(mix(lo, hi, step(0.5, a)), wUp); return; }
        if (uBlend == 10) { o = vec4(clamp(a / max(1.0 - c, 1.0e-3), 0.0, 1.0), wUp); return; } // colour dodge: neon blowout
        if (uBlend == 11) { o = vec4(clamp(1.0 - (1.0 - a) / max(c, 1.0e-3), 0.0, 1.0), wKeep); return; } // colour burn: crushed shadows
        if (uBlend == 12) { uvec3 ai = uvec3(a*255.0 + 0.5), ci = uvec3(c*255.0 + 0.5);        // XOR: bitwise interference (munching-squares)
                            o = vec4(vec3(ai ^ ci) / 255.0, wUp); return; }
        if (uBlend == 13) { o = vec4(clamp(c*c / max(1.0 - a, 1.0e-3), 0.0, 1.0), wUp); return; } // reflect/glow: this layer's highlights flare
        if (uBlend == 14) { o = vec4(clamp(1.0 - abs(1.0 - a - c), 0.0, 1.0), wUp); return; }   // negation: bright where they agree, inverted where they collide
        if (uBlend == 15) { bool even = mod(floor(gl_FragCoord.y), 2.0) < 1.0;                  // interleave: scanline A/B, zero colour mixing
                            o = vec4(even ? c : a, wKeep); return; }
        if (uBlend == 19) { o = vec4(max(a, c), wKeep); return; }                               // channel max (Lighten): per-channel max, unlike MAX's whole-layer compare
      }
      vec3 labA = srgb2oklab(acc.rgb);
      vec3 outLab; float outW;
      if (uBlend == 1) {                                 // max: brighter layer wins
        outLab = Lc > labA.x ? layerLab : labA;
        outW = max(accW, w);
      } else if (uBlend == 2) {                          // difference: |below − this|, per channel
        outLab = abs(labA - layerLab);
        outW = max(accW, w);
      } else if (uBlend == 3) {                          // colour: below's lightness, this layer's hue
        outLab = vec3(labA.x, labC.yz);
        outW = max(accW, w);
      } else if (uBlend == 4) {                          // luminosity: this layer's lightness, below's hue
        outLab = vec3(Lc, labA.yz);
        outW = max(accW, w);
      } else if (uBlend == 6) {                          // OKLCh vivid: blend hue on the RIM, chroma = max
        // Straight (a,b) averaging cancels toward the grey centre for near-opposite hues
        // (red vs green) — the muddiness. Instead average the two UNIT hue directions
        // (chroma×brightness weighted) and renormalise, which walks the hue around the
        // wheel's rim, then scale by the LARGER of the two chromas so the overlap stays
        // as saturated as its most saturated input. Lightness screens like add.
        float Ca = length(labA.yz), Cb = length(labC.yz);
        vec2 da = Ca > 1.0e-5 ? labA.yz / Ca : vec2(0.0);
        vec2 db = Cb > 1.0e-5 ? labC.yz / Cb : vec2(0.0);
        vec2 dir = da * (Ca * accW) + db * (Cb * w);      // chroma·brightness pulls the hue
        float dl = length(dir);
        vec2 hue = dl > 1.0e-5 ? dir / dl : (Ca >= Cb ? da : db);   // hues cancel ⇒ keep the punchier one
        float Lout = 1.0 - (1.0 - labA.x) * (1.0 - Lc);   // screen lightness
        outLab = vec3(Lout, hue * max(Ca, Cb));
        outW = accW + w;
      } else if (uBlend == 7) {                          // dominant hue: no mixing — the punchier layer's colour wins
        // At each pixel whichever layer has the greater chroma×brightness keeps its EXACT
        // hue+chroma; only lightness screens. No third hue is ever produced, so the two
        // palettes stay pure with a crisp boundary — maximum saturation, hard edges.
        bool layerWins = length(labC.yz) * w >= length(labA.yz) * accW;
        vec2 abWin = layerWins ? labC.yz : labA.yz;      // winner's hue + chroma, unmixed
        float Lout = 1.0 - (1.0 - labA.x) * (1.0 - Lc);   // screen lightness
        outLab = vec3(Lout, abWin);
        outW = accW + w;
      } else if (uBlend == 16) {                         // HSV hyper-vivid: max L, max chroma, punchier hue
        // Louder than OKL: take the greater lightness AND the greater chroma, and point that
        // chroma along whichever layer is punchier (chroma×brightness). Overlaps read as the
        // brightest, most saturated resolution of the two — no rim averaging to soften it.
        float Ca = length(labA.yz), Cb = length(labC.yz);
        vec2 da = Ca > 1.0e-5 ? labA.yz / Ca : vec2(0.0);
        vec2 db = Cb > 1.0e-5 ? labC.yz / Cb : vec2(0.0);
        vec2 hue = (Cb * w >= Ca * accW) ? db : da;       // punchier layer's hue direction
        if (Ca < 1.0e-5 && Cb < 1.0e-5) hue = vec2(0.0);
        outLab = vec3(max(labA.x, Lc), hue * max(Ca, Cb));
        outW = accW + w;
      } else if (uBlend == 17) {                         // average: plain 50/50 perceptual mean
        // The calm opposite of screen/add — an even mean of both layers in OKLab. Soft and
        // painterly; on near-opposite hues it will pass a little toward grey, by design.
        outLab = 0.5 * (labA + layerLab);
        outW = max(accW, w);
      } else if (uBlend == 18) {                         // complement push: overlap → dominant hue's opposite
        // Rotate the overlap 180° from the DOMINANT layer's hue — a colour you cannot reach by
        // mixing the two (reds bleed cyan, greens bleed magenta). Chroma = max, lightness screens.
        float Ca = length(labA.yz), Cb = length(labC.yz);
        vec2 domAB = (Cb * w >= Ca * accW) ? labC.yz : labA.yz;
        float dc = length(domAB);
        vec2 comp = dc > 1.0e-5 ? -domAB / dc : vec2(1.0, 0.0);   // opposite direction on the wheel
        float Lout = 1.0 - (1.0 - labA.x) * (1.0 - Lc);   // screen lightness
        outLab = vec3(Lout, comp * max(Ca, Cb));
        outW = accW + w;
      } else {                                           // 0 = add: brightness-weighted screen
        float Lout = 1.0 - (1.0 - labA.x) * (1.0 - Lc);  // screen lightness
        vec2 ab = (labA.yz * accW + labC.yz * w) / (accW + w);   // hue ∝ brightness
        outLab = vec3(Lout, ab);
        outW = accW + w;
      }
      o = vec4(oklab2srgb(outLab), clamp(outW / WMAX, 0.0, 1.0));
    }`;
    // Julia escape-time, ported 1:1 from julia()
    const FS_JULIA = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform vec2 uC; uniform vec2 uSpan;
    out vec4 o;
    const float INVLN2 = 1.4426950408889634;
    void main(){
      float fw = uSize.x, fh = uSize.y;
      float xx = floor(gl_FragCoord.x), yy = floor(gl_FragCoord.y);
      float zx = (xx/fw - 0.5) * uSpan.x;
      float zy = (yy/fh - 0.5) * uSpan.y;
      float zx2 = zx*zx, zy2 = zy*zy;
      int i = 0;
      for (int k = 0; k < 160; k++) {
        if (zx2 + zy2 > 4.0) break;
        zy = 2.0*zx*zy + uC.y;
        zx = zx2 - zy2 + uC.x;
        zx2 = zx*zx; zy2 = zy*zy;
        i++;
      }
      float v;
      if (i >= 160) { v = 255.0; }
      else {
        float nu = log(0.5 * log(zx2 + zy2) * INVLN2) * INVLN2;
        float f = (float(i) + 1.0 - nu) / 160.0;
        v = f <= 0.0 ? 0.0 : 255.0 * sqrt(f);
      }
      o = vec4(clamp(v, 0.0, 255.0)/255.0, 0.0, 0.0, 1.0);
    }`;
    // old-school plasma: overloaded sin/cos interference, animated by uTime, with
    // an optional domain warp for swirl. Writes heat in .r like FS_JULIA.
    const FS_PLASMA = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uScale; uniform float uWarp; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw = uSize.x, fh = uSize.y;
      float ar = fw / fh;
      float k = uScale / uZoom * 6.2831853;
      float x = (gl_FragCoord.x/fw - 0.5) * ar * k;
      float y = (gl_FragCoord.y/fh - 0.5) * k;
      float t = uTime;
      float wx = x + uWarp * sin(y*0.5 + t*0.7);      // domain warp ⇒ swirl
      float wy = y + uWarp * cos(x*0.5 + t*0.9);
      float v = sin(wx + t)
              + sin(wy*1.3 - t*0.8)
              + sin((wx + wy)*0.7 + t*1.1)
              + sin(length(vec2(wx, wy))*0.9 - t*1.3);
      // wrap the summed value through a final sine ⇒ classic full-range plasma
      // colour-cycling (distinct bands incl. darks) instead of a washed-out blob.
      o = vec4(0.5 + 0.5 * sin(v * 1.6), 0.0, 0.0, 1.0);
    }`;
    // Tunnel: polar map (angle, 1/radius) → rings rushing toward the vanishing point.
    const FS_TUNNEL = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uTwist; uniform float uRings; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 p = vec2((gl_FragCoord.x/fw - 0.5) * (fw/fh), gl_FragCoord.y/fh - 0.5) / uZoom;
      float r = length(p) + 1e-4;
      float a = atan(p.y, p.x) + uTwist*6.2831853;
      float v = 1.0/r + uTime;
      float ang = 0.5 + 0.5*sin(a*6.0);
      float dep = 0.5 + 0.5*sin(v*uRings*6.2831853);
      float heat = dep * (0.55 + 0.45*ang) * clamp(r/0.5, 0.0, 1.0);
      o = vec4(clamp(heat,0.0,1.0), 0.0, 0.0, 1.0);
    }`;
    // Metaballs: sum of inverse-square fields from moving centres, soft-saturated.
    const FS_METABALL = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uCount; uniform float uRadius; uniform float uGain; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 p = vec2((gl_FragCoord.x/fw-0.5)*(fw/fh), gl_FragCoord.y/fh-0.5) / uZoom;
      float t=uTime, field=0.0; int n=int(uCount);
      // GLSL ES needs a constant loop bound, so this literal is the HARD ceiling
      // on ball count — uCount only gates it down. It must stay >= the mbcount
      // slider's max (CONTROLS), or raising that max silently caps the render here.
      for (int i=0;i<16;i++){
        if (i>=n) break;
        float fi=float(i);
        vec2 c = vec2(0.32*sin(t*(0.5+fi*0.17)+fi*2.1), 0.32*cos(t*(0.4+fi*0.23)+fi*1.3));
        vec2 d = p-c;
        field += exp(-dot(d,d)/(uRadius*uRadius));   // wide Gaussian blob ⇒ smooth merging
      }
      float heat = 1.0 - exp(-field*uGain);
      o = vec4(clamp(heat,0.0,1.0),0.0,0.0,1.0);
    }`;
    // Burning Ship: FS_JULIA but fold Re·Im to its absolute value each step.
    const FS_BURNING = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform vec2 uC; uniform vec2 uSpan;
    out vec4 o;
    const float INVLN2 = 1.4426950408889634;
    void main(){
      float fw = uSize.x, fh = uSize.y;
      float zx = (floor(gl_FragCoord.x)/fw - 0.5) * uSpan.x;
      float zy = (floor(gl_FragCoord.y)/fh - 0.5) * uSpan.y;
      float zx2 = zx*zx, zy2 = zy*zy;
      int i = 0;
      for (int k = 0; k < 160; k++) {
        if (zx2 + zy2 > 4.0) break;
        zy = 2.0*abs(zx*zy) + uC.y;
        zx = zx2 - zy2 + uC.x;
        zx2 = zx*zx; zy2 = zy*zy;
        i++;
      }
      float v;
      if (i >= 160) { v = 255.0; }
      else { float nu = log(0.5 * log(zx2 + zy2) * INVLN2) * INVLN2; float f = (float(i) + 1.0 - nu) / 160.0; v = f <= 0.0 ? 0.0 : 255.0 * sqrt(f); }
      o = vec4(clamp(v, 0.0, 255.0)/255.0, 0.0, 0.0, 1.0);
    }`;
    // Kaleidoscope: fold the plane into mirror wedges, sample a plasma-like field.
    const FS_KALEIDO = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uSeg; uniform float uRot; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 p = vec2((gl_FragCoord.x/fw-0.5)*(fw/fh), gl_FragCoord.y/fh-0.5) / uZoom;
      float r = length(p);
      float wedge = 6.2831853/uSeg;
      float a = atan(p.y, p.x) + uRot;
      a = abs(mod(a, wedge) - wedge*0.5);          // fold + mirror
      vec2 q = vec2(cos(a), sin(a)) * r * 3.0;
      float t = uTime;
      float v = sin(q.x + t) + sin(q.y*1.3 - t*0.8) + sin((q.x+q.y)*0.7 + t*1.1) + sin(length(q)*1.5 - t);
      o = vec4(0.5 + 0.5*sin(v*1.3), 0.0, 0.0, 1.0);
    }`;
    // Rotozoomer: rotate + pulse-zoom the plane, sample a tiled grid texture.
    const FS_ROTOZOOM = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uAngle; uniform float uScale; uniform float uTile; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 p = vec2((gl_FragCoord.x/fw-0.5)*(fw/fh), gl_FragCoord.y/fh-0.5) / uZoom;
      float c=cos(uAngle), s=sin(uAngle);
      vec2 uv = mat2(c,-s,s,c) * p * uScale;
      float k = uTile * 3.14159265;
      o = vec4(0.5 + 0.5*sin(uv.x*k)*sin(uv.y*k), 0.0, 0.0, 1.0);
    }`;
    // Munching squares: the classic (x XOR y)+t & mask hypnotic pattern.
    const FS_MUNCH = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uScale; uniform float uMask; uniform float uZoom;
    out vec4 o;
    void main(){
      vec2 c = gl_FragCoord.xy / uZoom * uScale;
      int xi = int(c.x), yi = int(c.y), m = int(uMask), ti = int(uTime);
      int val = ((xi ^ yi) + ti) & m;
      o = vec4(float(val)/float(m), 0.0, 0.0, 1.0);
    }`;
    // Moiré: two drifting concentric-ring sets, blended multiply↔add for shimmer.
    const FS_MOIRE = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uFreq; uniform float uMix; uniform float uZoom;
    out vec4 o;
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 p = vec2((gl_FragCoord.x/fw-0.5)*(fw/fh), gl_FragCoord.y/fh-0.5) / uZoom;
      float t=uTime;
      vec2 c1 = vec2(0.3*sin(t*0.6), 0.3*cos(t*0.5));
      vec2 c2 = vec2(0.3*cos(t*0.4), 0.3*sin(t*0.7));
      float a = 0.5 + 0.5*sin(length(p-c1)*uFreq*6.2831853);
      float b = 0.5 + 0.5*sin(length(p-c2)*uFreq*6.2831853);
      float heat = mix(a*b, 0.5*(a+b), uMix);
      o = vec4(heat, 0.0, 0.0, 1.0);
    }`;
    // Newton fractal: basins of z³−1 under Newton's method, coloured by root + iters.
    const FS_NEWTON = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uSpin; uniform float uRelax; uniform float uZoom;
    out vec4 o;
    vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
    void main(){
      float fw=uSize.x, fh=uSize.y;
      vec2 z = vec2((gl_FragCoord.x/fw-0.5)*(fw/fh), gl_FragCoord.y/fh-0.5) * 3.0 / uZoom;
      float c=cos(uSpin), s=sin(uSpin); z = mat2(c,-s,s,c)*z;
      int iter=0;
      for (int k=0;k<40;k++){
        vec2 z2=cmul(z,z);
        vec2 f = cmul(z2,z) - vec2(1.0,0.0);
        if (dot(f,f) < 1e-6) break;
        vec2 fp = 3.0*z2; float dd = dot(fp,fp)+1e-9;
        z -= uRelax*vec2(f.x*fp.x+f.y*fp.y, f.y*fp.x-f.x*fp.y)/dd;
        iter++;
      }
      float root = floor(mod(atan(z.y,z.x)/6.2831853*3.0 + 3.0, 3.0));
      float heat = (root + 1.0 - float(iter)/40.0)/3.0;
      o = vec4(clamp(heat,0.0,1.0), 0.0, 0.0, 1.0);
    }`;
    // Multibrot: Julia-orbit z^d + c (polar power); animate d to morph the bulb count.
    const FS_MULTIBROT = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform vec2 uC; uniform vec2 uSpan; uniform float uPower;
    out vec4 o;
    const float INVLN2 = 1.4426950408889634;
    void main(){
      float fw = uSize.x, fh = uSize.y;
      float zx = (floor(gl_FragCoord.x)/fw - 0.5) * uSpan.x;
      float zy = (floor(gl_FragCoord.y)/fh - 0.5) * uSpan.y;
      float mag2 = zx*zx + zy*zy; int i = 0;
      for (int k = 0; k < 160; k++) {
        if (mag2 > 4.0) break;
        float r = pow(sqrt(mag2), uPower);
        float th = atan(zy, zx) * uPower;
        zx = r*cos(th) + uC.x;
        zy = r*sin(th) + uC.y;
        mag2 = zx*zx + zy*zy;
        i++;
      }
      float v;
      if (i >= 160) { v = 255.0; }
      // Renormalized escape count: the OUTER log base is the degree d (uPower), not 2 —
      // hard-coding INVLN2 here left the fractional term unable to cancel the integer
      // iteration bands whenever d != 2, so each contour reset to a darker shade. The
      // inner INVLN2 stays: it normalizes by the bailout radius (2), independent of d.
      else { float nu = log(0.5 * log(mag2) * INVLN2) / log(uPower); float f = (float(i) + 1.0 - nu) / 160.0; v = f <= 0.0 ? 0.0 : 255.0 * sqrt(f); }
      o = vec4(clamp(v, 0.0, 255.0)/255.0, 0.0, 0.0, 1.0);
    }`;
    // Copper bars: horizontal gradient bars sliding up/down on sine motion.
    const FS_COPPER = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uCount; uniform float uWidth; uniform float uZoom;
    out vec4 o;
    void main(){
      float y = (gl_FragCoord.y/uSize.y - 0.5)/uZoom + 0.5;
      float heat = 0.0; int n = int(uCount);
      for (int i=0;i<12;i++){
        if (i>=n) break;
        float fi = float(i);
        float by = 0.5 + 0.4*sin(uTime*(0.6+fi*0.13) + fi*1.7);
        float bar = max(0.0, 1.0 - abs(y - by)/uWidth);
        heat = max(heat, bar*bar);
      }
      o = vec4(heat, 0.0, 0.0, 1.0);
    }`;
    // ---- Geometric shape effects: SDF fragment shaders that write heat, coloured by
    // the palette + glow like every other effect. All aspect-correct against fw/fh and
    // bake their own zoom (uZoom). camProg wraps them, so gl_FragCoord carries the camera.
    // Polygon: one rotating regular N-gon; uThick hollows it (1 = filled, →0 = thin ring).
    const FS_POLYGON = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uSpin; uniform float uSides; uniform float uRad; uniform float uThick; uniform float uZoom;
    out vec4 o;
    const float TAU = 6.2831853;
    void main(){
      vec2 p = gl_FragCoord.xy/uSize - 0.5; p.x *= uSize.x/uSize.y; p /= uZoom;
      float a = atan(p.y, p.x) + uSpin, seg = TAU/uSides;
      float rp = length(p) * cos(mod(a, seg) - seg*0.5) / cos(seg*0.5);   // circumradius coord: = uRad on the edge
      float aa = 1.5/uSize.y, ir = uRad*(1.0 - uThick);
      // smoothstep needs edge0 < edge1 (edge0 >= edge1 is UB in GLSL), so ascend + invert.
      float heat = clamp(smoothstep(ir-aa, ir+aa, rp) - smoothstep(uRad-aa, uRad+aa, rp), 0.0, 1.0);
      o = vec4(heat, 0.0, 0.0, 1.0);
    }`;
    // Shape grid: a tiled lattice of one shape (circle↔square via uSquare), each cell
    // pulsing in size out of phase with its neighbours.
    const FS_SHAPEGRID = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uCells; uniform float uDot; uniform float uSquare; uniform float uPulse; uniform float uZoom;
    out vec4 o;
    void main(){
      vec2 p = gl_FragCoord.xy/uSize - 0.5; p.x *= uSize.x/uSize.y; p /= uZoom;
      vec2 g = p * uCells; vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
      float rad = uDot * (1.0 + uPulse*sin(uTime + cell.x*0.7 + cell.y*1.3));
      float d = mix(length(f), max(abs(f.x), abs(f.y)), uSquare);
      float aa = 1.5/uSize.y * uCells;
      o = vec4(clamp(1.0 - smoothstep(rad-aa, rad+aa, d), 0.0, 1.0), 0.0, 0.0, 1.0);   // ascend + invert (GLSL smoothstep needs edge0<edge1)
    }`;
    // Concentric rings: nested N-gon (or circle) contours marching outward over time.
    const FS_CONCENTRIC = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform float uTime; uniform float uSides; uniform float uCount; uniform float uThick; uniform float uSpin; uniform float uZoom;
    out vec4 o;
    const float TAU = 6.2831853;
    void main(){
      vec2 p = gl_FragCoord.xy/uSize - 0.5; p.x *= uSize.x/uSize.y; p /= uZoom;
      float a = atan(p.y, p.x) + uSpin, seg = TAU/uSides;
      float rp = length(p) * cos(mod(a, seg) - seg*0.5) / cos(seg*0.5);
      float band = abs(fract(rp*uCount - uTime) - 0.5) * 2.0;            // 0 at a ring centre, 1 between
      float th = clamp(uThick, 0.02, 0.98);
      o = vec4(clamp(1.0 - smoothstep(1.0 - th, 1.0, band), 0.0, 1.0), 0.0, 0.0, 1.0);   // ascend + invert
    }`;
    // Bouncing shapes: a few shapes whose centres (uPos, computed on the CPU) drift and
    // bounce off the edges. Tick on a Fade / Fire feedback filter for glow trails.
    const FS_BOUNCE = `#version 300 es
    precision highp float;
    uniform vec2 uSize; uniform vec2 uPos[8]; uniform float uCount; uniform float uRad; uniform float uSquare; uniform float uZoom;
    out vec4 o;
    void main(){
      vec2 uv = (gl_FragCoord.xy/uSize - 0.5)/uZoom + 0.5;
      float asp = uSize.x/uSize.y, aa = 2.0/uSize.y, heat = 0.0; int n = int(uCount);
      for (int i=0;i<8;i++){
        if (i>=n) break;
        vec2 d = uv - uPos[i]; d.x *= asp;
        float dist = mix(length(d), max(abs(d.x), abs(d.y)), uSquare);
        heat = max(heat, 1.0 - smoothstep(uRad-aa, uRad+aa, dist));   // ascend + invert
      }
      o = vec4(clamp(heat, 0.0, 1.0), 0.0, 0.0, 1.0);
    }`;
    // heat → palette colour (fire-oriented, no flip yet)
