import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildEngine, makeMaterials, plateTexture, updateChambers,
  TAU, W, OUT, EXH_T, PLUG_T, epiOff,
} from './engine.js';
import { PARTS, PHASES, CHAPTERS } from './content.js';
import { buildCar } from './car.js';
import { EngineSim } from './sim.js';
import { EngineAudio } from './audio.js';
import { Cluster } from './cluster.js';
import { Tour } from './tour.js';

const $ = (q, el = document) => el.querySelector(q);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrap = (x, p) => ((x % p) + p) % p;
const wrapS = (x, p) => { x = wrap(x, p); return x > p / 2 ? x - p : x; };
const pad = (n, l = 2) => String(n).padStart(l, '0');

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IDLE = REDUCED ? 0.5 : 2.4;  // shaft rad/s while idling
const P3 = 3 * TAU;                // one full rotor revolution in shaft radians
const CYCLE_BASE = 3.5 * Math.PI;  // shaft angle where chamber A starts intake

// ---------------------------------------------------------------- DOM: components
const compEl = $('#components');
PARTS.forEach((p, i) => {
  const sec = document.createElement('section');
  sec.className = 'scene part';
  sec.innerHTML = `
    <div class="card">
      <div class="eyebrow mono"><span>${pad(i + 1)} / ${pad(PARTS.length)}</span>Component</div>
      <div class="kicker">${p.kicker}</div>
      <h2>${p.name}</h2>
      <p>${p.body}</p>
      <dl class="dl">${p.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </div>`;
  compEl.appendChild(sec);
});

// phases list in the cycle card
$('#phases').innerHTML = PHASES.map((p, i) => `<li data-p="${i}" style="--c:${p.color}"><i></i><span>${p.name}</span></li>`).join('');

// chapter rail
const rail = $('#rail');
rail.innerHTML = CHAPTERS.map(([name, s]) => `<button data-s="${s}"><span>${name}</span><i></i></button>`).join('');

// ---------------------------------------------------------------- renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 820 ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.fog = new THREE.Fog(0x0b0d10, 28, 64);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(7, 14, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.025;
scene.add(key);
const rimLight = new THREE.DirectionalLight(0x9cc2ff, 1.6);
rimLight.position.set(-9, 5, -10);
scene.add(rimLight);
const fillLight = new THREE.DirectionalLight(0xffe2cc, 0.5);
fillLight.position.set(-6, -2, 8);
scene.add(fillLight);
scene.add(new THREE.HemisphereLight(0xcfd8e3, 0x0b0c0e, 0.3));
const flashLight = new THREE.PointLight(0xff7a2a, 0, 7, 2);
scene.add(flashLight);

