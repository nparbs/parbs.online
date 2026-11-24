import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterials } from './materials.js?v=4';
import { buildTurbo } from './turbo.js?v=4';
import { buildFlow, TurboSim, TurboAudio, ENGINE_POS } from './flow.js?v=4';
import { Callouts } from './callouts.js?v=4';
import { BoostGauge } from './gauge.js?v=4';
import { Tour } from './tour.js?v=4';
import { HERO, TEARDOWN, OVERVIEW, OVERVIEW_CALLOUTS, PARTS, HOW, SPECS, FOOT } from './content.js?v=4';

const $ = (q, el = document) => el.querySelector(q);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const pad = (n, l = 2) => String(n).padStart(l, '0');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '');

// ---------------------------------------------------------------- content → DOM
const CONTENT = { HERO, TEARDOWN, OVERVIEW, HOW };
document.querySelectorAll('[data-k]').forEach(el => {
  const [a, b] = el.dataset.k.split('.');
  const v = CONTENT[a]?.[b];
  if (v == null) return;
  if (el.classList.contains('eyebrow')) {
    const [n, ...rest] = String(v).split(' · ');
    el.innerHTML = rest.length ? `<span>${n}</span>${rest.join(' · ')}` : v;
  } else el.innerHTML = v;
});
{
  const [n, ...rest] = HERO.eyebrow.split(' · ');
  $('#heroEyebrow').innerHTML = `<span>${n}</span>${rest.join(' · ')}`;
  $('#heroTitle').innerHTML = HERO.title;
  $('#heroLede').innerHTML = HERO.lede;
  $('#heroStats').innerHTML = HERO.stats.map(([v, u, l]) => `<div><b>${v}<small>${u}</small></b><span class="mono">${l}</span></div>`).join('');
}
const compEl = $('#components');
PARTS.forEach((p, i) => {
  const sec = document.createElement('section');
  sec.className = 'scene part';
  sec.id = 'part-' + p.key;
  sec.innerHTML = `
    <div class="card">
      <div class="eyebrow mono"><span>${pad(i + 3)}</span>Component ${i + 1} of ${PARTS.length}</div>
      <div class="kicker">${esc(p.kicker)}</div>
      <h2>${esc(p.name)}</h2>
      <p>${esc(p.body)}</p>
      <dl class="dl">${p.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>`;
  compEl.appendChild(sec);
});
$('#steps').innerHTML = HOW.steps.map((s, i) => `<li class="${i === 0 || i === 4 ? 'hotstep' : ''}" data-n="${pad(i + 1)}"><b>${s.title}</b><p>${s.text}</p></li>`).join('');
$('#specTable').innerHTML = SPECS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
$('#foot').textContent = FOOT;

const CHAPTERS = [['Assembled', 0], ['Teardown', 1], ['Exploded view', 2],
  ...PARTS.map((p, i) => [p.name, 3 + i]), ['How it works', 10], ['Specification', 11]];
const rail = $('#rail');
rail.innerHTML = CHAPTERS.map(([name, s]) => `<button data-s="${s}" type="button"><span>${name}</span><i></i></button>`).join('');

// ---------------------------------------------------------------- renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 820 ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
{ const room = new RoomEnvironment(); scene.environment = pmrem.fromScene(room, 0.04).texture; room.dispose(); pmrem.dispose(); }
scene.fog = new THREE.Fog(0x0b0d10, 60, 140);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 400);

const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(10, 22, 14);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
scene.add(key);
const rimLight = new THREE.DirectionalLight(0x9cc2ff, 1.6);
rimLight.position.set(-14, 8, -16);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xffe2cc, 0.45);
fillLight.position.set(-8, -4, 12);
scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0xcfd8e3, 0x1a1d22, 0.55));
// soft light from just above the camera so whatever faces the viewer never drops to black
const camLight = new THREE.DirectionalLight(0xffffff, 0.9);
scene.add(camLight, camLight.target);
// glow from the hot side when the turbo is working
const heatLight = new THREE.PointLight(0xff6a2a, 0, 16, 2);
heatLight.position.set(4, 1, -4);
scene.add(heatLight);

const GROUND_Y = -12;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.4 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(300, 150, 0x2a3038, 0x171b20);
grid.position.y = GROUND_Y + 0.01;
grid.material.transparent = true;
grid.material.opacity = 0.5;
grid.material.depthWrite = false;
scene.add(grid);

