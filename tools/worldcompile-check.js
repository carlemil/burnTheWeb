#!/usr/bin/env node
// Compile every #define COMBINATION of the world shader in a real WebGL2 context. The
// groups are #if'd in and out per scene, so the shader is really sixteen shaders, and a
// brace that is only unbalanced when one group is ABSENT compiles fine in every manual
// test that has that group present -- which is how W_GB=0 shipped with an unclosed else
// and Quaternion-Julia-only worlds failed with "0:398 syntax error" on every frame.
//
//   node tools/worldcompile-check.js <outdir> [dev-index.html]
//   then run the printed msedge command; one COMPILE line per combination.
const fs = require("fs"), path = require("path");
const NL = String.fromCharCode(10), Q = String.fromCharCode(39);
const outDir = process.argv[2], file = process.argv[3] || "dev-index.html";
if (!outDir) { console.error("usage: node tools/worldcompile-check.js <outdir> [file]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const s = fs.readFileSync(file, "utf8");
const cut = (from, to, start) => { const a = s.indexOf(from, start || 0) + from.length; return s.slice(a, s.indexOf(to, a)); };
const body = cut("const FS_WORLD = `", "`;");
const vsq = cut("const VS_QUAD = `", "`;");
const cam = cut("function camGlsl() { return `", "`; }");
const variants = [];
for (let m = 0; m < 16; m++) {
  const on = b => (m >> b) & 1;
  const key = ["gb", "sd", "qj", "vb"].filter((k, i) => on(i)).join("+") || "ocean-only";
  const def = NL + "#define W_GB " + on(0) + NL + "#define W_SD " + on(1) + NL + "#define W_QJ " + on(2) + NL + "#define W_VB " + on(3) + NL;
  const fsSrc = body.replace("#version 300 es" + NL, "#version 300 es" + def)
    .replace(/gl_FragCoord/g, "fragCam").replace("void main(){", cam + NL + "    void main(){ vec4 fragCam = camFrag4();");
  variants.push({ key, fsSrc });
}
const page = [
  "<canvas id=c width=8 height=8></canvas><script>",
  "var gl = document.getElementById('c').getContext('webgl2');",
  "var V = " + JSON.stringify(variants) + ", VS = " + JSON.stringify(vsq) + ";",
  "var vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VS); gl.compileShader(vs);",
  "var bad = 0;",
  "V.forEach(function(v){",
  "  var f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, v.fsSrc); gl.compileShader(f);",
  "  var ok = gl.getShaderParameter(f, gl.COMPILE_STATUS); if (!ok) bad++;",
  "  console.log('COMPILE ' + (ok ? 'PASS ' : 'FAIL ') + v.key + (ok ? '' : ' :: ' + gl.getShaderInfoLog(f).split(String.fromCharCode(10))[0]));",
  "  gl.deleteShader(f);",            // compile only -- a LINK is the 64-second stall
  "});",
  "console.log('COMPILE DONE bad=' + bad + ' of ' + V.length);",
  "<" + "/script>",
].join(NL);
const out = path.join(outDir, "worldcompile.html");
fs.writeFileSync(out, page);
const abs = path.resolve(outDir).split(path.sep).join("/");
console.log("wrote " + out + NL + "run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 --virtual-time-budget=20000 --user-data-dir=\"" + abs + "/ud\" \"file:///" + abs + "/worldcompile.html\" 2>&1 | grep -a -oE " + Q + "\"COMPILE[^\"]*\"" + Q);