// ground: shadow catcher + faint grid
const GROUND_Y = -4.1;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.ShadowMaterial({ opacity: 0.42 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(240, 240,0x2a3038, 0x171b20);
grid.position.y = GROUND_Y + 0.002;
grid.material.transparent = true;
grid.material.opacity = 0.55;
grid.material.depthWrite = false;
scene.add(grid);

// ---------------------------------------------------------------- state
let eng, car, hoist, displays = [], tags = [], camKeys = [];
const CAR_Z = 2.6;          // car root z: puts the front axle just ahead of the pulley
const HOIST_H = 12;         // how high the engine hangs while the car rolls under it
const HOOD_OPEN = -1.68;    // past vertical, so the hood clears the engine on the way down
const INSTALLED = 15.7;     // s from which the engine sits in the car and can be started

// engine demo: sim (state), audio (sound), cluster (gauges + controls)
const sim = new EngineSim();
const audio = new EngineAudio();
let cluster, tour, popT = 0, rock = 0, plateBase = 0;
// rev demo script: [seconds, throttle]
const DEMO = [[0.22, 1], [0.6, 0], [0.26, 1], [0.75, 0], [0.18, 0.55], [0.55, 0], [1.9, 1], [1.6, 0]];
const demo = { on: false, i: 0, t: 0 };
function startDemo() {
  if (!sim.running) sim.start();
  Object.assign(demo, { on: true, i: -1, t: 0 });
}
function demoThrottle(dt) {
  if (!demo.on) return null;
  if (!sim.running) return sim.on ? 0 : (demo.on = false, null);   // wait for it to catch
  if (demo.i < 0) { demo.t += dt; if (demo.t > 1.2) { demo.i = 0; demo.t = 0; } return 0; }
  demo.t += dt;
  if (demo.t > DEMO[demo.i][0]) { demo.i++; demo.t = 0; }
  if (demo.i >= DEMO.length) { demo.on = false; return 0; }
  return DEMO[demo.i][1];
}
let sections = [], tops = [], heights = [];
let sCur = 0, phi = CYCLE_BASE - 1.2, time = 0, last = performance.now();
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
const touched = new Set();

function setFade(obj, v) {
  obj.userData.fade = (obj.userData.fade ?? 1) * v;
  touched.add(obj);
}
function applyFade(obj, f) {
  if (obj.userData.custom) return;
  const ff = f * (obj.userData.fade ?? 1);
  if (obj.isMesh) {
    const m = obj.material, vis = ff > 0.004;
    obj.visible = vis;
    if (vis) {
      const tr = ff < 0.995;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = ff;
      m.depthWrite = ff > 0.6;
      obj.castShadow = ff > 0.6;
    }
  }
  for (const c of obj.children) applyFade(c, ff);
}

function cloneOf(obj) {
  const c = obj.clone(true);
  const drop = [];
  c.traverse(o => {
    if (o.userData.noClone) drop.push(o);
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = false;
      o.material.opacity = 1;
      o.material.depthWrite = true;
      o.visible = true;
      o.castShadow = false;
    }
  });
  drop.forEach(o => o.parent && o.parent.remove(o));
  c.position.set(0, 0, 0);
  c.quaternion.identity();
  c.scale.set(1, 1, 1);
  return c;
}

// ---------------------------------------------------------------- build
function build() {
  const M = makeMaterials(plateTexture());
  eng = buildEngine(M);
  scene.add(eng.root);
  eng.root.traverse(o => { if (o.isMesh && !o.userData.custom) o.material = o.material.clone(); });

  // component showcase displays
  const r0 = eng.rotors[0];
  const defs = {
    rotor: { src: r0.group, make: () => cloneOf(r0.group), hide: [r0.group], base: [0.32, -0.5, 0] },
    seals: {
      src: r0.group, hide: r0.seals.map(s => s.mesh), base: [0.42, -0.45, 0],
      make: () => {
        const g = new THREE.Group();
        r0.seals.forEach(s => {
          const m = cloneOf(s.mesh);
          m.position.copy(s.base).addScaledVector(s.delta, 0.3);
          m.quaternion.copy(s.mesh.quaternion);
          g.add(m);
        });
        const ghost = cloneOf(r0.body);
        ghost.material.color.set(0x8a929c);
        ghost.material.transparent = true;
        ghost.material.opacity = 0.22;
        ghost.material.depthWrite = false;
        g.add(ghost);
        return g;
      },
    },
    housing: { src: eng.stack[2].group, make: () => cloneOf(eng.stack[2].group), hide: [eng.stack[2].group], base: [0.3, -0.55, 0] },
    shaft: { src: eng.shaft, make: () => cloneOf(eng.shaft), hide: [eng.shaft], base: [0.38, 1.15, 0] },
    gear: { src: eng.gears[0].group, make: () => cloneOf(eng.gears[0].group), hide: [eng.gears[0].group], base: [0.42, -0.6, 0] },
    ih: { src: eng.stack[3].group, make: () => cloneOf(eng.stack[3].group), hide: [eng.stack[3].group], base: [0.3, -0.6, 0] },
    plugs: {
      src: eng.plugGroup, hide: eng.plugs[0], base: [0.18, 0.5, 0],
      make: () => {
        const g = new THREE.Group();
        eng.plugs[0].forEach(p => {
          const c = cloneOf(p);
          c.position.copy(p.userData.base);
          c.quaternion.copy(p.quaternion);
          g.add(c);
        });
        return g;
      },
    },
    intake: { src: eng.intake, make: () => cloneOf(eng.intake), hide: [eng.intake], base: [0.4, 0.95, 0] },
    exhaust: { src: eng.exhaust, make: () => cloneOf(eng.exhaust), hide: [eng.exhaust], base: [0.28, 0.95, 0] },
  };
  displays = PARTS.map((p, k) => {
    const d = defs[p.key];
    const inner = d.make();
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    inner.position.sub(center);
    const pivot = new THREE.Group();
    pivot.add(inner);
    pivot.visible = false;
    scene.add(pivot);
    return { ...d, k, pivot, center, radius };
  });

  car = buildCar();
  car.root.position.set(0, GROUND_Y, CAR_Z);
  car.hood.rotation.x = HOOD_OPEN;
  car.root.visible = false;
  scene.add(car.root);
  buildHoist();
  plateBase = eng.throttlePlate.rotation.x;
  cluster = new Cluster(sim, {
    onUnlock: () => audio.ensure(),
    onToggle: () => { demo.on = false; sim.toggle(); },
    onDemo: startDemo,
    onMute: m => audio.setMuted(m),
    onPaint: hex => car.setPaint(hex),
  });

  buildTags();
  buildCamKeys();
}

// ---------------------------------------------------------------- engine hoist (chain, spreader, lift brackets)
function buildHoist() {
  hoist = new THREE.Group();
  hoist.visible = false;
  scene.add(hoist);
  const steel = new THREE.MeshStandardMaterial({ color: 0x5f646b, metalness: 1, roughness: 0.42 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xd9a21b, metalness: 0.3, roughness: 0.5 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    hoist.add(m);
    return m;
  };
  eng.root.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(eng.stack[2].group).max.y;
  const zf = eng.FRONT - 0.18, zr = eng.REAR + 0.18;
  const eyeY = top + 0.55, barY = top + 3.2, barZ = 1.5;

  // lift brackets bolted to the front and rear housings
  for (const z of [zf, zr]) {
    add(new THREE.BoxGeometry(0.1, 0.62, 0.36), paint, 0, top + 0.2, z);
    add(new THREE.TorusGeometry(0.13, 0.035, 8, 20).rotateY(Math.PI / 2), steel, 0, eyeY, z);
  }
  // spreader bar with end eyes and a centre hook
  add(new THREE.CylinderGeometry(0.09, 0.09, barZ * 2 + 0.3, 16).rotateX(Math.PI / 2), paint, 0, barY, 0);
  for (const z of [barZ, -barZ]) add(new THREE.TorusGeometry(0.12, 0.035, 8, 20).rotateY(Math.PI / 2), steel, 0, barY - 0.14, z);
  add(new THREE.TorusGeometry(0.26, 0.07, 10, 28, Math.PI * 1.45).rotateZ(-Math.PI * 0.95), steel, 0, barY + 0.3, 0);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12), steel, 0, barY + 0.8, 0);

  // chains: instanced links laid between two points
  const linkGeo = new THREE.TorusGeometry(0.11, 0.032, 6, 14).scale(1, 1.65, 1);
  const PITCH = 0.3, up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const chain = (a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir), qs = new THREE.Quaternion(), m4 = new THREE.Matrix4();
    const n = Math.max(1, Math.round(len / PITCH));
    const im = new THREE.InstancedMesh(linkGeo, steel, n);
    for (let i = 0; i < n; i++) {
      qs.setFromAxisAngle(up, (i % 2) * Math.PI / 2);
      m4.compose(a.clone().addScaledVector(dir, (i + 0.5) * (len / n)), q.clone().multiply(qs), one);
      im.setMatrixAt(i, m4);
    }
    im.castShadow = true;
    hoist.add(im);
  };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  chain(v(0, eyeY + 0.1, zf), v(0, barY - 0.22, barZ));
  chain(v(0, eyeY + 0.1, zr), v(0, barY - 0.22, -barZ));
  chain(v(0, barY + 1.05, 0), v(0, barY + 42, 0));
}