// ---------------------------------------------------------------- build
const M = makeMaterials();
const turbo = buildTurbo(M);
scene.add(turbo.root);
const flow = buildFlow(M);
scene.add(flow.group);
const sim = new TurboSim();
const audio = new TurboAudio();
sim.onBov = psi => { flow.burstBov(180); audio.bov(psi); bovFlash = 1; };
const callouts = new Callouts($('#callouts'));
const gauge = new BoostGauge($('#gauge'));
let bovFlash = 0;

// which parts light up in each component chapter, and where the camera looks from
const FOCUS = {
  compressorHousing: { parts: ['compressorHousing'], dir: V(-0.72, 0.38, 0.62), dist: 46 },
  compressorWheel: { parts: ['compressorWheel'], dir: V(-0.82, 0.3, 0.5), dist: 30 },
  chra: { parts: ['chra', 'backplate', 'oilFeed', 'oilDrain'], dir: V(0.35, 0.35, 1), dist: 40 },
  bearing: { parts: ['bearing', 'shaft'], dir: V(0.2, 0.45, 1), dist: 30 },
  turbineWheel: { parts: ['turbineWheel'], dir: V(0.8, 0.3, 0.55), dist: 28 },
  turbineHousing: { parts: ['turbineHousing', 'vbandTurbine', 'vbandOutlet'], dir: V(0.55, 0.42, -0.75), dist: 52 },
  actuator: { parts: ['actuator'], dir: V(0.12, 0.42, 1), dist: 40 },
};
// callout name → [part, anchor]
const ANCHORS = {
  compressorHousing: { inlet: ['compressorHousing', 'inlet'], shroud: ['compressorHousing', 'shroud'], volute: ['compressorHousing', 'volute'], outlet: ['compressorHousing', 'outlet'], diffuser: ['compressorHousing', 'diffuser'] },
  compressorWheel: { inducer: ['compressorWheel', 'inducer'], exducer: ['compressorWheel', 'exducer'], splitter: ['compressorWheel', 'splitter'], nut: ['compressorWheel', 'nut'] },
  chra: { oilIn: ['chra', 'oilIn'], oilOut: ['chra', 'oilOut'], coolant: ['chra', 'coolant'], shield: ['chra', 'shield'], seal: ['backplate', 'seal'] },
  bearing: { balls: ['bearing', 'balls'], sleeve: ['bearing', 'sleeve'], shaft: ['shaft', 'shaft'], thread: ['shaft', 'thread'] },
  turbineWheel: { inducer: ['turbineWheel', 'inducer'], exducer: ['turbineWheel', 'exducer'], weld: ['turbineWheel', 'weld'] },
  turbineHousing: { inlet: ['turbineHousing', 'inlet'], volute: ['turbineHousing', 'volute'], shroud: ['turbineHousing', 'shroud'], outlet: ['turbineHousing', 'outlet'], vband: ['vbandTurbine', 'band'] },
  actuator: { canister: ['actuator', 'canister'], nipple: ['actuator', 'nipple'], rod: ['actuator', 'rod'] },
};
const OVER_ANCHOR = { compressorHousing: 'volute', compressorWheel: 'exducer', backplate: 'plate', chra: 'housing', bearing: 'sleeve', shaft: 'thread', turbineWheel: 'exducer', turbineHousing: 'volute', actuator: 'canister' };

// part centres in the exploded layout
turbo.setExplode(1);
turbo.root.updateMatrixWorld(true);
const focusTgt = {};
for (const [k, F] of Object.entries(FOCUS)) {
  const box = new THREE.Box3();
  F.parts.forEach(p => box.expandByObject(turbo.parts[p].holder));
  focusTgt[k] = box.getCenter(new THREE.Vector3());
}
turbo.setExplode(0);

