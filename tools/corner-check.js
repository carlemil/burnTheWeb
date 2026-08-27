// --- Layer boxes take corners in OPENING order, not by slot number ------------------------
//
// The corner SEQUENCE is unchanged -- top-left, top-right, bottom-left, bottom-right -- but
// it is handed out to whoever opens next rather than reserved for a particular layer. The
// decisive case is opening them out of order: open layer 3 first and its box belongs in the
// FIRST corner, because nothing else is using it.
//
// A slot-indexed placement passes any test that opens layers 1,2,3,4 in that order, which is
// exactly why this one does not do that.
//
// Browser check -- it is about measured rects. Deliberately NOT named *probe.js.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/corner-check.js <outdir> [dev-index.html]"); process.exit(1); }
const app = fs.readFileSync(appFile, "utf8");

const seed = ["<script>",
  "try{localStorage.clear();"
  + "localStorage.setItem('burnTheWeb.v1',JSON.stringify({panelOpen:true,cycle:false}));"
  + "localStorage.setItem('burnTheWeb.tutorial.v1','1');"
  + "localStorage.setItem('burnTheWeb.credits.v1','off');"
  + "localStorage.setItem('burnTheWeb.sync.v1',JSON.stringify({shows:9,done:true}))}catch(e){}",
  "var __n=0;requestAnimationFrame=function(f){return (++__n<8)?setTimeout(function(){f(performance.now())},16):0};",
  "</" + "script>"].join(NL);

const body = [
  "var fails=0;",
  "function ok(n,c,d){ if(typeof n!=='string'){console.log('\"BAD ASSERTION\"');fails++;return;}",
  "  if(!c)fails++; console.log('\"'+(c?'PASS':'FAIL')+' '+n+(d?'  ['+d+']':'')+'\"'); }",
  "function vis(l){return [].slice.call(l).filter(function(n){return n.style.display!=='none'&&n.offsetParent!==null})}",
  "var VW=window.innerWidth, VH=window.innerHeight;",
  "function rowsNow(){return vis(document.querySelectorAll('#panel .lyr'))}",
  "var add=document.getElementById('addlayer');",
  "for(var i=0;i<6&&rowsNow().length<4;i++){ if(add) add.click(); }",
  "ok('the stack has four layers', rowsNow().length===4, rowsNow().length+' rows');",
  "function openLayer(i){ rowsNow()[i].querySelector('button.lyr-pop').click(); }",
  "function boxOf(slot){ return document.querySelector('#breakout .lyr-box[data-slot=\"'+slot+'\"]'); }",
  // Which corner a box is sitting in, as a name.
  "function cornerOf(slot){ var b=boxOf(slot); if(!b||b.style.display==='none') return 'closed';",
  "  var r=b.getBoundingClientRect();",
  "  return (r.top+r.height/2<VH/2?'top':'bottom')+'-'+(r.left+r.width/2<VW/2?'left':'right'); }",
  // The canonical sequence, read left-to-right / top-to-bottom.
  "var SEQ=['top-left','top-right','bottom-left','bottom-right'];",
  // ---- THE DECISIVE CASE: open them OUT of index order ------------------------------------
  "openLayer(2);",                     // layer 3 first
  "ok('LAYER 3 OPENED FIRST TAKES THE FIRST CORNER', cornerOf(2)===SEQ[0],",
  "   'layer 3 is ' + cornerOf(2) + ', wanted ' + SEQ[0]);",
  "openLayer(3);",                     // layer 4 second
  "ok('...and layer 4 opened second takes the second', cornerOf(3)===SEQ[1],",
  "   'layer 4 is ' + cornerOf(3) + ', wanted ' + SEQ[1]);",
  "openLayer(0);",                     // layer 1 third
  "ok('...and layer 1 opened third takes the third', cornerOf(0)===SEQ[2],",
  "   'layer 1 is ' + cornerOf(0) + ', wanted ' + SEQ[2]);",
  "openLayer(1);",                     // layer 2 last
  "ok('...and layer 2 opened last takes the fourth', cornerOf(1)===SEQ[3],",
  "   'layer 2 is ' + cornerOf(1) + ', wanted ' + SEQ[3]);",
  "var got=[0,1,2,3].map(cornerOf);",
  "ok('all four corners are occupied exactly once', new Set(got).size===4,",
  "   got.join(' | '));",
  // ---- a freed corner comes back into circulation -----------------------------------------
  // Close the box holding the FIRST corner (layer 3), then reopen a different layer's box
  // that has never been placed... every layer is open here, so instead close layer 3 and
  // confirm the corner is genuinely released, then reopen it and confirm it goes back where
  // it was (brkPos remembers a placement -- reopening is not a fresh open).
  "var was=cornerOf(2);",
  "rowsNow()[2].querySelector('button.lyr-pop').click();",
  "ok('closing a layer box hides it', cornerOf(2)==='closed', cornerOf(2));",
  "rowsNow()[2].querySelector('button.lyr-pop').click();",
  "ok('...and reopening puts it back where it was', cornerOf(2)===was,",
  "   was + ' -> ' + cornerOf(2));",
  // ---- nothing off screen, nothing overlapping --------------------------------------------
  "var rs=vis(document.querySelectorAll('#breakout > .ctl.lyr-box')).map(function(b){return b.getBoundingClientRect()});",
  "var offs=rs.filter(function(r){return r.left<-0.5||r.top<-0.5||r.right>VW+0.5||r.bottom>VH+0.5});",
  "ok('no layer box is off screen', offs.length===0, offs.length+' off screen of '+rs.length);",
  "var ovl=0;",
  "for(var a=0;a<rs.length;a++) for(var b2=a+1;b2<rs.length;b2++){ var p=rs[a],q=rs[b2];",
  "  if(!(p.right<=q.left+0.5||p.left>=q.right-0.5||p.bottom<=q.top+0.5||p.top>=q.bottom-0.5)) ovl++; }",
  "ok('no two layer boxes overlap', ovl===0, ovl+' overlapping pairs');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>",
  "(function(){function go(){setTimeout(function(){", body, "},2400);}",
  "if(window.__appReady)go(); else addEventListener('app:ready',go,{once:true});})();", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "corner.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1600,1000 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-corner") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