// ---------------------------------------------------------------- labels
function buildTags() {
  const layer = $('#labels');
  const mk = (text, group, get) => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.innerHTML = `<i></i><span>${text}</span>`;
    layer.appendChild(el);
    tags.push({ el, group, get, v: new THREE.Vector3() });
  };
  const wp = (obj, v, x = 0, y = 0, z = 0) => obj.getWorldPosition(v).add(new THREE.Vector3(x, y, z));
  const local = (obj, v, x, y, z) => obj.localToWorld(v.set(x, y, z));
  const r = eng.rotors, st = eng.stack;
  mk('Rotor ×3', 'tear', v => wp(r[1].group, v, 0, 0.98, 0));
  mk('Apex seal', 'tear', v => wp(r[0].apex[0], v));
  mk('Rotor housing ×3', 'tear', v => wp(st[4].group, v, 1.24, -0.2, 0));
  mk('Intermediate housing', 'tear', v => wp(st[5].group, v, 1.2, 0.5, 0));
  mk('Stationary gear', 'tear', v => wp(eng.gears[1].group, v, 0, 0.32, 0));
  mk('Eccentric shaft', 'tear', v => wp(eng.shaft, v, 0, 0.2, -0.9));
  mk('Intake manifold', 'tear', v => local(eng.intake, v, 2.3, 2.18, -1.2));
  mk('Exhaust header', 'tear', v => local(eng.exhaust, v, 2.1, -1.0, eng.REAR - 0.6));
  mk('Spark plugs ×6', 'tear', v => wp(eng.plugs[1][1], v));

  const rh1 = st[2].group;
  const pl = epiOff(Math.PI / 2, OUT + 0.08), ex = epiOff(EXH_T, OUT + 0.1);
  mk('Spark plugs', 'cyc', v => local(rh1, v, pl.x, pl.y, W / 2));
  mk('Exhaust port', 'cyc', v => local(rh1, v, ex.x, ex.y, W / 2));
  mk('Intake ports', 'cyc', v => local(rh1, v, 0.5, -0.52, -W / 2));
  mk('Chamber A', 'chamberA', v => local(rh1, v, chamberA.cx, chamberA.cy, W / 2 + 0.01));
}
let chamberA = { cx: 0, cy: 0, x: 0 };