// ---------------------------------------------------------------- scroll state
let sections = [], tops = [], heights = [], cards = [], cardH = [], vh = innerHeight, phone = innerWidth < 820, maxScroll = 1;
function measure() {
  sections = [...document.querySelectorAll('main > .scene, #components > .scene')];
  sections.sort((a, b) => a.offsetTop - b.offsetTop);
  const y0 = scrollY;
  tops = sections.map(s => s.getBoundingClientRect().top + y0);
  heights = sections.map(s => s.offsetHeight);
  vh = innerHeight;
  phone = innerWidth < 820;
  cards = sections.map(s => s.querySelector('.card'));
  cardH = cards.map(c => (c ? c.offsetHeight : 0));
  cards.forEach((c, k) => c && c.style.setProperty('--cardH', cardH[k] + 'px'));
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
}
function sAt(y) {
  let i = 0;
  while (i < tops.length - 1 && y >= tops[i + 1]) i++;
  return i + clamp((y - tops[i]) / heights[i], 0, 0.9999);
}
function yAt(s) {
  s = clamp(s, 0, tops.length - 0.0001);
  const i = Math.floor(s), f = s - i;
  return tops[i] + f * heights[i];
}
const HOW_I = 10, SPEC_I = 11;

// ---------------------------------------------------------------- poses
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let time = 0;
const dirFrom = (az, el) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

const STEP0 = 0.2, STEPW = 0.13;   // the five steps run f 0.2 → 0.85 of the how-it-works section
function stepOf(f) { return clamp(Math.floor((f - STEP0) / STEPW), -1, 4); }
const HOW_VIEWS = [
  { tgt: V(4.5, 3, -3.5), dir: V(0.55, 0.35, -0.75), dist: 58 },   // exhaust in
  { tgt: V(3.2, 0, 0), dir: V(0.75, 0.3, 0.6), dist: 44 },         // turbine spins the shaft
  { tgt: V(-5.5, 1.5, 2), dir: V(-0.6, 0.35, 0.75), dist: 52 },    // compressor
  { tgt: V(0, 7, 0), dir: V(0.45, 0.3, 0.85), dist: 100 },           // the loop through the engine
  { tgt: V(3, -1, -5), dir: V(0.35, 0.06, -1), dist: 56 },         // wastegate + blow-off
];

function pose(i, f) {
  const P = { tgt: V(0, 0, 0), dir: V(0.55, 0.32, 0.78), dist: 30, shift: 0.18 };
  if (i === 0) {
    const az = 0.62 + (REDUCED ? 0 : time * 0.07) + f * 0.4;
    P.dir = dirFrom(az, 0.3 - f * 0.08); P.tgt = V(-1.4, 0.6, 0); P.dist = 46 - f * 3; P.shift = 0.2;
  } else if (i === 1) {
    P.dir = dirFrom(0.42 - f * 0.2, 0.3); P.tgt = V(lerp(-1.4, 0, f), lerp(0.6, -0.8, f), 0); P.dist = lerp(46, 72, ease(f)); P.shift = 0.14;
  } else if (i === 2) {
    P.dir = dirFrom(0.22 - f * 0.12, 0.36 + f * 0.05); P.tgt = V(1.5, -0.5, 0); P.dist = 86; P.shift = 0.08;
  } else if (i >= 3 && i < HOW_I) {
    const k = PARTS[i - 3]?.key, F = FOCUS[k];
    if (F) {
      P.tgt = focusTgt[k].clone(); P.dist = F.dist; P.shift = 0.16;
      P.dir = F.dir.clone().normalize().applyAxisAngle(V(0, 1, 0), (f - 0.35) * 0.35);
    }
  } else if (i === HOW_I) {
    const st = stepOf(f);
    if (f < 0.2) {
      P.dir = dirFrom(0.5, 0.25); P.tgt = V(lerp(0, 0, f), lerp(-1, 6, ss(0.1, 0.2, f)), 0); P.dist = lerp(60, 96, ss(0.08, 0.2, f)); P.shift = 0.14;
    } else {
      const a = HOW_VIEWS[st], g = (f - STEP0 - st * STEPW) / STEPW;
      const b = HOW_VIEWS[Math.min(4, st + 1)];
      const w = st < 4 ? ease(ss(0.78, 1, g)) : 0;
      P.tgt = a.tgt.clone().lerp(b.tgt, w); P.dir = a.dir.clone().normalize().lerp(b.dir.clone().normalize(), w).normalize();
      P.dist = lerp(a.dist, b.dist, w) * 1.18; P.shift = 0.1;   // a little wider so the gauge panel doesn't cover the turbo
    }
  } else if (i >= SPEC_I) {
    const az = -0.5 + (REDUCED ? 0 : time * 0.05);
    P.dir = dirFrom(az, 0.28); P.tgt = V(-1.5, 0.6, 0); P.dist = 60; P.shift = 0.27;
  }
  return P;
}
function fadesFor(i) {
  const out = {};
  for (const k of Object.keys(turbo.parts)) out[k] = 1;
  if (i >= 3 && i < HOW_I) {
    const F = FOCUS[PARTS[i - 3]?.key];
    if (F) for (const k of Object.keys(out)) out[k] = F.parts.includes(k) ? 1 : (F.also?.[k] ?? 0.035);
  }
  return out;
}

