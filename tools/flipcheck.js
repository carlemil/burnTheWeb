#!/usr/bin/env node
// FS_COMP Y-FLIP: does an image passing through the Bloom chain pass come out inverted?
//
//   node tools/flipcheck.js <outdir> [dev-index.html]     then run the printed msedge line
//
// FS_COMP samples vec2(vUv.x, 1.0 - vUv.y) and it is the ONLY Y-flip in any shader in the app.
// glProg.comp has exactly two call sites: the final present (which is what maps heat-buffer row 0
// to the screen top) and glBloomPass, which is an ordinary per-layer post-chain entry. So a layer
// carrying Bloom goes through that flip TWICE and a layer without it once.
//
// This pulls the REAL VS_QUAD and FS_COMP out of the built file and runs them on the real GPU
// over a texture whose top row is lit, so the answer does not depend on scene timing, on which
// preset happened to be up, or on an effect being a good witness (most are vertically symmetric,
// which is exactly why this could hide).
"use strict";
const fs = require("fs"), path = require("path");
const out = process.argv[2] || ".";
const src = fs.readFileSync(process.argv[3] || "dev-index.html", "utf8");

function grab(name) {
  const k = src.indexOf("const " + name + " = `");
  if (k < 0) throw new Error("missing " + name);
  const a = src.indexOf("`", k) + 1, b = src.indexOf("`", a);
  return src.slice(a, b);
}
const VS = grab("VS_QUAD"), FS = grab("FS_COMP");
if (!/1\.0 - vUv\.y/.test(FS)) console.log("NOTE: FS_COMP no longer contains the flip");

const page = [
'<!doctype html><meta charset="utf-8"><title>flip</title><canvas id=c width=4 height=4></canvas>',
'<script>',
'var VS = ' + JSON.stringify(VS) + ';',
'var FS = ' + JSON.stringify(FS) + ';',
'var gl = document.getElementById("c").getContext("webgl2");',
'function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);',
'  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.log("RESULT compile error "+gl.getShaderInfoLog(o));return o;}',
'var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));',
'gl.linkProgram(p);',
'if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.log("RESULT link error "+gl.getProgramInfoLog(p));',
'gl.useProgram(p);',
'var vao=gl.createVertexArray();gl.bindVertexArray(vao);',
// source: 4x4 RGBA, TOP ROW (row 0) white, rest black
'var N=4, px=new Uint8Array(N*N*4);',
'for(var x=0;x<N;x++){px[x*4]=255;px[x*4+1]=255;px[x*4+2]=255;px[x*4+3]=255;}',
'function tex(data){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);',
'  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,data);',
'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);',
'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);',
'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);',
'  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}',
'var black=tex(new Uint8Array(N*N*4));',
// one FS_COMP pass from `t` into a fresh FBO, returns the read-back rows
'function pass(t,flip){var o=tex(new Uint8Array(N*N*4));',
'  var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);',
'  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,o,0);',
'  gl.viewport(0,0,N,N);gl.useProgram(p);',
'  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(gl.getUniformLocation(p,"uScene"),0);',
'  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,black);gl.uniform1i(gl.getUniformLocation(p,"uGlow"),1);',
'  gl.uniform1f(gl.getUniformLocation(p,"uBloom"),0);',
'  var lf=gl.getUniformLocation(p,"uFlip"); if(lf) gl.uniform1f(lf,flip);',
'  gl.drawArrays(gl.TRIANGLES,0,3);',
'  var r=new Uint8Array(N*N*4);gl.readPixels(0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,r);',
'  return {tex:o,rows:r};}',
'function litRow(r){for(var y=0;y<N;y++){if(r[(y*N)*4]>128)return y;}return -1;}',
'var src0=tex(px);',
'var hasFlip = gl.getUniformLocation(p,"uFlip") !== null;',
'console.log("RESULT uFlip_uniform_present="+hasFlip);',
// a layer WITHOUT Bloom: the present pass only
'var plain = litRow(pass(src0,1).rows);',
// a layer WITH Bloom: the chain pass (no flip) then the present pass (flip)
'var chain = pass(src0,0);',
'var bloomed = litRow(pass(chain.tex,1).rows);',
'console.log("RESULT noBloom_litRow="+plain+" withBloom_litRow="+bloomed);',
'console.log("RESULT verdict="+(plain===bloomed?"PASS a Bloom layer lands the same way up as one without it":"FAIL Bloom inverts the picture"));',
'<\/script>',
].join("\n");

const f = path.join(out, "flipcheck.html");
fs.writeFileSync(f, page);
console.log("wrote " + f);
console.log("Run this and grep RESULT:");
console.log("  msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 --virtual-time-budget=6000 \"file:///" + f.split(String.fromCharCode(92)).join("/") + "\"");