// ---------------------------------------------------------------- camera path
function buildCamKeys() {
  const z1 = eng.stack[2].z0 + eng.stack[2].ex;
  const hero = [[9.8, 3.6, 11.4], [0.55, -0.15, 0.1]];
  const K = [
    [0, ...hero],
    [0.85, [9.2, 3.3, 10.6], [0.55, -0.15, 0.1]],
    [1.8, [12.8, 6.6, 12.6], [1.1, 0.3, 0]],
    [2.05, [12.8, 6.6, 12.6], [1.1, 0.3, 0]],
    [2.85, [17.2, 8.0, 16.0], [0.5, -0.3, 0]],
    [3.02, [17.2, 8.0, 16.0], [0.5, -0.3, 0]],
    [3.24, [1.5, 1.0, z1 + 7.6], [0, 0, z1]],
    [3.9, [1.0, 0.6, z1 + 7.2], [0, 0, z1]],
    [4.2, [16.2, 11.2, 15.0], [0.6, 0.8, 0]],
    [4.92, [16.2, 11.2, 15.0], [0.6, 0.8, 0]],
  ];
  for (let k = 0; k < PARTS.length; k++) {
    const a = (k - 4) * 0.055, base = new THREE.Vector3(11.5, 7.2, 13.5);
    base.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const p = base.toArray();
    K.push([5.0 + k, p, [0.3, 0.6, 0]], [5.0 + k + 0.62, p, [0.3, 0.6, 0]]);
  }
  K.push(
    [14.55, ...hero], [14.98, ...hero],
    [15.2, [15.5, 15.5, 21.5], [0, 10, 0]],                                   // follow the engine up
    [15.34, [37, 19, 31], [0, 4, -9]], [15.48, [37, 19, 31], [0, 4, -9]],     // wide: car rolls in underneath
    [15.66, [21, 15, 19], [0, 2.6, -1]],                                      // lowering into the bay
    [15.86, [15, 12.5, 17.5], [0, 0.2, -0.8]], [16, [15, 12.5, 17.5], [0, 0.2, -0.8]], // bay close-up
  );
  camKeys = K.map(([s, p, t]) => ({ s, p: new THREE.Vector3(...p), t: new THREE.Vector3(...t) }));
}
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
function camAt(s) {
  const K = camKeys;
  let i = 0;
  while (i < K.length - 2 && s >= K[i + 1].s) i++;
  const a = K[i], b = K[i + 1];
  const f = easeIO(clamp((s - a.s) / (b.s - a.s)));
  camPos.lerpVectors(a.p, b.p, f);
  camTgt.lerpVectors(a.t, b.t, f);
}