// ---------------------------------------------------------------- callouts per section
function calloutsFor(i, f, list) {
  const vis = (k, start = 0.1, stepK = 0.08) => ss(start + k * stepK, start + k * stepK + 0.1, f) * (1 - ss(0.74, 0.86, f));
  if (i === 2) {
    OVERVIEW_CALLOUTS.forEach((c, k) => {
      const a = OVER_ANCHOR[c.part];
      list.push({ id: 'o-' + c.part, n: pad(k + 1), title: c.title, text: phone ? '' : c.text, world: turbo.anchorWorld(c.part, a), vis: vis(k, 0.06, 0.065), short: true });
    });
  } else if (i >= 3 && i < HOW_I) {
    const p = PARTS[i - 3];
    Object.entries(p.callouts || {}).forEach(([name, [title, text]], k) => {
      const m = ANCHORS[p.key]?.[name];
      if (!m) return;
      list.push({ id: `p-${p.key}-${name}`, n: pad(k + 1), title, text, world: turbo.anchorWorld(m[0], m[1]), vis: vis(k, 0.1, 0.09) });
    });
  }
}

// ---------------------------------------------------------------- DOM refs
const progressBar = $('#progressBar');
const hudStage = $('#hudStage'), hudExplode = $('#hudExplode'), hudShaft = $('#hudShaft');
const navLinks = [...document.querySelectorAll('.links a')];
const railBtns = [...rail.querySelectorAll('button')];
const stepEls = [...document.querySelectorAll('#steps li')];
const dash = $('#dash');
const STAGE_NAMES = ['ASSEMBLED', 'TEARDOWN', 'EXPLODED', ...PARTS.map(p => p.name.toUpperCase()), 'HOW IT WORKS', 'SPECIFICATION'];

rail.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  tour.pause();
  scrollTo({ top: yAt(+b.dataset.s + (+b.dataset.s === HOW_I ? 0.22 : 0.08)), behavior: REDUCED ? 'auto' : 'smooth' });
});
addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; });

// floor-it button + space bar
const floorBtn = $('#floor');
const hold = on => { sim.hold = on; floorBtn.classList.toggle('held', on); };
floorBtn.addEventListener('pointerdown', e => { e.preventDefault(); floorBtn.setPointerCapture?.(e.pointerId); hold(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => floorBtn.addEventListener(ev, () => hold(false)));
floorBtn.addEventListener('contextmenu', e => e.preventDefault());
let inHow = false;
// space floors it while the animation is on screen, unless another control has focus
addEventListener('keydown', e => {
  if (e.code !== 'Space' || !inHow || e.repeat) return;
  if (e.target.closest?.('button, a, input, select, textarea, [tabindex]') && e.target !== floorBtn) return;
  e.preventDefault(); hold(true);
});
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') hold(false); });
addEventListener('blur', () => hold(false));
floorBtn.addEventListener('keydown', e => { if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); hold(true); } });
// links to #how land on the running animation, not the empty top of the section
document.querySelectorAll('a[href="#how"]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  tour.pause();
  scrollTo({ top: yAt(HOW_I + 0.24), behavior: REDUCED ? 'auto' : 'smooth' });
}));
const soundBtn = $('#sound');
soundBtn.addEventListener('click', () => {
  if (audio.on) audio.stop(); else audio.start();
  soundBtn.setAttribute('aria-pressed', String(audio.on));
});

// ---------------------------------------------------------------- resize
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  flow.setScale(h * Math.min(devicePixelRatio, 2));
  measure();
  for (const it of callouts.items.values()) it.w = 0;   // re-measure boxes
}
addEventListener('resize', resize);
resize();
if (document.fonts?.ready) document.fonts.ready.then(resize);

