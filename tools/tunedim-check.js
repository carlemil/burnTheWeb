// --- A tuning row following the default is DIMMED, not labelled "global" ------------------
//
// It used to print the word "global" in every row that had not been overridden -- which is
// most rows most of the time, so the ordinary state was the loud one and the interesting
// state (an override) was silent. Now the row following the default is dimmed by about 20%
// and an overridden one is at full brightness.
//
// Two things are worth checking and only one of them is obvious. The obvious one is that the
// dimming is really applied and really lifts. The other is that it is NOT the disabled path:
// setOff()/.off/[disabled] mean "this control is switched off" in this codebase, dimming a
// live control through them has cost real bugs before, and these rows stay fully interactive
// and keyboard-reachable.
//
// A browser check: it is about computed style and a live class toggle. Deliberately NOT named
// *probe.js -- /deploy runs `node tools/*probe.js` over the whole directory.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/tunedim-check.js <outdir> [dev-index.html]"); process.exit(1); }
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
  // Open layer 1's box, pop a slider out, and arm a band so the Tuning rows appear at all.
  "document.querySelector('#panel .lyr button.lyr-pop').click();",
  "var lb=document.querySelector('#breakout .lyr-box[data-slot=\"0\"]');",
  "ok('layer 1 box opened', !!lb);",
  "vis(lb.querySelectorAll('.ctl-row .ctl-pop'))[0].click();",
  "var box=vis(document.querySelectorAll('#breakout > .ctl.poppable'))",
  "  .filter(function(b){return !b.classList.contains('lyr-box')})[0];",
  "ok('a slider box is open', !!box);",
  // Arm a chip -- the Tuning block only shows for an armed band.
  "var chip=box.querySelector('.chip')||box.querySelector('.trig-chip')||box.querySelector('button');",
  "var chips=[].slice.call(box.querySelectorAll('button')).filter(function(b){return /^[LMH]$/i.test((b.textContent||'').trim())});",
  "ok('found the L/M/H trigger chips', chips.length>=3, chips.length+' chips');",
  "if(chips.length) chips[0].click();",
  "var rows=vis(box.querySelectorAll('.trig-ref'));",
  "ok('the Tuning rows are showing', rows.length>0, rows.length+' rows');",
  // ---- the tag is gone -------------------------------------------------------------------
  "ok('NO \"global\" TAG ANYWHERE IN THE BOX',",
  "   box.querySelectorAll('.trig-ref-tag').length===0 && !/\\bglobal\\b/i.test(box.textContent),",
  "   box.querySelectorAll('.trig-ref-tag').length+' tag nodes');",
  // ---- the dimming is real ----------------------------------------------------------------
  "var row=rows[0];",
  "ok('an untouched row is marked as following the default', row.classList.contains('is-default'),",
  "   row.className);",
  "var rng=row.querySelector('input[type=range]');",
  "var csR=getComputedStyle(row), csI=getComputedStyle(rng);",
  "var op=parseFloat(csR.opacity), fil=csI.filter||'';",
  "ok('...and is visibly dimmer', (op>0.6&&op<0.95)||/brightness\\(0?\\.[6-9]/.test(fil),",
  "   'opacity '+op+', filter '+fil);",
  "ok('...by roughly 20%, not so much it reads as switched off', op>=0.7,",
  "   'opacity '+op);",
  // ---- and it is NOT the disabled path ----------------------------------------------------
  "ok('the control is NOT disabled', !rng.disabled && rng.getAttribute('aria-disabled')!=='true');",
  "ok('...and does not use the .off class', !row.classList.contains('off') && !rng.classList.contains('off'));",
  "ok('...and still takes pointer events', getComputedStyle(rng).pointerEvents!=='none',",
  "   getComputedStyle(rng).pointerEvents);",
  "ok('...and is still keyboard reachable', rng.tabIndex>=0 || rng.tabIndex===undefined,",
  "   'tabIndex '+rng.tabIndex);",
  // ---- overriding lifts it ----------------------------------------------------------------
  "var before=row.className;",
  "rng.value=String(Math.min(+rng.max, (+rng.value)+ (+rng.step||1)*3));",
  "rng.dispatchEvent(new Event('input',{bubbles:true}));",
  "ok('OVERRIDING THE ROW LIFTS THE DIMMING', !row.classList.contains('is-default'),",
  "   before+' -> '+row.className);",
  "ok('...and its opacity comes back to full', parseFloat(getComputedStyle(row).opacity)>0.95,",
  "   getComputedStyle(row).opacity);",
  // A neighbouring row that was NOT touched must still be dimmed -- the cue is per row.
  "var others=vis(box.querySelectorAll('.trig-ref')).filter(function(x){return x!==row});",
  "ok('a neighbouring untouched row stays dimmed',",
  "   others.length===0 || others.some(function(x){return x.classList.contains('is-default')}),",
  "   others.length+' other rows');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>", "setTimeout(function(){", body, "},2400);", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "tunedim.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1600,1000 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-tunedim") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