// ---------------------------------------------------------------- layout & scroll
let narrow = false, distK = 1, viewH = innerHeight;
// On phones the text sits in a fixed panel at the bottom (every card stacked in the same spot),
// so the 3D view only gets the space above the tallest panel.
const DOCK_SEL = '.card, .specs-inner, .hero-inner';
function dockHeight() {
  let m = 0;
  document.querySelectorAll(DOCK_SEL).forEach(el => { m = Math.max(m, el.offsetHeight); });
  return m;
}
function layout() {
  const w = innerWidth, h = innerHeight;
  narrow = w < 820;
  viewH = narrow ? Math.max(200, h - dockHeight() + 14) : h;
  document.documentElement.style.setProperty('--viewH', `${viewH}px`);
  renderer.setSize(w, viewH, false);
  const aspect = w / viewH;
  camera.aspect = aspect;
  camera.fov = aspect >= 1.2 ? 35 : lerp(35, 46, clamp((1.2 - aspect) / 0.7));
  distK = aspect >= 1.2 ? 1 : 1 + (1.2 - aspect) * 1.05;
  camera.setViewOffset(w, viewH, narrow ? 0 : -w * 0.17, narrow ? viewH * 0.04 : 0, w, viewH);
  camera.updateProjectionMatrix();
  measure();
}
function measure() {
  sections = [...document.querySelectorAll('.scene')];
  tops = sections.map(s => s.getBoundingClientRect().top + scrollY);
  heights = sections.map(s => s.offsetHeight);
}
// The animation reference line sits below the viewport top so each chapter's
// animation lines up with the time its sticky card is pinned on screen.
const refOff = () => innerHeight * (narrow ? 0.4 : 0.12);
function scrollS() {
  const y = scrollY + refOff();
  for (let i = sections.length - 1; i >= 0; i--) {
    if (y >= tops[i]) return i + clamp((y - tops[i]) / heights[i]);
  }
  return 0;
}
function scrollToS(s, behavior = 'smooth') {
  const i = Math.min(sections.length - 1, Math.floor(s));
  window.scrollTo({ top: Math.max(0, tops[i] + (s - i) * heights[i] - refOff() + 2), behavior });
}

// ---------------------------------------------------------------- UI refs
const ui = {
  stage: $('#hudStage'), explode: $('#hudExplode'), shaft: $('#hudShaft'), rotor: $('#hudRotor'),
  bar: $('#progressBar'), phaseText: $('#phaseText'), readout: $('#cycleReadout'),
  phases: [...document.querySelectorAll('#phases li')], rail: [...rail.querySelectorAll('button')],
  nav: [...document.querySelectorAll('.links a')],
};
let lastPhase = -1, lastStage = '';
function stageName(s) {
  if (s < 0.9) return '00 · ASSEMBLED';
  if (s < 2) return '01 · ANCILLARIES';
  if (s < 3) return '02 · UNSTACK';
  if (s < 4) return '03 · COMBUSTION CYCLE';
  if (s < 5) return '04 · TEARDOWN';
  if (s < 14) { const k = clamp(Math.floor(s - 5), 0, PARTS.length - 1); return `05 · ${PARTS[k].name.toUpperCase()}`; }
  if (s < 15) return '06 · REASSEMBLED';
  return '07 · INSTALLED';
}

// ---------------------------------------------------------------- frame
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
const fwd = new THREE.Vector3(), startP = new THREE.Vector3(), showP = new THREE.Vector3();
const showQ = new THREE.Quaternion(), localQ = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
const phaseCols = PHASES.map(p => new THREE.Color(p.color));
const flashCol = new THREE.Color('#fff1b8'), tmpC = new THREE.Color();

