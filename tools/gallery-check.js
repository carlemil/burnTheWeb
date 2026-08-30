#!/usr/bin/env node
// BROWSER check (not *probe.js -- needs a real page): the Public scenes gallery costs ONE
// listing fetch a day and does its filter, pages and shuffle on the cache; and the ⚙ top
// button opens/closes the controls panel and follows the M key.
//
//   node tools/gallery-check.js <outdir> [dev-index.html]     then run the printed lines.
//
// case-cached: 45 fake profiles cached now, fetch stubbed to THROW -- 20 rows, "1 / 3",
//   paging, filter resets the page, and fetch is never called.
// case-stale: the same cache a day old -- fetch (stubbed to answer 3 profiles) fires ONCE,
//   even after Refresh. The negative control for the TTL.
// No backtick in the injected source; lines joined by an explicit newline.
const fs = require("fs");
const path = require("path");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);

const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.error("usage: node tools/gallery-check.js <outdir> [dev-index.html]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const app = fs.readFileSync(appFile, "utf8");

const head = [
  "<script>",
  "(function () {",
  "  var CASE = document.currentScript.dataset.c;",
  "  var fails = 0;",
  "  function ok(name, cond, extra) {",
  "    if (typeof name !== 'string') throw new Error('ok(name, cond): name must be a string');",
  "    if (!cond) fails++;",
  "    console.log((cond ? 'PASS ' : 'FAIL ') + ' ' + CASE + ' :: ' + name + (extra ? '  [' + extra + ']' : ''));",
  "  }",
  "  window.__ok = ok; window.__fails = function () { return fails; };",
  "  requestAnimationFrame = function () { return 0; };",
  "  var items = [];",
  "  for (var i = 0; i < 45; i++) items.push({ uid: 'u' + i, name: (i % 5 === 0 ? 'Zed ' : 'Name ') + i, count: i, updated: '2026-01-01' });",
  "  var age = CASE === 'case-stale' ? 86400001 : 0;",
  "  localStorage.setItem('burnTheWeb.gallery.v1', JSON.stringify({ t: Date.now() - age, items: items }));",
  "  localStorage.setItem('burnTheWeb.tutorial.v1', '1');",
  "  localStorage.setItem('burnTheWeb.v1', JSON.stringify({ panelOpen: false, cycle: false }));",
  "  window.__fetches = 0;",
  "  var realFetch = window.fetch;",
  "  window.fetch = function (url, opts) {",
  "    if (String(url).indexOf('runQuery') < 0) return realFetch.apply(this, arguments);",
  "    window.__fetches++;",
  "    if (CASE !== 'case-stale') return Promise.reject(new Error('fetch must not run'));",
  "    var docs = [];",
  "    for (var i = 0; i < 3; i++) docs.push({ document: { name: 'projects/x/databases/(default)/documents/profiles/f' + i,",
  "      fields: { name: { stringValue: 'Fresh ' + i }, count: { integerValue: '2' }, updated: { stringValue: '2026-08-30' } } } });",
  "    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(docs); } });",
  "  };",
  "})();",
  "</script>",
].join(NL);

const tail = [
  "<script>",
  "(function () {",
  "  var CASE = document.currentScript.dataset.c, ok = window.__ok;",
  "  var $ = function (id) { return document.getElementById(id); };",
  "  var rows = function () { return document.querySelectorAll('#gal-list .gal-row').length; };",
  "  var names = function () { return Array.prototype.map.call(document.querySelectorAll('#gal-list .gal-name'), function (n) { return n.textContent; }); };",
  "  setTimeout(function () {",
  "    // ---- the ⚙ panel button ----",
  "    var pb = $('panelbtn'), panel = $('panel');",
  "    ok('panel button exists', !!pb);",
  "    ok('starts closed and unpressed', panel.classList.contains('hidden') && pb.getAttribute('aria-pressed') === 'false');",
  "    pb.click();",
  "    ok('click opens the panel', !panel.classList.contains('hidden'));",
  "    ok('and marks the button', pb.getAttribute('aria-pressed') === 'true' && pb.classList.contains('on'));",
  "    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));",
  "    ok('M closes it and the button follows', panel.classList.contains('hidden') && pb.getAttribute('aria-pressed') === 'false');",
  "    ok('stored panelOpen follows', JSON.parse(localStorage.getItem('burnTheWeb.v1')).panelOpen === false);",
  "    document.body.classList.add('ui-hidden');",
  "    ok('hidden with the rest of the UI', getComputedStyle(pb).display === 'none');",
  "    document.body.classList.remove('ui-hidden');",
  "    // ---- the gallery ----",
  "    $('toggle').click();",
  "    var item = Array.prototype.find.call(document.querySelectorAll('#menubar button, #menubar .mb-item, #menubar li'), function (b) { return /Public scenes/.test(b.textContent); });",
  "    ok('menubar has Public scenes', !!item);",
  "    if (item) item.click();",
  "    setTimeout(function () {",
  "      ok('dialog open', !$('galdlg').classList.contains('hidden'));",
  "      if (CASE === 'case-stale') {",
  "        ok('stale cache fetched once', window.__fetches === 1, window.__fetches);",
  "        ok('fresh rows shown', rows() === 3 && /Fresh/.test(names()[0]), names().join(','));",
  "        ok('pager hidden with one page', $('gal-pager').classList.contains('hidden'));",
  "        $('gal-refresh').click();",
  "        ok('Refresh right after does not fetch again', window.__fetches === 1, window.__fetches);",
  "        ok('Refresh is dimmed with the once-a-day title', $('gal-refresh').disabled && /once a day/.test($('gal-refresh').title));",
  "        console.log('DONE ' + CASE + ' fails=' + window.__fails());",
  "        return;",
  "      }",
  "      ok('no fetch from cache', window.__fetches === 0);",
  "      ok('20 rows on page 1', rows() === 20, rows());",
  "      ok('pager reads 1 / 3', $('gal-page').textContent === '1 / 3', $('gal-page').textContent);",
  "      ok('Prev off, Next on', $('gal-prev').disabled && !$('gal-next').disabled);",
  "      var first = names().join('|');",
  "      $('gal-next').click();",
  "      ok('page 2 has 20 rows', rows() === 20 && $('gal-page').textContent === '2 / 3');",
  "      ok('page 2 differs', names().join('|') !== first);",
  "      $('gal-next').click();",
  "      ok('page 3 has 5 rows and Next off', rows() === 5 && $('gal-next').disabled, rows());",
  "      var fi = $('gal-filter'); fi.value = 'zed'; fi.dispatchEvent(new Event('input', { bubbles: true }));",
  "      ok('filter cuts to the 9 Zeds and resets to page 1', rows() === 9 && $('gal-page').textContent === '1 / 1', rows() + ' ' + $('gal-page').textContent);",
  "      ok('filter is case-insensitive', names().every(function (n) { return n.indexOf('Zed') === 0; }));",
  "      fi.value = 'nobody'; fi.dispatchEvent(new Event('input', { bubbles: true }));",
  "      ok('no match says so', rows() === 0 && /No one matches/.test($('gal-hint').textContent), $('gal-hint').textContent);",
  "      // reopen: filter cleared, order reshuffled (45 items: identical order twice is ~0)",
  "      $('gal-close').click(); $('toggle').click(); item.click();",
  "      setTimeout(function () {",
  "        ok('reopen clears the filter', $('gal-filter').value === '' && rows() === 20);",
  "        ok('reopen reshuffles', names().join('|') !== first);",
  "        ok('still no fetch', window.__fetches === 0);",
  "        console.log('DONE ' + CASE + ' fails=' + window.__fails());",
  "      }, 300);",
  "    }, 300);",
  "  }, 800);",
  "})();",
  "</script>",
].join(NL);

function build(c) {
  let html = app.split("<head>").join("<head>" + head.replace("<script>", "<script data-c=\"" + c + "\">"));
  html = html.split("</body>").join(tail.replace("<script>", "<script data-c=\"" + c + "\">") + "</body>");
  fs.writeFileSync(path.join(outDir, c + ".html"), html);
  console.log("wrote " + c + ".html");
}
build("case-cached");
build("case-stale");
const abs = path.resolve(outDir).split(path.sep).join("/");
console.log(NL + "run each with:");
for (const c of ["case-cached", "case-stale"]) {
  console.log('  msedge --headless=new --disable-extensions --enable-logging=stderr --v=0'
    + ' --virtual-time-budget=20000 --user-data-dir="' + abs + '/ud-' + c + '"'
    + ' "file:///' + abs + '/' + c + '.html" 2>&1 | grep -oE ' + Q + '"(PASS|FAIL|DONE)[^"]*"' + Q);
}
