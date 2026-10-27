#!/usr/bin/env node
/**
 * audit.mjs — Portfolio page audit (static + real browser)
 *
 * Usage:
 *   node tools/audit.mjs                     # audits http://127.0.0.1:8765/
 *   node tools/audit.mjs http://127.0.0.1:8000/
 *
 * Static part : anchors, image files, duplicate ids, placeholder markers
 * Browser part: boots headless Edge/Chrome via CDP, runs the interactions
 *               (language switch, palette, test run, lightbox, demo stage,
 *               fullscreen fallback, recruiter mode), collects JS errors,
 *               failed requests and broken images.
 *
 * No npm dependencies. Exit code 1 if any check fails.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_ARG = process.argv[2] || 'http://127.0.0.1:8765/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fails = [];
const ok = (label, extra = '') => console.log('  OK   ' + label + (extra ? '  ' + extra : ''));
const bad = (label, extra = '') => { fails.push(label + ' ' + extra); console.log('  FAIL ' + label + (extra ? '  ' + extra : '')); };

/* ── Static checks ─────────────────────────────────────────────────────── */
function staticChecks() {
  console.log('\n[1] Staattiset tarkistukset');
  const file = path.join(ROOT, 'index.html');
  const src = fs.readFileSync(file, 'utf8');

  const ids = [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  dupes.length ? bad('duplikaatti-id', [...new Set(dupes)].join(', ')) : ok('ei duplikaatti-idinejä', ids.length + ' id');

  const anchors = [...src.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
  const missingAnchors = [...new Set(anchors.filter((a) => !ids.includes(a)))];
  missingAnchors.length ? bad('ankkurin kohde puuttuu', missingAnchors.join(', ')) : ok('ankkurit osoittavat olemassa oleviin kohteisiin', anchors.length + ' ankkuria');

  const imgs = [...src.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const missingImgs = imgs.filter((p) => !fs.existsSync(path.join(ROOT, p.replace(/\//g, path.sep))));
  missingImgs.length ? bad('kuvatiedosto puuttuu', missingImgs.join(', ')) : ok('kaikki viitatut kuvat löytyvät', imgs.length + ' kuvaa');

  src.includes('@@') || src.includes('TODO') ? bad('jäänteitä tiedostossa', '@@ / TODO') : ok('ei placeholdereita');
  const fiCount = (src.match(/data-fi="/g) || []).length;
  fiCount > 60 ? ok('käännösattribuutteja', fiCount + ' kpl') : bad('data-fi-attribuutteja vähän', String(fiCount));

  for (const tag of ['div', 'section', 'article', 'ul', 'button']) {
    const open = (src.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length;
    const close = (src.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (open !== close) bad('tagipari ' + tag, open + ' auki / ' + close + ' kiinni');
  }
  ok('tagiparit täsmäävät (div/section/article/ul/button)');
}

/* ── Browser checks ────────────────────────────────────────────────────── */
const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

function findBrowser() {
  const found = BROWSERS.find((p) => fs.existsSync(p));
  if (!found) { console.error('Selainta ei löytynyt. Asenna Edge tai Chrome.'); process.exit(1); }
  return found;
}

const getJSON = (port, p) => new Promise((res, rej) => {
  http.get({ host: '127.0.0.1', port, path: p }, (r) => {
    let d = '';
    r.on('data', (c) => (d += c));
    r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
  }).on('error', rej);
});

async function startBrowser() {
  const exe = findBrowser();
  const profile = path.join(process.env.TEMP, 'intro_audit_' + Date.now());
  const child = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*',
    '--window-size=1280,900', '--user-data-dir=' + profile, '--remote-debugging-port=0', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools-portti ei auennut')), 15000);
    child.stderr.on('data', (d) => {
      const m = String(d).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
  });

  const port = new URL(wsUrl).port;
  for (let i = 0; i < 40; i++) {
    try { const list = await getJSON(port, '/json/list'); if (list && list.length) return { child, port, page: list.find((t) => t.type === 'page') }; }
    catch (e) { /* not ready */ }
    await sleep(300);
  }
  throw new Error('Selain ei käynnistynyt');
}

async function browserChecks() {
  console.log('\n[2] Selainajo (Edge/Chrome headless, CDP)');
  const { child, page } = await startBrowser();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const errors = [];
  const failedReqs = [];
  let id = 0;

  ws.onmessage = (evt) => {
    const m = JSON.parse(evt.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push('exception: ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('console: ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push('log: ' + m.params.entry.text);
    }
    if (m.method === 'Network.loadingFailed') failedReqs.push(m.params.errorText);
  };
  await new Promise((r) => { ws.onopen = r; });

  const send = (method, params) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const check = (label, value, expected = true) => {
    const pass = value === expected;
    (pass ? ok : bad)(label, pass ? '' : 'sai: ' + JSON.stringify(value));
  };

  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
    await send('Page.navigate', { url: URL_ARG });
    await sleep(2600);
    await ev('document.getElementById("boot").click(); "ok"');
    await sleep(400);

    check('kieli EN oletus', await ev('document.documentElement.lang'), 'en');
    await ev('document.querySelector("[data-setlang=fi]").click(); "ok"');
    await sleep(300);
    check('kieli FI', await ev('document.documentElement.lang'), 'fi');
    check('FI-otsikko', await ev('document.title.includes("Pelit")'));
    await ev('document.querySelector("[data-setlang=en]").click(); "ok"');
    await sleep(300);
    check('kieli takaisin EN', await ev('document.documentElement.lang'), 'en');

    await ev('document.querySelector("[data-action=palette]").click(); "ok"');
    await sleep(250);
    check('pikahaku aukeaa', await ev('document.getElementById("palette").hidden'), false);
    await ev('document.getElementById("palette").hidden = true; "ok"');

    await ev('document.getElementById("run-btn").click(); "ok"');
    await sleep(4300);
    check('testiajo valmis', await ev('document.getElementById("run-summary").textContent.includes("PASS 5")'));

    await ev('document.querySelector("#gamehub .shot").click(); "ok"');
    await sleep(350);
    check('lightbox aukeaa', await ev('document.getElementById("lightbox").hidden'), false);
    await ev('document.querySelector("[data-action=lb-close]").click(); "ok"');

    await ev('document.querySelector("[data-demo=gamehub]").click(); "ok"');
    await sleep(1200);
    check('pelilava lataa iframen', await ev('!!document.querySelector("#stage-body iframe")'));
    await ev('document.getElementById("stage-fs").click(); "ok"');
    await sleep(500);
    check('fullscreen-tila', await ev('document.getElementById("stage").classList.contains("stage-expanded") || !!document.fullscreenElement'));
    await ev('document.getElementById("stage-fs").click(); "ok"');
    await sleep(400);

    await ev('document.querySelector("[data-action=cv]").click(); "ok"');
    await sleep(300);
    check('recruiter-tila', await ev('document.body.classList.contains("cv")'));
    await ev('document.querySelector("[data-action=cv]").click(); "ok"');
    await sleep(300);

    for (let y = 0; y < 14; y++) { await ev('window.scrollBy(0, 600); "x"'); await sleep(150); }
    await sleep(1000);
    const brokenImgs = await ev('Array.from(document.images).filter(function(i){return i.complete && i.naturalWidth === 0;}).map(function(i){return i.getAttribute("src");}).join(", ")');
    brokenImgs ? bad('rikkinäisiä kuvia', brokenImgs) : ok('kaikki kuvat latautuivat');
    ok('kuvia sivulla', String(await ev('document.images.length')));

    errors.length ? bad('JS-virheet', JSON.stringify(errors.slice(0, 5))) : ok('ei JS-virheitä');
    failedReqs.length ? bad('epäonnistuneet pyynnöt', JSON.stringify(failedReqs.slice(0, 5))) : ok('ei epäonnistuneita pyyntöjä');
  } finally {
    try { ws.close(); } catch (e) { /* ignore */ }
    child.kill();
  }
}

(async () => {
  console.log('Portfolio audit → ' + URL_ARG);
  staticChecks();
  try { await browserChecks(); }
  catch (e) { bad('selainajo keskeytyi', e.message); }
  console.log('\n' + (fails.length ? 'TULOS: ' + fails.length + ' virhettä' : 'TULOS: kaikki tarkistukset OK'));
  process.exit(fails.length ? 1 : 0);
})();