let lastCur = -2;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  // video mode drives the scroll position
  const tourS = tour ? tour.step(dt) : null;
  if (tourS !== null) scrollToS(tourS, 'instant');
  const sT = scrollS();
  sCur += (sT - sCur) * (1 - Math.exp(-dt * (REDUCED ? 20 : 6.5)));
  if (Math.abs(sT - sCur) < 1e-4) sCur = sT;
  const s = sCur;

  // ---- choreography factors
  const anc = ss(1.0, 1.75, s) * (1 - ss(14.55, 14.95, s));
  const bolt = ss(1.9, 2.3, s) * (1 - ss(14.42, 14.7, s));
  const b = ss(2.05, 2.8, s) * (1 - ss(14.15, 14.55, s));
  const drop = ss(2.3, 2.85, s) * (1 - ss(14.15, 14.5, s));
  const lift = ss(4.02, 4.38, s) * (1 - ss(13.95, 14.2, s));
  const pop = ss(4.2, 4.5, s) * (1 - ss(13.95, 14.12, s));
  const gpop = ss(4.25, 4.55, s) * (1 - ss(13.95, 14.15, s));
  const front = ss(3.0, 3.2, s) * (1 - ss(3.92, 4.08, s));
  const cham = ss(3.14, 3.3, s) * (1 - ss(3.88, 3.98, s));
  const ghost = ss(4.8, 5.05, s) * (1 - ss(13.75, 14.05, s));
  const tear = ss(4.4, 4.54, s) * (1 - ss(4.7, 4.82, s));

  // ---- shaft angle: idle spin, or scrub through the cycle
  const idleW = clamp(1 - ss(0.55, 1.0, s) + ss(14.35, 14.85, s)) * (1 - ss(14.95, 15.04, s));
  const scrub = ss(3.05, 3.2, s) * (1 - ss(3.93, 4.05, s));
  phi += idleW * IDLE * dt;

  // ---- engine sim (installed section only)
  const live = s > INSTALLED;
  if (!live && sim.on) { sim.stop(); demo.on = false; }
  const dThr = demoThrottle(dt);
  sim.target = live ? (dThr ?? (cluster.holding ? 1 : 0)) : 0;
  sim.update(dt);
  audio.update(sim);
  cluster.show(live);
  cluster.update(dt, time);
  // visible shaft speed is capped well below real rpm so the pulley never strobes backwards
  phi += Math.min(sim.rpm / 60, 2.4) * TAU * dt;
  if (scrub > 0) {
    const target = CYCLE_BASE + clamp((s - 3.18) / 0.7) * P3;
    phi += wrapS(target - phi, P3) * (1 - Math.exp(-dt * 10)) * scrub;
  }
  phi = wrap(phi, P3);

  // ---- transforms
  const st = eng.stack;
  st.forEach(it => { it.group.position.z = it.z0 + it.ex * b; });
  eng.boltGroup.position.set(0, b * 3.3, -bolt * (eng.total + 0.5));
  eng.shaft.position.x = -2.45 * drop;
  eng.shaft.rotation.z = phi;
  eng.pulley.position.z = eng.FRONT + 0.47 + 1.3 * anc + st[0].ex * b;
  eng.fly.position.z = eng.REAR - 0.3 - 1.3 * anc + st[7].ex * b;
  eng.pulley.rotation.z = phi;
  eng.acc.position.z = 1.3 * anc + st[0].ex * b;
  eng.acc.userData.pulley.rotation.z = phi * 3.2;
  eng.fly.rotation.z = phi;
  eng.rotors.forEach((r, k) => {
    const pk = phi + (k * TAU) / 3;
    const rh = st[r.si];
    r.group.position.set(0.15 * Math.cos(pk) + lift * 2.75, 0.15 * Math.sin(pk), rh.z0 + rh.ex * b);
    r.group.rotation.z = pk / 3;
    r.seals.forEach(sl => sl.mesh.position.copy(sl.base).addScaledVector(sl.delta, pop));
  });
  eng.gears.forEach(g => { g.group.position.z = g.z0 + st[g.plate].ex * b - g.side * 0.45 * gpop; });
  eng.intake.position.set(2.1 * anc, 2.2 * anc, 0);
  eng.exhaust.position.set(2.0 * anc, -1.25 * anc, 0);
  eng.pan.position.set(0, -1.75 * anc, 0);
  eng.plugs.flat().forEach(p => p.position.copy(p.userData.base).addScaledVector(p.userData.dir, 0.9 * anc));

  // ---- installed: hoist the engine, roll the car in underneath, lower it into the bay
  const hookOn = ss(14.95, 15.03, s), hookOff = ss(15.7, 15.86, s);
  const engY = HOIST_H * (ss(15.04, 15.22, s) - ss(15.48, 15.66, s));
  eng.root.position.y = engY;
  hoist.visible = hookOn > 0.001 && hookOff < 0.999;
  hoist.position.y = engY + 28 * (1 - hookOn) + 28 * hookOff;
  const rollT = clamp((s - 15.08) / 0.38);
  car.root.visible = s > 15.0;
  if (car.root.visible) {
    car.root.position.z = CAR_Z - 80 * Math.pow(1 - rollT, 2.2);
    car.setRoll(car.root.position.z);
    popT += ((sim.running ? 1 : 0) - popT) * (1 - Math.exp(-dt * 3.5));
    car.setPopups(easeIO(clamp(popT)));
    car.setLights(popT > 0.92, ss(0.45, 0.85, rollT) * (1 - ss(15.5, 15.56, s)));
  }

  // running engine: torque-reaction rock on the mounts, throttle plate, header heat glow
  let rockT = clamp(-sim.accel / 9000, -1, 1) * 0.03;
  if (sim.running) rockT += (Math.random() - 0.5) * 0.006 * (1 - sim.rpm / 9000);
  if (sim.starter) rockT += Math.sin(time * 72) * 0.004;
  rock += (rockT - rock) * (1 - Math.exp(-dt * 18));
  eng.root.rotation.z = rock;
  eng.throttlePlate.rotation.x = plateBase + sim.throttle * 1.35;
  const glow = ss(0.3, 1, sim.heat);
  eng.exhaustMeshes.forEach(m => m.material.emissive.setRGB(1.6 * glow, 0.32 * glow * glow, 0.04 * glow ** 3));

  // ---- fades
  for (const o of touched) o.userData.fade = 1;
  touched.clear();
  const keepF = 1 - front;
  [st[0].group, st[1].group, eng.gears[0].group, eng.pulley, eng.acc, eng.intake, eng.exhaust, eng.pan, eng.plugGroup, eng.boltGroup].forEach(o => setFade(o, keepF));

  // ---- camera
  camAt(s);
  mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3));
  mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));
  camPos.sub(camTgt).multiplyScalar(distK).add(camTgt);
  const par = REDUCED ? 0 : 1 - cham * 0.6;
  camPos.x += mouse.x * 0.35 * par;
  camPos.y += -mouse.y * 0.22 * par;
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  camera.updateMatrixWorld();

  // fog and shadow bounds grow with the shot so the whole car stays in range
  const camDist = camPos.distanceTo(camTgt);
  scene.fog.near = Math.max(28, camDist * 1.35);
  scene.fog.far = Math.max(64, camDist * 3);
  const shB = lerp(12, 34, ss(14.98, 15.1, s));
  if (Math.abs(key.shadow.camera.right - shB) > 0.01) {
    Object.assign(key.shadow.camera, { left: -shB, right: shB, top: shB, bottom: -shB, far: lerp(50, 95, (shB - 12) / 22) });
    key.shadow.camera.updateProjectionMatrix();
  }

  // ---- component showcase
  camera.getWorldDirection(fwd);
  const dist = camPos.distanceTo(camTgt);
  const D = dist * 0.5;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const showR = narrow ? Math.min(D * tv * 0.4, D * tv * camera.aspect * 0.78) : Math.min(D * tv * 0.6, D * tv * camera.aspect * 0.33);
  showP.copy(camPos).addScaledVector(fwd, D);
  displays.forEach(d => {
    const u = s - (5 + d.k);
    const ap = ss(-0.15, 0.12, u) * (1 - ss(0.62, 0.92, u));
    if (ap < 0.002) { d.pivot.visible = false; return; }
    d.hide.forEach(o => setFade(o, 1 - ss(0, 0.06, ap)));
    d.pivot.visible = true;
    const t = easeIO(ap);
    d.src.updateWorldMatrix(true, false);
    d.src.matrixWorld.decompose(tmpV, tmpQ, tmpS);
    startP.copy(d.center).applyMatrix4(d.src.matrixWorld);
    eul.set(d.base[0], d.base[1] + Math.sin(time * 0.42 + d.k) * 0.4, d.base[2]);
    localQ.setFromEuler(eul);
    showQ.copy(camera.quaternion).multiply(localQ);
    d.pivot.position.lerpVectors(startP, showP, t);
    d.pivot.quaternion.slerpQuaternions(tmpQ, showQ, t);
    d.pivot.scale.setScalar(lerp(1, showR / d.radius, t));
  });

  applyFade(eng.root, lerp(1, 0.09, ghost));

  // ---- combustion chambers
  const info = updateChambers(eng, phi);
  chamberA = info[0];
  let flash = 0;
  eng.chambers.forEach((m, i) => {
    const x = info[i].x, k = Math.floor(x) % 4, fr = x - Math.floor(x);
    tmpC.copy(phaseCols[k]).lerp(phaseCols[(k + 1) % 4], ss(0.85, 1, fr));
    let op = i === 0 ? 0.62 : 0.4;
    if (k === 2) {
      const fl = 1 - ss(0, 0.35, fr);
      tmpC.lerp(flashCol, fl * 0.8);
      op += fl * 0.35;
      flash = Math.max(flash, fl);
    }
    m.material.color.copy(tmpC);
    m.material.opacity = op * cham;
    m.visible = cham > 0.002;
  });
  if (cham > 0.002) {
    const pl = epiOff(Math.PI / 2, OUT);
    st[2].group.localToWorld(flashLight.position.set(pl.x, pl.y - 0.4, W / 2 + 0.6));
  }
  flashLight.intensity = flash * cham * 18;

  // ---- tags
  const w = innerWidth, h = viewH;
  tags.forEach(tg => {
    const vis = tg.group === 'tear' ? tear : cham;
    if (vis < 0.01) { if (tg.on) { tg.el.style.opacity = 0; tg.on = false; } return; }
    tg.get(tg.v);
    tg.v.project(camera);
    if (tg.v.z > 1) { tg.el.style.opacity = 0; return; }
    const x = (tg.v.x * 0.5 + 0.5) * w, y = (-tg.v.y * 0.5 + 0.5) * h;
    tg.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const flip = x > w * (narrow ? 0.5 : 0.8);
    if (flip !== tg.flip) { tg.el.classList.toggle('flip', flip); tg.flip = flip; }
    tg.el.style.opacity = vis.toFixed(3);
    tg.on = true;
  });

  // ---- UI
  const stage = stageName(s);
  if (stage !== lastStage) { ui.stage.textContent = stage; lastStage = stage; }
  ui.explode.textContent = `${Math.round((anc * 0.2 + b * 0.45 + lift * 0.2 + pop * 0.15) * 100)}%`;
  const shaftDeg = (phi * 180) / Math.PI;
  ui.shaft.textContent = `${shaftDeg.toFixed(1).padStart(6, '0')}°`;
  ui.rotor.textContent = `${(shaftDeg / 3).toFixed(1).padStart(5, '0')}°`;
  ui.bar.style.transform = `scaleX(${clamp(s / 15.9)})`;
  if (cham > 0.01) {
    const pA = Math.floor(chamberA.x) % 4;
    if (pA !== lastPhase) {
      lastPhase = pA;
      ui.phases.forEach((li, i) => li.classList.toggle('on', i === pA));
      ui.phaseText.textContent = PHASES[pA].text;
    }
    ui.readout.textContent = `SHAFT ${String(Math.round(wrap(shaftDeg - 630, 1080))).padStart(4, '0')}° / 1080°  ·  ROTOR ${String(Math.round(wrap(shaftDeg - 630, 1080) / 3)).padStart(3, '0')}°`;
  }
  sections.forEach((sec, i) => sec.classList.toggle('on', s > i - 0.3 && s < i + 1.02));
  const cur = Math.floor(s + 0.22);   // the one section whose text shows in the phone panel
  if (cur !== lastCur) { lastCur = cur; sections.forEach((sec, i) => sec.classList.toggle('cur', i === cur)); }
  let ch = 0;
  CHAPTERS.forEach(([, cs], i) => { if (s >= cs - 0.3) ch = i; });
  ui.rail.forEach((bt, i) => bt.classList.toggle('on', i === ch));
  const navIdx = s < 1 ? -1 : s < 3 ? 0 : s < 4 ? 1 : s < 14 ? 2 : s < 15 ? 3 : 4;
  ui.nav.forEach((a, i) => a.classList.toggle('on', i === navIdx));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
