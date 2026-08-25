// --- "Show author" has to visibly do something --------------------------------------------
//
// Reported as doing nothing you can see, and it had two separate reasons to look that way.
// It gated the WHOLE banner rather than the author, so with no profile name and no collection
// there was no author to append, the scene name was suppressed along with it, and the tick
// changed nothing whichever way you set it. And the banner is only ever armed when a scene is
// SELECTED, so toggling it had no effect until the next time you picked one.
//
// Browser check: the banner is DOM chrome on a rendered-time countdown, so it is about what
// actually lands in #scenebanner. Deliberately NOT named *probe.js.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/author-check.js <outdir> [dev-index.html]"); process.exit(1); }
const app = fs.readFileSync(appFile, "utf8");

const seed = ["<script>",
  "try{localStorage.clear();"
  + "localStorage.setItem('burnTheWeb.v1',JSON.stringify({panelOpen:true,cycle:false}));"
  + "localStorage.setItem('burnTheWeb.tutorial.v1','1');"
  + "localStorage.setItem('burnTheWeb.credits.v1','off');"
  // A profile name, so there IS an author to show -- the whole question is whether the tick
  // puts it on the banner, and with nobody to credit the check would prove nothing.
  + "localStorage.setItem('burnTheWeb.profile.v1','Testy');"
  + "localStorage.setItem('burnTheWeb.sync.v1',JSON.stringify({shows:9,done:true}))}catch(e){}",
  "var __n=0;requestAnimationFrame=function(f){return (++__n<8)?setTimeout(function(){f(performance.now())},16):0};",
  "</" + "script>"].join(NL);

const body = [
  "var fails=0;",
  "function ok(n,c,d){ if(typeof n!=='string'){console.log('\"BAD ASSERTION\"');fails++;return;}",
  "  if(!c)fails++; console.log('\"'+(c?'PASS':'FAIL')+' '+n+(d?'  ['+d+']':'')+'\"'); }",
  "var chk=document.getElementById('sceneTitleOn');",
  "var ban=document.getElementById('scenebanner');",
  "ok('the tick and the banner both exist', !!chk && !!ban);",
  "function pick(){ var rows=[].slice.call(document.querySelectorAll('.pl-scene'));",
  "  if(rows.length) rows[0].click(); return ban.textContent.trim(); }",
  // ---- ON: the author is appended -------------------------------------------------------
  "chk.checked=true; chk.dispatchEvent(new Event('change',{bubbles:true}));",
  "var onText=ban.textContent.trim();",
  "ok('ticking it puts the author on the banner AT ONCE', /Testy/.test(onText), onText||'(empty)');",
  "ok('...alongside the scene name', onText.replace(/\\s*·\\s*Testy$/,'').length>0, onText);",
  // ---- OFF: the name stays, the author goes ---------------------------------------------
  "chk.checked=false; chk.dispatchEvent(new Event('change',{bubbles:true}));",
  "var offText=ban.textContent.trim();",
  "ok('UNTICKING IT REMOVES THE AUTHOR', !/Testy/.test(offText), offText||'(empty)');",
  "ok('...but KEEPS the scene name -- it is not a switch for the whole banner',",
  "   offText.length>0, offText||'(empty)');",
  "ok('...and that name is the same one', offText===onText.replace(/\\s*·\\s*Testy$/,''),",
  "   JSON.stringify(offText)+' vs '+JSON.stringify(onText));",
  // ---- it survives a real scene selection too --------------------------------------------
  "chk.checked=true; chk.dispatchEvent(new Event('change',{bubbles:true}));",
  "var sel=pick();",
  "ok('selecting a scene still credits it', /Testy/.test(sel), sel||'(empty)');",
  // ---- the hint --------------------------------------------------------------------------
  "var hint=document.getElementById('sceneAuthorHint');",
  "ok('the hint names who the scene is credited to', !!hint && /Testy/.test(hint.textContent),",
  "   hint?hint.textContent:'missing');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>", "setTimeout(function(){", body, "},2400);", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "author.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1400,900 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-author") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