// ---------------------------------------------------------------- video mode (autoscroll tour)
// Sound is never forced on: Play only wakes the audio context if the user already turned Sound on.
let tourHold = false;   // re-applied each frame while the How section is on screen
const tour = new Tour({
  sections, chapters: CHAPTERS, getS: () => sAt(scrollY),
  onPlay: () => { if (audio.on) audio.ctx?.resume(); },
  onPause: () => { tourHold = false; hold(false); },
  spaceFree: () => inHow,
  // step 5 (wastegate): floor it ~3.5 s, then lift so the wastegate opens and the blow-off valve fires
  cues: [{ s: HOW_I + STEP0 + 4 * STEPW + 0.05, dur: 3.5, fn: () => { tourHold = true; }, end: () => { tourHold = false; hold(false); } }],
});
document.querySelectorAll('a[href^="#"]').forEach(l => l.addEventListener('click', () => tour.pause()));
document.querySelectorAll('[data-tour-play]').forEach(b => b.addEventListener('click', () => { b.blur(); if (audio.on) audio.ctx?.resume(); tour.start(); }));

// phones: the docked How card grows as a step's text expands (CSS transition), so track its real height
if (cards[HOW_I] && 'ResizeObserver' in window) new ResizeObserver(() => {
  const c = cards[HOW_I];
  if (!phone || !c) return;
  cardH[HOW_I] = c.offsetHeight; c.style.setProperty('--cardH', cardH[HOW_I] + 'px');
}).observe(cards[HOW_I]);