async function boot() {
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  build();
  layout();
  if (new URLSearchParams(location.search).has('debug')) window.__r3 = { sim, audio, demo: startDemo, get tour() { return tour; } };
  const q = new URLSearchParams(location.search).get('s');
  if (q !== null) {
    scrollToS(parseFloat(q), 'instant');
    sCur = scrollS();
  }
  addEventListener('resize', layout);
  document.fonts?.addEventListener?.('loadingdone', layout);
  // video mode adds room under the phone panel for the tour bar, so re-fit the view
  new MutationObserver(layout).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);
  addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  ui.rail.forEach(bt => bt.addEventListener('click', () => scrollToS(parseFloat(bt.dataset.s) + 0.02)));
  tour = new Tour({
    sections, chapters: CHAPTERS, getS: () => sCur,
    onPlay: () => audio.ensure(),
    cues: [{ s: INSTALLED + 0.05, fn: () => startDemo() }],   // car section: start it and run the rev demo
  });
  document.querySelectorAll('[data-tour-play]').forEach(b => b.addEventListener('click', () => { audio.ensure(); tour.start(); }));
  requestAnimationFrame(t => { last = t; frame(t); $('#loader').classList.add('done'); });
}
boot().catch(err => {
  console.error(err);
  $('#loader .loader-note').textContent = 'WebGL failed to start: ' + err.message;
});
