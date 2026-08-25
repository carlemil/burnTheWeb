// --- A DROPPED BOX IS ALWAYS FULLY ON SCREEN ------------------------------------------
//
// Reported: dropping a slider box onto the LOWER EDGE of layer 1's box (which sits in the
// top-left corner) sent it mostly off screen, its bottom aligned to the layer box's top.
// The de-overlap nudge in dragEnd searched one direction only -- upward for a box whose
// centre had crossed the vertical middle -- and brkPlace's Math.max(0, ...) pair clamps the
// anchored edge's OFFSET, never the box's far edge.
//
// This drives the real drag handlers with real pointer events at several drop points and
// asserts the two things the user asked for: fully inside the viewport, and not overlapping
// anything. Browser, not node: the whole bug lives in measured rects and CSS anchoring, and
// a model of that would be a model of the bug too.
//
// Deliberately NOT named *probe.js -- /deploy runs `node tools/*probe.js` over the whole
// directory and this needs a browser.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/brkdrop-check.js <outdir> [dev-index.html]"); process.exit(1); }
const app = fs.readFileSync(appFile, "utf8");

const seed = ["<script>",
  "try{localStorage.clear();"
  + "localStorage.setItem('burnTheWeb.v1',JSON.stringify({panelOpen:true,cycle:false}));"
  + "localStorage.setItem('burnTheWeb.tutorial.v1','1');"
  + "localStorage.setItem('burnTheWeb.credits.v1','off');"
  + "localStorage.setItem('burnTheWeb.sync.v1',JSON.stringify({shows:9,done:true}))}catch(e){}",
  // DOM-only run: let a few frames through so the app initialises, then stop the loop.
  "var __n=0;requestAnimationFrame=function(f){return (++__n<6)?setTimeout(function(){f(performance.now())},16):0};",
  "</" + "script>"].join(NL);

const body = [
  "var fails=0;",
  "function ok(n,c,d){ if(typeof n!=='string'){console.log('\"BAD ASSERTION\"');fails++;return;}",
  "  if(!c)fails++; console.log('\"'+(c?'PASS':'FAIL')+' '+n+(d?'  ['+d+']':'')+'\"'); }",
  "function vis(q){return [].slice.call(document.querySelectorAll(q)).filter(function(n){return n.style.display!=='none'&&n.offsetParent!==null})}",
  // Open layer 1's settings box (its default corner is top-left) and pop a slider out of it.
  "var pop=document.querySelector('#panel .lyr button.lyr-pop');",
  "ok('layer 1 has a + launcher', !!pop);",
  "if(pop) pop.click();",
  "var lb=document.querySelector('#breakout .lyr-box[data-slot=\"0\"]');",
  "ok('layer 1 box opened', !!lb && lb.style.display!=='none');",
  // Pop the first slider in that layer box out into its own box.
  "var launchers=lb?[].slice.call(lb.querySelectorAll('.ctl-row .ctl-pop')).filter(function(n){return n.offsetParent!==null}):[];",
  "ok('the layer box offers slider launchers', launchers.length>0, launchers.length+' launchers');",
  "if(launchers.length) launchers[0].click();",
  "var boxes=vis('#breakout > .ctl.poppable');",
  "ok('a slider box is now on the grid', boxes.length>=2, boxes.length+' boxes');",
  "var sb=boxes.filter(function(b){return !b.classList.contains('lyr-box')})[0];",
  "ok('and it is not the layer box', !!sb);",
  // Drag it by its title bar and drop it at a series of points ON the layer box, working
  // down toward its lower edge -- the reported gesture.
  "function drop(tx,ty){",
  "  var h=sb.querySelector('.ctl-owner .own-txt')||sb.querySelector('.ctl-owner');",
  "  if(!h) return false;",
  "  var r=sb.getBoundingClientRect();",
  "  var hr=h.getBoundingClientRect();",
  "  var sx=hr.left+hr.width/2, sy=hr.top+hr.height/2;",
  "  function ev(t,x,y){ var e=new PointerEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,pointerId:1,button:0,buttons:1});",
  "    (t==='pointerdown'?h:document).dispatchEvent(e); }",
  "  ev('pointerdown',sx,sy);",
  "  ev('pointermove',sx+(tx-r.left-r.width/2),sy+(ty-r.top-r.height/2));",
  "  ev('pointerup',sx+(tx-r.left-r.width/2),sy+(ty-r.top-r.height/2));",
  "  return true;",
  "}",
  "var lr=lb.getBoundingClientRect();",
  // Several heights down the layer box, ending a few px inside its bottom edge -- the exact
  // reported drop. Each is checked independently; one bad landing is a failure.
  "var ys=[lr.top+lr.height*0.5, lr.bottom-40, lr.bottom-8, lr.bottom+4];",
  "var bad=[];",
  "ys.forEach(function(ty,i){",
  "  if(!drop(lr.left+lr.width*0.5, ty)) { bad.push('#'+i+' no handle'); return; }",
  "  var r=sb.getBoundingClientRect();",
  "  var vw=window.innerWidth, vh=window.innerHeight;",
  "  if(r.left<-0.5||r.top<-0.5||r.right>vw+0.5||r.bottom>vh+0.5)",
  "    bad.push('#'+i+' offscreen l='+Math.round(r.left)+' t='+Math.round(r.top)+' r='+Math.round(r.right)+' b='+Math.round(r.bottom)+' vw='+vw+' vh='+vh);",
  "});",
  "ok('EVERY DROP LANDS FULLY ON SCREEN', bad.length===0, bad.join(' | ')||ys.length+' drops, all inside');",
  // ...and does not bury the layer box it was dropped onto.
  "var r2=sb.getBoundingClientRect(), l2=lb.getBoundingClientRect();",
  "var over=!(r2.right<=l2.left+0.5||r2.left>=l2.right-0.5||r2.bottom<=l2.top+0.5||r2.top>=l2.bottom-0.5);",
  "ok('and does not overlap the layer box it was dropped on', !over,",
  "   over?('slider '+Math.round(r2.left)+','+Math.round(r2.top)+' vs layer '+Math.round(l2.left)+','+Math.round(l2.top)):'clear');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>", "setTimeout(function(){", body, "},2200);", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "brkdrop.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1600,1000 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-brkdrop") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