// ---------------------------------------------------------------- frame
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
let camInit = false, last = performance.now(), sSmooth = null, idleAngle = 0, lastStep = -2;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  time += dt;
  const tourS = tour.step(dt);   // video mode drives the scroll position
  if (tourS !== null) scrollTo({ top: yAt(tourS), behavior: 'instant' });
  const sRaw = sAt(scrollY);
  sSmooth = sSmooth === null ? sRaw : lerp(sSmooth, sRaw, clamp(dt * 9));
  const s = Math.abs(sSmooth - sRaw) < 1e-4 ? sRaw : sSmooth;
  const i = Math.floor(s), f = s - i;

  // ---- explode / reassemble
  let ex = 0;
  if (i === 1) ex = ss(0.06, 0.86, f);
  else if (i >= 2 && i < HOW_I) ex = 1;
  else if (i === HOW_I) ex = 1 - ss(0.0, 0.13, f);
  turbo.setExplode(ex);

  // ---- blend this section's state toward the next one near its end
  const w = ease(ss(0.74, 1, f));
  const fa = fadesFor(i), fb = fadesFor(Math.min(i + 1, SPEC_I));
  for (const k of Object.keys(fa)) turbo.setFade(k, lerp(fa[k], fb[k], w));
  const xray = i === HOW_I ? ss(0.1, 0.2, f) * (1 - ss(0.93, 1, f)) : 0;
  turbo.setXray(xray);
  turbo.applyMats();
  const flowVis = i === HOW_I ? ss(0.12, 0.22, f) * (1 - ss(0.93, 1, f)) : 0;
  inHow = flowVis > 0.3;
  document.body.classList.toggle('in-how', inHow);
  const dashOn = i === HOW_I && f > 0.18 && f < 0.95;
  dash.classList.toggle('on', dashOn);
  if (dash.inert === dashOn) dash.inert = !dashOn;      // hidden controls stay out of the tab order
  if (rail.inert !== inHow) rail.inert = inHow;

  // ---- sim + spin
  if (tourHold && flowVis > 0.3 && !sim.hold) hold(true);
  if (flowVis > 0) sim.step(dt);
  else if (sim.hold) hold(false);   // clears the button's held state too
  const spinRate = flowVis > 0.01 ? (sim.rpmT / 60) * Math.PI * 2 * 0.001 * (REDUCED ? 0.3 : 1) : (REDUCED ? 0 : 0.9);
  idleAngle += spinRate * dt;
  turbo.spin(spinRate * dt);
  turbo.setWastegate(flowVis > 0.01 ? sim.wg : 0);
  const st = i === HOW_I ? stepOf(f) : -1;
  const emph = { air: st === 0 || st === 4 ? 0.3 : 1, exh: st === 2 ? 0.35 : 1 };
  flow.update(dt, sim, flowVis, emph);
  heatLight.intensity = flowVis * (8 + 30 * sim.load);
  if (flowVis > 0) { gauge.set(sim.boost, sim.rpmT, sim.wg); gauge.tick(dt); }
  audio.update(sim, flowVis);
  bovFlash = Math.max(0, bovFlash - dt * 2);
  if (st !== lastStep) {
    lastStep = st;
    stepEls.forEach((el, k) => el.classList.toggle('on', k === st));
    if (phone) { const c = cards[HOW_I]; if (c) { cardH[HOW_I] = c.offsetHeight; c.style.setProperty('--cardH', cardH[HOW_I] + 'px'); } }
  }

  // ---- camera
  const A = pose(i, f), B = pose(Math.min(i + 1, SPEC_I), 0);
  const tgt = A.tgt.clone().lerp(B.tgt, w);
  const dir = A.dir.clone().normalize().lerp(B.dir.clone().normalize(), w).normalize();
  let dist = lerp(A.dist, B.dist, w);
  const shift = lerp(A.shift, B.shift, w);
  const aspect = innerWidth / innerHeight;
  dist *= clamp(1.55 / aspect, 1, 2.1);
  mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
  if (!REDUCED && !phone) dir.applyAxisAngle(V(0, 1, 0), -mouse.x * 0.12).add(V(0, mouse.y * 0.08, 0)).normalize();
  const pos = tgt.clone().addScaledVector(dir, dist);
  if (!camInit) { camPos.copy(pos); camTgt.copy(tgt); camInit = true; }
  const k = clamp(dt * 6);
  camPos.lerp(pos, k); camTgt.lerp(tgt, k);
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  camLight.position.copy(camPos).add(V(0, 6, 0)); camLight.target.position.copy(camTgt);
  // shift the subject away from the text: right on desktop, up on phones
  const W = innerWidth, H = innerHeight;
  if (phone) {
    const panel = i === 0 ? 0 : cardH[i] || 0;
    const up = i === 0 ? H * 0.2 : Math.min(H * 0.3, panel * 0.5);
    camera.setViewOffset(W, H, 0, up, W, H);
  } else camera.setViewOffset(W, H, -W * shift, 0, W, H);

  // ---- callouts
  const list = [];
  calloutsFor(i, f, list);
  let keepOut = null;
  const card = cards[i];
  if (card) {
    const r = card.getBoundingClientRect();
    if (r.bottom > 0 && r.top < H) keepOut = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
  }
  callouts.update(list, camera, W, H, keepOut, phone);

  // ---- DOM
  progressBar.style.transform = `scaleX(${clamp(scrollY / maxScroll)})`;
  sections.forEach((sec, k) => sec.classList.toggle('on', k === i && f < 0.86 || (k === i + 1 && f > 0.92)));
  hudStage.textContent = `${pad(i)} · ${STAGE_NAMES[i] || ''}`;
  hudExplode.textContent = `${Math.round(ex * 100)}%`;
  hudShaft.textContent = `${Math.round((flowVis > 0.01 ? sim.rpmT : spinRate * 60 / (Math.PI * 2) * 1000) / 100) * 100 | 0} rpm`;
  const navKey = i >= HOW_I ? (i === HOW_I ? 'how' : 'specs') : i >= 3 ? 'components' : i >= 1 ? 'teardown' : '';
  navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + navKey));
  railBtns.forEach(b => b.classList.toggle('on', +b.dataset.s === i));

  key.shadow.camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  if (!loaded) { loaded = true; setTimeout(() => $('#loader').classList.add('done'), 250); }
}
let loaded = false;
requestAnimationFrame(frame);

// debug hooks: ?debug exposes internals, ?s=<float> jumps to a scroll stage
const q = new URLSearchParams(location.search);
if (q.has('debug')) window.__t = {
  turbo, flow, sim, audio, callouts, camera, tour,
  // step the finale at 60 Hz (headless browsers draw too slowly to watch it), e.g. __t.advance(5, true)
  advance(sec, floor = false) {
    sim.hold = floor;
    for (let k = 0; k < sec * 60; k++) { sim.step(1 / 60); flow.update(1 / 60, sim, 1); turbo.spin((sim.rpmT / 60) * Math.PI * 2 * 0.001 / 60); }
    turbo.setWastegate(sim.wg);
  },
};
if (q.has('s')) requestAnimationFrame(() => { measure(); scrollTo({ top: yAt(+q.get('s')), behavior: 'auto' }); });
