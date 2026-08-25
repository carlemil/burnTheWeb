// --- Slider boxes build columns beside their layer box ------------------------------------
//
// The four rules, as asked for:
//   1. every box is the SAME WIDTH (heights may differ)
//   2. a slider box goes on the side of its layer box FACING THE CENTRE of the screen
//   3. it inherits the layer box's vertical anchor (top stays top, bottom stays bottom)
//   4. boxes stack down (or up) a column until one would start past the vertical centre,
//      and then a new column begins next to the previous one
//
// A browser check, not a node probe: every one of these is a statement about measured rects
// and CSS anchoring, and a model of that would be a model of the bug too. Deliberately NOT
// named *probe.js -- /deploy runs `node tools/*probe.js` over the whole directory.
"use strict";
const fs = require("fs");
const path = require("path");
const NL = "\n";
const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.log("usage: node tools/brkcolumn-check.js <outdir> [dev-index.html]"); process.exit(1); }
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
  "var VW=window.innerWidth, VH=window.innerHeight, MIDY=VH/2, MIDX=VW/2;",
  // THREE layer boxes, and the count is deliberate. Corners are handed out in OPENING order
  // now, so two boxes both land in the top half and there is no bottom-anchored one to test
  // the vertical mirror against. Three gives top-left, top-right and bottom-left, and the
  // first and third are the pair worth checking.
  // The shipped starter scene is single-layer, so top the stack up first.
  "function rowsNow(){return vis(document.querySelectorAll('#panel .lyr'))}",
  "var add=document.getElementById('addlayer');",
  "for(var i=0;i<6&&rowsNow().length<4;i++){ if(add) add.click(); }",
  "var rows=rowsNow();",
  "ok('the stack has four layer rows', rows.length===4, rows.length+' rows');",
  "rows[0].querySelector('button.lyr-pop').click();",
  "rows[1].querySelector('button.lyr-pop').click();",
  "rows[2].querySelector('button.lyr-pop').click();",
  "var lb0=document.querySelector('#breakout .lyr-box[data-slot=\"0\"]');",
  "var lb3=document.querySelector('#breakout .lyr-box[data-slot=\"2\"]');",
  "ok('three layer boxes opened', !!lb0&&!!lb3&&lb0.style.display!=='none'&&lb3.style.display!=='none');",
  // Which corner each actually landed in -- derived, never assumed. Corners follow opening
  // order, so hard-coding "layer 4 is bottom-right" is exactly the assumption that broke.
  "function cornerName(b){ var r=b.getBoundingClientRect();",
  "  return (r.top+r.height/2<MIDY?'top':'bottom')+'-'+(r.left+r.width/2<MIDX?'left':'right'); }",
  "ok('the first box opened is in the top-left corner', cornerName(lb0)==='top-left', cornerName(lb0));",
  "ok('the third is in the bottom-left', cornerName(lb3)==='bottom-left', cornerName(lb3));",
  // ---- rule 1: one width for everything -----------------------------------------------
  "function pops(){return vis(document.querySelectorAll('#breakout > .ctl.poppable'))}",
  "var w0=Math.round(lb0.getBoundingClientRect().width);",
  "ok('RULE 1 the two layer boxes are the same width',",
  "   w0===Math.round(lb3.getBoundingClientRect().width),",
  "   w0+' vs '+Math.round(lb3.getBoundingClientRect().width));",
  // Pop several sliders out of each layer so columns have to form.
  "function popFrom(lb,n){ var L=vis(lb.querySelectorAll('.ctl-row .ctl-pop'));",
  "  for(var i=0;i<n&&i<L.length;i++) L[i].click(); return Math.min(n,L.length); }",
  "var n0=popFrom(lb0,2), n3=popFrom(lb3,2);",
  "ok('sliders popped out of both layers', n0>=2&&n3>=2, n0+' and '+n3);",
  "var all=pops();",
  "var widths={}; all.forEach(function(b){ widths[Math.round(b.getBoundingClientRect().width)]=1; });",
  "ok('RULE 1 EVERY BOX IN THE GRID IS THE SAME WIDTH', Object.keys(widths).length===1,",
  "   all.length+' boxes, widths '+Object.keys(widths).join('/'));",
  "var heights={}; all.forEach(function(b){ heights[Math.round(b.getBoundingClientRect().height)]=1; });",
  "ok('...while heights are free to differ', Object.keys(heights).length>1,",
  "   Object.keys(heights).length+' distinct heights');",
  // ---- rules 2-4, per layer -------------------------------------------------------------
  "function sliderBoxesOf(slot){ return pops().filter(function(b){",
  "  return b.dataset.slot===String(slot) && !b.classList.contains('lyr-box'); }); }",
  "function checkLayer(slot, lb, label){",
  "  var lr=lb.getBoundingClientRect();",
  "  var boxes=sliderBoxesOf(slot);",
  "  if(!boxes.length){ ok(label+' has slider boxes', false, 'none'); return; }",
  "  var layerLeftHalf = lr.left+lr.width/2 < MIDX;",
  "  var bad=[];",
  "  boxes.forEach(function(b){ var r=b.getBoundingClientRect();",
  // rule 2: on the centre-facing side of the layer box
  "    if(layerLeftHalf){ if(r.left < lr.right - 1) bad.push('left of a left-half layer box'); }",
  "    else { if(r.right > lr.left + 1) bad.push('right of a right-half layer box'); }",
  "  });",
  "  ok(label+' RULE 2 sliders sit on the side facing the centre', bad.length===0, bad.join(' | ')||boxes.length+' boxes');",
  // rule 3: same CSS anchor edge as the layer box
  "  var lbBottom = lb.style.bottom!=='' && lb.style.bottom!=='auto';",
  "  var wrong=boxes.filter(function(b){",
  "    var bb = b.style.bottom!=='' && b.style.bottom!=='auto'; return bb!==lbBottom; });",
  "  ok(label+' RULE 3 sliders inherit the layer box vertical anchor', wrong.length===0,",
  "     'layer '+(lbBottom?'bottom':'top')+'-anchored, '+wrong.length+' box(es) differ');",
  // rule 4: a column does not continue past the vertical centre
  "  var cols={};",
  "  boxes.forEach(function(b){ var r=b.getBoundingClientRect(); var k=Math.round(r.left/10)*10;",
  "    (cols[k]=cols[k]||[]).push(r); });",
  "  var over=[];",
  "  Object.keys(cols).forEach(function(k){ cols[k].forEach(function(r){",
  "    if(lbBottom){ if(r.bottom < MIDY - 1) over.push('a box wholly above the middle in a bottom column'); }",
  "    else { if(r.top > MIDY + 1) over.push('a box starting below the middle in a top column'); }",
  "  }); });",
  "  ok(label+' RULE 4 no box starts past the vertical centre', over.length===0,",
  "     over[0]||Object.keys(cols).length+' column(s)');",
  "  return Object.keys(cols).length;",
  "}",
  "var c0=checkLayer(0,lb0,'the top-left box');",
  "var c3=checkLayer(2,lb3,'the bottom-left box');",
  "ok('RULE 4 both layers form at least one slider column', (c0>=1)&&(c3>=1),",
  "   'columns: '+c0+' and '+c3);",
  // ---- the invariants that must survive -------------------------------------------------
  "var offs=[], ovl=[];",
  "var rs=pops().map(function(b){return b.getBoundingClientRect()});",
  "rs.forEach(function(r,i){",
  "  if(r.left<-0.5||r.top<-0.5||r.right>VW+0.5||r.bottom>VH+0.5)",
  "    offs.push('#'+i+' l='+Math.round(r.left)+' t='+Math.round(r.top)+' r='+Math.round(r.right)+' b='+Math.round(r.bottom));",
  "  for(var j=i+1;j<rs.length;j++){ var q=rs[j];",
  "    if(!(r.right<=q.left+0.5||r.left>=q.right-0.5||r.bottom<=q.top+0.5||r.top>=q.bottom-0.5))",
  "      ovl.push(i+'/'+j); }",
  "});",
  "ok('NO BOX IS OFF SCREEN', offs.length===0, offs.join(' | ')||rs.length+' boxes inside '+VW+'x'+VH);",
  "ok('NO TWO BOXES OVERLAP', ovl.length===0, ovl.join(' | ')||'clear');",
  "console.log('\"DONE fails='+fails+'\"');",
].join(NL);

const inject = ["<script>", "setTimeout(function(){", body, "},2400);", "</" + "script>"].join(NL);
let s = app.split("<head>").join("<head>" + NL + seed);
s = s.split("</body>").join(inject + NL + "</body>");
const out = path.join(outDir, "brkcolumn.html");
fs.writeFileSync(out, s);
console.log("wrote " + out);
console.log("run: msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 "
  + "--window-size=1600,1000 --virtual-time-budget=30000 "
  + '--user-data-dir="' + path.join(outDir, "ud-brkcolumn") + '" "file:///' + out.replace(/\\/g, "/")
  + "\" 2>&1 | grep -oE '\"(PASS|FAIL|DONE)[^\"]*\"'");
