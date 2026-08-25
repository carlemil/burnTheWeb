// --- Random on the Effect tab leaves the camera and the shared world alone ----------------
//
// Both live on the Effect tab, and both are the wrong kind of thing for that button: the
// camera is where you have put yourself in the scene, and the world group is where this layer
// sits in a shared one. Rolling them does not vary the effect, it throws away a placement
// chosen by hand.
//
// The trap this check exists to avoid is the vacuous version: "nothing changed" passes just
// as well against a Random button that does nothing at all. So it also asserts that the
// effect's OWN sliders did move, in the same clicks.
//
// Browser check -- Random is a click handler over live DOM. Deliberately NOT named *probe.js.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/rndkeep-check.js <outdir> [dev-index.html]"); process.exit(1); }
const app = fs.readFileSync(appFile, "utf8");

const seed = ["<script>",
  "try{localStorage.clear();"
  + "localStorage.setItem('burnTheWeb.v1',JSON.stringify({panelOpen:true,cycle:false}));"
  + "localStorage.setItem('burnTheWeb.tutorial.v1','1');"
  + "localStorage.setItem('burnTheWeb.credits.v1','off');"
  + "localStorage.setItem('burnTheWeb.sync.v1',JSON.stringify({shows:9,done:true}))}catch(e){}",
  "var __n=0;requestAnimationFrame=function(f){return (++__n<6)?setTimeout(function(){f(performance.now())},16):0};",
  "</" + "script>"].join(NL);

const body = [
  "var fails=0;",
  "function ok(n,c,d){ if(typeof n!=='string'){console.log('\"BAD ASSERTION\"');fails++;return;}",
  "  if(!c)fails++; console.log('\"'+(c?'PASS':'FAIL')+' '+n+(d?'  ['+d+']':'')+'\"'); }",
  "function vis(l){return [].slice.call(l).filter(function(n){return n.style.display!=='none'&&n.offsetParent!==null})}",
  // Glass ball is the effect that carries BOTH groups: camera and the shared-world placement.
  "var row=vis(document.querySelectorAll('select.lyr-name'))[0];",
  "var o=[].slice.call(row.options).filter(function(o){return o.textContent.trim()==='Glass ball'})[0];",
  "ok('Glass ball is selectable', !!o);",
  "row.value=o.value; row.dispatchEvent(new Event('change',{bubbles:true}));",
  "document.querySelector('#panel .lyr button.lyr-pop').click();",
  "var lb=document.querySelector('#breakout .lyr-box[data-slot=\"0\"]');",
  "ok('the layer box opened', !!lb);",
  // The keys that must not move, and some that must.
  "var KEEP=['zoom','camrx','camry','camrz','fov','wldx','wldy','wldz','wldscale'];",
  "var ROLL=['gbcount','gbsize','gbior','gbglow'];",
  "function readAll(keys){ var o={}; keys.forEach(function(k){",
  "  ['-lo','-hi'].forEach(function(sfx){",
  "    var e=[].slice.call(document.querySelectorAll('[data-k='+k+sfx+']'))[0];",
  "    if(e) o[k+sfx]=e.value; }); }); return o; }",
  "var before=readAll(KEEP.concat(ROLL));",
  "ok('the camera and world sliders are present on this tab',",
  "   KEEP.filter(function(k){return before[k+'-lo']!==undefined}).length>=6,",
  "   KEEP.filter(function(k){return before[k+'-lo']!==undefined}).join(','));",
  "ok('...and so are the effect\\'s own sliders',",
  "   ROLL.filter(function(k){return before[k+'-lo']!==undefined}).length>=3);",
  // Make sure the camera is NOT sitting at a value Random could only reproduce -- give it a
  // distinctive setting first, so "unchanged" is a real observation.
  "KEEP.forEach(function(k){ ['-lo','-hi'].forEach(function(sfx){",
  "  var e=[].slice.call(document.querySelectorAll('[data-k='+k+sfx+']'))[0];",
  "  if(!e) return; var mn=+e.min, mx=+e.max;",
  "  e.value=String(mn+(mx-mn)*0.37); e.dispatchEvent(new Event('input',{bubbles:true})); }); });",
  "var pinned=readAll(KEEP);",
  // Click Random on the Effect tab a good number of times.
  "var rnd=lb.querySelector('[data-k=rnd-fx]');",
  "ok('the Effect tab has a Random button', !!rnd);",
  "for(var i=0;i<12&&rnd;i++) rnd.click();",
  "var after=readAll(KEEP.concat(ROLL));",
  // ---- the claim --------------------------------------------------------------------------
  "var moved=Object.keys(pinned).filter(function(k){ return after[k]!==pinned[k]; });",
  "ok('RANDOM LEAVES THE CAMERA AND THE SHARED WORLD ALONE', moved.length===0,",
  "   moved.length?('moved: '+moved.map(function(k){return k+' '+pinned[k]+'->'+after[k]}).join(', '))",
  "              :Object.keys(pinned).length+' values held over 12 rolls');",
  // ---- and the check is not vacuous -------------------------------------------------------
  "var rolled=ROLL.filter(function(k){ return after[k+'-lo']!==before[k+'-lo']; });",
  "ok('...while the effect\\'s own sliders DID move', rolled.length>0,",
  "   rolled.length?('rolled: '+rolled.join(',')):'nothing moved -- this check proves nothing');",
  // A beat trigger must not be armed on them either.
  "var armedCam=KEEP.filter(function(k){",
  "  var box=[].slice.call(document.querySelectorAll('#breakout [data-brk$=\"/'+k+'\"]'))[0];",
  "  if(!box) return false;",
  "  return [].slice.call(box.querySelectorAll('.on')).length>0; });",
  "ok('...and no beat trigger was armed on them', armedCam.length===0, armedCam.join(',')||'none');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>", "setTimeout(function(){", body, "},2400);", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "rndkeep.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1600,1000 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-rndkeep") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
