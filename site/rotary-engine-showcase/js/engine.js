// TRIAD R3 — procedural triple-rotor Wankel model.
// Units: 1 = 100 mm. Housing math is done in a "math frame" (major axis on x);
// the core group is rotated 90° so the major axis stands vertical in the world.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  castMetalTexture, brushedMetalTexture, radialMachinedTexture,
  wrinkleCoatTexture, braidedHoseTexture,
} from './textures.js';

export const TAU = Math.PI * 2;
export const R = 1.05;    // generating radius (105 mm)
export const E = 0.15;    // eccentricity (15 mm)
export const W = 0.8;     // rotor housing width (80 mm)
export const RW = 0.76;   // rotor width
export const GAP = 0.95;  // exploded spacing between slabs
export const CLR = 0.01;  // rotor-to-bore clearance
export const OUT = 0.34;  // housing wall beyond the bore
export const LOBE = [0, TAU / 3, (2 * TAU) / 3];   // eccentric lobe phasing
export const GEAR_SIDE = [1, 1, -1];               // which face carries the rotor gear
export const PLUG_T = [Math.PI / 2 - 0.2, Math.PI / 2 + 0.2];
export const EXH_T = -Math.PI / 2 - 0.55;
export const RUN_T = -Math.PI / 2 + 0.75;
const BOLT_T = [0, 0.55, 1.05, 2.09, 2.59, Math.PI, 3.69, 4.19, 5.23, 5.73];

const v2 = (x, y) => new THREE.Vector2(x, y);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

export const epi = t => v2(R * Math.cos(t) + E * Math.cos(3 * t), R * Math.sin(t) + E * Math.sin(3 * t));
export function epiN(t) {
  const dx = -R * Math.sin(t) - 3 * E * Math.sin(3 * t);
  const dy = R * Math.cos(t) + 3 * E * Math.cos(3 * t);
  const l = Math.hypot(dx, dy);
  return v2(dy / l, -dx / l);
}
export const epiOff = (t, d) => epi(t).add(epiN(t).multiplyScalar(d));
// math frame (core local) -> world, valid because core is rotated +90° about z
export const toWorld = (p, z = 0) => v3(-p.y, p.x, z);

const ring = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * TAU));
const circ = (cx, cy, r, n = 24) => ring(n, t => v2(cx + r * Math.cos(t), cy + r * Math.sin(t)));
const ell = (cx, cy, rx, ry, rot, n = 28) => ring(n, t => {
  const x = rx * Math.cos(t), y = ry * Math.sin(t);
  return v2(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
});
const arc = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = lerp(a0, a1, i / n);
  return v2(r * Math.cos(a), r * Math.sin(a));
});

// ---------------------------------------------------------------------------
// Rotor profile: inner envelope of the epitrochoid seen from the rotor frame.
// The rotor centre orbits at radius E with shaft angle phi while the rotor
// turns at phi/3, so we sweep the bore through that motion and keep the
// smallest radius per polar angle. This is the exact rotor flank shape.
const BINS = 1440;
const PROFILE = (() => {
  const NT = 720, NP = 1440;
  const hx = new Float64Array(NT), hy = new Float64Array(NT);
  for (let j = 0; j < NT; j++) {
    const t = (j / NT) * TAU;
    hx[j] = R * Math.cos(t) + E * Math.cos(3 * t);
    hy[j] = R * Math.sin(t) + E * Math.sin(3 * t);
  }
  const r = new Float64Array(BINS).fill(Infinity);
  for (let i = 0; i < NP; i++) {
    const phi = (i / NP) * 3 * TAU, psi = phi / 3;
    const cx = E * Math.cos(phi), cy = E * Math.sin(phi);
    const c = Math.cos(psi), s = Math.sin(psi);
    for (let j = 0; j < NT; j++) {
      const px = hx[j] - cx, py = hy[j] - cy;
      const qx = px * c + py * s, qy = -px * s + py * c;
      let a = Math.atan2(qy, qx);
      if (a < 0) a += TAU;
      const b = Math.min(BINS - 1, ((a / TAU) * BINS) | 0);
      const d = Math.sqrt(qx * qx + qy * qy);
      if (d < r[b]) r[b] = d;
    }
  }
  const third = BINS / 3, sym = new Float64Array(BINS);
  for (let b = 0; b < BINS; b++) sym[b] = Math.min(r[b], r[(b + third) % BINS], r[(b + 2 * third) % BINS]);
  for (let b = 0; b < BINS; b++) if (!isFinite(sym[b])) sym[b] = sym[(b + BINS - 1) % BINS];
  const out = new Float64Array(BINS);
  for (let b = 0; b < BINS; b++) {
    let acc = 0;
    for (let k = -2; k <= 2; k++) acc += sym[(b + k + BINS) % BINS];
    out[b] = acc / 5;
  }
  return out;
})();

export function rotorR(a) {
  a = ((a % TAU) + TAU) % TAU;
  const f = (a / TAU) * BINS - 0.5;
  const i0 = Math.floor(f), w = f - i0;
  const r0 = PROFILE[(i0 + BINS) % BINS], r1 = PROFILE[(i0 + 1 + BINS) % BINS];
  return r0 + (r1 - r0) * w;
}
export const ROTOR_MIN = PROFILE.reduce((m, v) => Math.min(m, v), Infinity);

// ---------------------------------------------------------------------------
function gearPts(N, rp, m, internal, phase = 0) {
  const ra = internal ? rp - m : rp + m;
  const rf = internal ? rp + 1.25 * m : rp - 1.25 * m;
  const hp = Math.PI / N, out = [];
  const P = (r, a) => v2(r * Math.cos(a), r * Math.sin(a));
  for (let j = 0; j < N; j++) {
    const c = phase + j * 2 * hp;
    out.push(P(rf, c - hp), P(rf, c - 0.6 * hp), P(ra, c - 0.3 * hp), P(ra, c + 0.3 * hp), P(rf, c + 0.6 * hp));
  }
  return out;
}

function extrude(outer, holes, depth, bevel = 0.012, segs = 2) {
  const shape = new THREE.Shape(outer);
  holes.forEach(h => shape.holes.push(new THREE.Path(h)));
  const core = Math.max(0.001, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core, steps: 1, curveSegments: 12,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs,
  });
  g.translate(0, 0, -core / 2);
  return g;
}

const cylZ = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg).rotateX(Math.PI / 2);
const cylY = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);

function heatTint(geo) {
  const uv = geo.attributes.uv, n = uv.count, col = new Float32Array(n * 3);
  const stops = [
    [0.0, [1.0, 0.78, 0.42]],   // hot straw-gold near exhaust port
    [0.16, [0.95, 0.56, 0.28]], // deep bronze-amber
    [0.34, [0.68, 0.34, 0.62]], // heat-cycled violet
    [0.52, [0.34, 0.48, 0.88]], // titanium burnt blue
    [0.74, [0.70, 0.74, 0.82]], // cooling steel
    [1.0, [0.88, 0.87, 0.86]],  // raw stainless at collector
  ];
  for (let i = 0; i < n; i++) {
    const u = uv.getX(i);
    let k = 0;
    while (k < stops.length - 2 && u > stops[k + 1][0]) k++;
    const [u0, c0] = stops[k], [u1, c1] = stops[k + 1];
    const t = Math.min(1, Math.max(0, (u - u0) / (u1 - u0)));
    col[i * 3] = lerp(c0[0], c1[0], t); col[i * 3 + 1] = lerp(c0[1], c1[1], t); col[i * 3 + 2] = lerp(c0[2], c1[2], t);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  // Brushed dark billet backing
  const bg = g.createLinearGradient(0, 0, 1024, 256);
  bg.addColorStop(0, '#14171c'); bg.addColorStop(0.5, '#0c0e12'); bg.addColorStop(1, '#181c22');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 256);
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
    g.fillRect(0, y, 1024, 1);
  }
  // Engraved double border + corner rivets
  g.strokeStyle = '#ff5b1f'; g.lineWidth = 6; g.strokeRect(16, 16, 992, 224);
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; g.strokeRect(28, 28, 968, 200);
  for (const [rx, ry] of [[42, 42], [982, 42], [42, 214], [982, 214]]) {
    g.fillStyle = '#8b929c'; g.beginPath(); g.arc(rx, ry, 8, 0, TAU); g.fill();
    g.fillStyle = '#22262c'; g.beginPath(); g.arc(rx, ry, 4, 0, TAU); g.fill();
  }
  // Rotor emblem on left
  g.save();
  g.strokeStyle = '#ff5b1f'; g.lineWidth = 10; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(120, 66); g.quadraticCurveTo(175, 118, 178, 174);
  g.quadraticCurveTo(120, 198, 62, 174); g.quadraticCurveTo(65, 118, 120, 66);
  g.closePath(); g.stroke();
  g.fillStyle = '#ff5b1f'; g.beginPath(); g.arc(120, 134, 14, 0, TAU); g.fill();
  g.restore();

  g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
  g.font = '800 112px Archivo, "Arial Black", Arial, sans-serif';
  g.fillText('TRIAD', 206, 118);
  g.fillStyle = '#ff5b1f';
  g.fillText('R3', 558, 118);
  g.fillStyle = '#b9c0ca';
  g.font = '600 30px "JetBrains Mono", Consolas, monospace';
  g.fillText('1,962CC · TRIPLE-ROTOR · 9,000 RPM', 210, 192);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeMaterials(plateTex) {
  const castAluBump = castMetalTexture(101, 1.0, [4, 4]);
  const castIronBump = castMetalTexture(207, 1.15, [5, 5]);
  const brushedBump = brushedMetalTexture(309, [3, 3]);
  const radialBump = radialMachinedTexture(411, false);
  const wrinkleBump = wrinkleCoatTexture(517, [8, 8]);
  const braidMap = braidedHoseTexture([22, 2]);

  const M = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  return {
    alu: M(0xbcc2c9, 0.96, 0.36, { bumpMap: castAluBump, bumpScale: 0.012, roughnessMap: castAluBump }),
    aluPol: M(0xdce0e6, 1.0, 0.16, { bumpMap: brushedBump, bumpScale: 0.005 }),
    aluDark: M(0x636972, 0.94, 0.4, { bumpMap: castAluBump, bumpScale: 0.014 }),
    iron: M(0x4b5058, 0.88, 0.54, { bumpMap: castIronBump, bumpScale: 0.018, roughnessMap: castIronBump }),
    face: M(0xc2c6cc, 1.0, 0.16, { bumpMap: radialBump, bumpScale: 0.004 }),
    chrome: M(0xf2f5f8, 1.0, 0.06, { bumpMap: brushedBump, bumpScale: 0.002 }),
    rotor: M(0x3a3e45, 0.94, 0.32, { bumpMap: castIronBump, bumpScale: 0.01 }),
    steel: M(0xcfd3d9, 1.0, 0.15, { bumpMap: brushedBump, bumpScale: 0.004 }),
    gear: M(0xa9adb3, 1.0, 0.24, { bumpMap: brushedBump, bumpScale: 0.006 }),
    bronze: M(0xc48b42, 1.0, 0.26, { bumpMap: brushedBump, bumpScale: 0.004 }),
    tin: M(0xe0b95e, 1.0, 0.22),
    black: M(0x16181c, 0.32, 0.66, { bumpMap: wrinkleBump, bumpScale: 0.016 }),
    ceramic: M(0xf4f2ec, 0.0, 0.26),
    accent: M(0xff5b1f, 0.35, 0.3, { emissive: 0x330a00 }),
    exhaust: M(0xa89e94, 1.0, 0.28, { bumpMap: brushedBump, bumpScale: 0.006 }),
    exhaustTint: M(0xe6dfd8, 1.0, 0.25, { vertexColors: true, bumpMap: brushedBump, bumpScale: 0.005 }),
    bolt: M(0x90969e, 1.0, 0.26),
    port: M(0x070809, 0.15, 0.86),
    plate: M(0xffffff, 0.45, 0.38, { map: plateTex }),
    rubber: M(0x131416, 0.0, 0.78),
    oring: M(0x1c2b22, 0.0, 0.52),
    gasket: M(0x6e4326, 0.85, 0.44),
    anodBlue: M(0x2268d6, 0.78, 0.24),
    anodRed: M(0xc81e28, 0.78, 0.24),
    braided: M(0xd8dde4, 0.92, 0.34, { map: braidMap, bumpMap: braidMap, bumpScale: 0.015 }),
    silicone: M(0x19386b, 0.08, 0.42),
    recess: M(0x1c1e22, 0.65, 0.68, { bumpMap: castIronBump, bumpScale: 0.012 }),
    castAlu: M(0xa0a6ae, 0.95, 0.48, { bumpMap: castAluBump, bumpScale: 0.016, roughnessMap: castAluBump }),
  };
}

// thin-walled ring following the trochoid at offsets d0..d1 (used for face O-rings)
function trochoidRing(d0, d1, depth) {
  return extrude(ring(240, t => epiOff(t, d1)), [ring(240, t => epiOff(t, d0))], depth, 0);
}

// convex hull of points (monotone chain), returns CCW loop
function hull(pts) {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// orient a mesh/group so its local +Y follows direction d
const Yax = new THREE.Vector3(0, 1, 0);
function alignTo(obj, d) { obj.quaternion.setFromUnitVectors(Yax, d.clone().normalize()); return obj; }

// ---------------------------------------------------------------------------
export function buildEngine(M) {
  const root = new THREE.Group();
  const core = new THREE.Group();
  core.rotation.z = Math.PI / 2;
  root.add(core);
  const anc = new THREE.Group();
  root.add(anc);

  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const Y = v3(0, 1, 0);
  const alignY = (obj, d) => obj.quaternion.setFromUnitVectors(Y, d.clone().normalize());

  // ---- the stack, front (+z) to rear
  const defs = [['fc', 0.32], ['fh', 0.55], ['rh', W], ['ih', 0.5], ['rh', W], ['ih', 0.5], ['rh', W], ['rr', 0.55]];
  const total = defs.reduce((s, d) => s + d[1], 0);
  const FRONT = total / 2, REAR = -total / 2;
  let cur = FRONT;
  const stack = defs.map(([type, th], i) => {
    const z0 = cur - th / 2;
    cur -= th;
    const group = new THREE.Group();
    group.position.z = z0;
    core.add(group);
    return { type, th, z0, ex: (3.5 - i) * GAP, group };
  });
  const RH = [2, 4, 6], PLATE = [1, 3, 7];

  const outer = ring(288, t => epiOff(t, OUT));
  const boltHoles = BOLT_T.map(t => { const p = epiOff(t, 0.215); return circ(p.x, p.y, 0.042, 18); });
  const coolHoles = ring(44, t => t).map(t => { const p = epiOff(t, 0.105); return circ(p.x, p.y, 0.027, 12); });
  const linerOut = ring(288, t => epiOff(t, 0.026));
  const bore = ring(288, epi);

  // ---- rotor housings
  const rhGeo = extrude(outer, [linerOut, ...boltHoles, ...coolHoles], W, 0.014, 2);
  const linerGeo = extrude(linerOut, [bore], W - 0.01, 0);
  const bossGeo = cylY(0.085, 0.095, 0.18, 24);
  const flangeGeo = new RoundedBoxGeometry(0.14, 0.5, 0.58, 2, 0.03);
  const portGeo = new THREE.BoxGeometry(0.02, 0.3, 0.36);
  const oringInner = trochoidRing(0.05, 0.064, 0.006);
  const oringOuter = trochoidRing(0.145, 0.157, 0.006);
  const outletGeo = cylY(0.11, 0.13, 0.2, 24);
  const finGeo = new RoundedBoxGeometry(0.055, 0.032, W - 0.14, 1, 0.008);
  RH.forEach(i => {
    const g = stack[i].group;
    add(rhGeo, M.alu, g);
    add(linerGeo, M.chrome, g);
    // Iconic external rotary cooling/stiffening ribs around the housing waist
    for (let fI = 0; fI < 30; fI++) {
      const t = (fI / 30) * TAU;
      // Skip areas occupied by spark plug bosses, exhaust flange, and top coolant boss
      if (Math.abs(t) < 0.22 || Math.abs(t - TAU) < 0.22) continue;
      if (Math.abs(t - Math.PI / 2) < 0.42) continue;
      const dtExh = Math.atan2(Math.sin(t - EXH_T), Math.cos(t - EXH_T));
      if (Math.abs(dtExh) < 0.36) continue;
      const n = epiN(t), p = epiOff(t, OUT + 0.015);
      add(finGeo, M.castAlu, g, p.x, p.y, 0).rotation.z = Math.atan2(n.y, n.x);
    }
    for (const f of [1, -1]) {
      add(oringInner, M.oring, g, 0, 0, f * (W / 2 + 0.002));
      add(oringOuter, M.oring, g, 0, 0, f * (W / 2 + 0.002));
    }
    // coolant outlet boss on the top (math +x = world up)
    const cp = epiOff(0, OUT + 0.08);
    alignY(add(outletGeo, M.alu, g, cp.x, cp.y, 0), v3(1, 0, 0));
    PLUG_T.forEach(t => {
      const n = epiN(t), p = epiOff(t, OUT + 0.06);
      alignY(add(bossGeo, M.alu, g, p.x, p.y, 0), v3(n.x, n.y, 0));
    });
    const n = epiN(EXH_T), ang = Math.atan2(n.y, n.x);
    const fp = epiOff(EXH_T, OUT + 0.04);
    add(flangeGeo, M.alu, g, fp.x, fp.y, 0).rotation.z = ang;
    const pp = epiOff(EXH_T, OUT + 0.112);
    add(portGeo, M.port, g, pp.x, pp.y, 0).rotation.z = ang;
  });

  // ---- end plates, intermediate housings, front cover
  const center = circ(0, 0, 0.23, 48);
  const ports = [ell(0.36, -0.6, 0.15, 0.085, -0.5), ell(0.64, -0.42, 0.12, 0.075, -0.9)];
  const faceGeo = extrude(bore, [circ(0, 0, 0.25, 48)], 0.004, 0);
  const faceGeoPorts = extrude(bore, [circ(0, 0, 0.25, 48), ...ports], 0.004, 0);
  const plateCache = {};
  const plateGeo = (th, withPorts) => {
    const key = th + (withPorts ? 'p' : '');
    return plateCache[key] || (plateCache[key] = extrude(outer, [center, ...boltHoles, ...coolHoles, ...(withPorts ? ports : [])], th, 0.014, 2));
  };
  stack.forEach(it => {
    const g = it.group;
    if (it.type === 'fc') {
      add(extrude(ring(200, t => epiOff(t, 0.1)), [circ(0, 0, 0.16, 40)], it.th, 0.02, 2), M.aluDark, g);
      add(cylZ(0.24, 0.24, 0.12, 40), M.aluDark, g, -0.62, 0, it.th / 2 + 0.06);
      add(cylZ(0.1, 0.1, 0.05, 6), M.bolt, g, -0.62, 0, it.th / 2 + 0.145);
      // Water pump thermostat neck on top-front of front cover (math +x = world up)
      alignY(add(cylY(0.11, 0.13, 0.34, 24), M.castAlu, g, 0.72, 0.25, it.th / 2 + 0.02), v3(0.6, 0.25, 0.75));
      alignY(add(cylY(0.14, 0.14, 0.04, 24), M.aluPol, g, 0.84, 0.3, it.th / 2 + 0.17), v3(0.6, 0.25, 0.75));
      return;
    }
    if (it.type === 'rh') return;
    const isIH = it.type === 'ih';
    add(plateGeo(it.th, isIH), M.iron, g);
    // Oil filter pedestal & spin-on race oil filter on the rear housing (math +x = world up, +y = world -x)
    if (it.type === 'rr') {
      add(new RoundedBoxGeometry(0.45, 0.42, 0.38, 2, 0.04), M.castAlu, g, 1.38, 0.36, 0);
      alignY(add(cylY(0.24, 0.24, 0.56, 32), M.anodRed, g, 1.72, 0.56, 0), v3(0.82, 0.56, 0));
      alignY(add(cylY(0.25, 0.25, 0.05, 16), M.black, g, 1.97, 0.73, 0), v3(0.82, 0.56, 0));
    }
    // Billet oil filler neck + knurled cap on the front intermediate housing
    if (it.type === 'fh') {
      alignY(add(cylY(0.12, 0.14, 0.42, 24), M.castAlu, g, 1.38, 0.42, 0), v3(0.85, 0.52, 0));
      alignY(add(cylY(0.16, 0.16, 0.09, 12), M.anodRed, g, 1.58, 0.55, 0), v3(0.85, 0.52, 0));
    }
    const fg = isIH ? faceGeoPorts : faceGeo;
    if (it.type !== 'fh') add(fg, M.face, g, 0, 0, it.th / 2 + 0.002);
    if (it.type !== 'rr') add(fg, M.face, g, 0, 0, -it.th / 2 - 0.002);
  });

  // ---- rotors
  const rotorPts = ring(360, a => { const r = rotorR(a) - CLR; return v2(r * Math.cos(a), r * Math.sin(a)); });
  const rotorGeo = extrude(rotorPts, [circ(0, 0, 0.5, 72)], RW, 0.012, 2);
  const mod = (2 * 0.3) / 34;
  const ringGearGeo = extrude(circ(0, 0, 0.5, 72), [gearPts(51, 0.45, mod, true, 0)], 0.22, 0);
  const hubGeo = extrude(circ(0, 0, 0.5, 72), [circ(0, 0, 0.4, 72)], RW - 0.25, 0);
  const brgGeo = extrude(circ(0, 0, 0.4, 72), [circ(0, 0, 0.372, 72)], RW - 0.26, 0);
  const apexGeo = new THREE.BoxGeometry(0.07, 0.022, RW - 0.012);
  const cornerGeo = cylZ(0.03, 0.03, 0.05, 20);
  const oilGeos = [0.555, 0.595].map(r => extrude(circ(0, 0, r + 0.009, 96), [circ(0, 0, r, 96)], 0.006, 0));
  const sideGeos = [0, 1, 2].map(i => {
    const a0 = (i * TAU) / 3 + 0.17, a1 = ((i + 1) * TAU) / 3 - 0.17, n = 48, o = [], inn = [];
    for (let j = 0; j <= n; j++) {
      const a = lerp(a0, a1, j / n), r = rotorR(a) - CLR;
      o.push(v2((r - 0.05) * Math.cos(a), (r - 0.05) * Math.sin(a)));
      inn.push(v2((r - 0.066) * Math.cos(a), (r - 0.066) * Math.sin(a)));
    }
    return extrude([...o, ...inn.reverse()], [], 0.008, 0);
  });

  // combustion recess: a shallow lens-shaped pocket in the middle of each flank
  const recessGeos = [0, 1, 2].map(i => {
    const mid = (i * TAU) / 3 + TAU / 6, na = 28, nz = 10, pos = [], idx = [];
    for (let a = 0; a <= na; a++) {
      const t = a / na, ang = mid + (t - 0.5) * 0.62;
      const half = 0.19 * Math.pow(Math.sin(Math.PI * t), 0.55);
      const r = rotorR(ang) - CLR + 0.0018;
      for (let b = 0; b <= nz; b++) {
        const z = (b / nz - 0.5) * 2 * half;
        pos.push(r * Math.cos(ang), r * Math.sin(ang), z);
      }
    }
    for (let a = 0; a < na; a++) for (let b = 0; b < nz; b++) {
      const p = a * (nz + 1) + b;
      idx.push(p, p + nz + 1, p + 1, p + 1, p + nz + 1, p + nz + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });

  const rotors = RH.map((hi, k) => {
    const sk = GEAR_SIDE[k];
    const group = new THREE.Group();
    group.position.z = stack[hi].z0;
    core.add(group);
    const body = add(rotorGeo, M.rotor, group);
    recessGeos.forEach(g => { add(g, M.recess, group).material = M.recess; });
    add(ringGearGeo, M.gear, group, 0, 0, sk * (RW / 2 - 0.012 - 0.11));
    add(hubGeo, M.rotor, group, 0, 0, -sk * 0.125);
    add(brgGeo, M.bronze, group, 0, 0, -sk * 0.125);
    const seals = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3, c = Math.cos(a), s = Math.sin(a);
      const ap = add(apexGeo, M.tin, group, (R - 0.039) * c, (R - 0.039) * s, 0);
      ap.rotation.z = a;
      seals.push({ mesh: ap, kind: 'apex', base: ap.position.clone(), delta: v3(c * 0.5, s * 0.5, 0) });
      for (const f of [1, -1]) {
        const cs = add(cornerGeo, M.bronze, group, (R - 0.09) * c, (R - 0.09) * s, f * (RW / 2 - 0.024));
        seals.push({ mesh: cs, kind: 'corner', base: cs.position.clone(), delta: v3(c * 0.5, s * 0.5, f * 0.3) });
        const sd = add(sideGeos[i], M.steel, group, 0, 0, f * (RW / 2 - 0.002));
        const mid = a + TAU / 6;
        seals.push({ mesh: sd, kind: 'side', base: sd.position.clone(), delta: v3(Math.cos(mid) * 0.18, Math.sin(mid) * 0.18, f * 0.24) });
      }
    }
    for (const f of [1, -1]) {
      oilGeos.forEach((g, j) => {
        const o = add(g, M.steel, group, 0, 0, f * (RW / 2 - 0.001));
        seals.push({ mesh: o, kind: 'oil', base: o.position.clone(), delta: v3(0, 0, f * (0.12 + j * 0.06)) });
      });
    }
    return { group, body, k, si: hi, sk, seals, apex: seals.filter(s => s.kind === 'apex').map(s => s.mesh), kin: v2(0, 0) };
  });

  // ---- eccentric shaft
  const shaft = new THREE.Group();
  core.add(shaft);
  const mainA = REAR - 0.12, mainB = FRONT - 0.3;
  add(cylZ(0.2, 0.2, mainB - mainA, 48), M.steel, shaft, 0, 0, (mainA + mainB) / 2);
  add(cylZ(0.15, 0.15, 0.36, 40), M.steel, shaft, 0, 0, FRONT - 0.12);
  add(cylZ(0.13, 0.13, 0.55, 40), M.steel, shaft, 0, 0, FRONT + 0.33);
  add(cylZ(0.32, 0.32, 0.07, 48), M.steel, shaft, 0, 0, REAR - 0.155);
  const lobeGeo = cylZ(0.37, 0.37, RW - 0.27, 72);
  const oilHole = cylY(0.028, 0.028, 0.012, 12);
  rotors.forEach((r, k) => {
    const lx = E * Math.cos(LOBE[k]), ly = E * Math.sin(LOBE[k]), lz = stack[r.si].z0 - r.sk * 0.125;
    add(lobeGeo, M.steel, shaft, lx, ly, lz);
    // oil feed holes on the lobe surface
    [0.6, 2.4].forEach(a => {
      const d = v3(Math.cos(LOBE[k] + a), Math.sin(LOBE[k] + a), 0);
      alignY(add(oilHole, M.port, shaft, lx + d.x * 0.366, ly + d.y * 0.366, lz + 0.08), d);
    });
  });
  // 20B-style split shaft: tapered coupling sleeve between rotors 2 and 3
  {
    const zc = stack[5].z0;
    add(cylZ(0.245, 0.245, 0.16, 48), M.gear, shaft, 0, 0, zc);
    add(cylZ(0.2, 0.245, 0.06, 48), M.gear, shaft, 0, 0, zc + 0.11);
    add(cylZ(0.245, 0.2, 0.06, 48), M.gear, shaft, 0, 0, zc - 0.11);
    ring(6, t => t).forEach(t => add(cylZ(0.022, 0.022, 0.17, 6), M.bolt, shaft, 0.222 * Math.cos(t), 0.222 * Math.sin(t), zc));
  }
  // front oil seal and key
  add(extrude(circ(0, 0, 0.19, 40), [circ(0, 0, 0.15, 40)], 0.05, 0), M.rubber, shaft, 0, 0, FRONT - 0.33);
  add(new THREE.BoxGeometry(0.05, 0.04, 0.3), M.steel, shaft, 0.13, 0, FRONT + 0.4);
  const cwPts = [...arc(0.62, Math.PI / 2, (3 * Math.PI) / 2, 40), ...arc(0.18, (3 * Math.PI) / 2, Math.PI / 2, 16).slice(1, -1)];
  add(extrude(cwPts, [], 0.1, 0.012, 2), M.steel, shaft, 0, 0, stack[0].z0);

  // ---- stationary gears (one per rotor, fixed to the adjacent plate)
  const gTeeth = extrude(gearPts(34, 0.3, mod, false, 0), [circ(0, 0, 0.215, 48)], 0.22, 0.004, 1);
  const gFlange = extrude(circ(0, 0, 0.42, 64), [circ(0, 0, 0.215, 48)], 0.06, 0.006, 1);
  const gBush = extrude(circ(0, 0, 0.215, 48), [circ(0, 0, 0.201, 48)], 0.24, 0);
  const gears = rotors.map((r, k) => {
    const group = new THREE.Group();
    const z0 = stack[r.si].z0 + r.sk * (RW / 2 - 0.012 - 0.11);
    group.position.z = z0;
    core.add(group);
    add(gTeeth, M.gear, group);
    add(gFlange, M.gear, group, 0, 0, r.sk * 0.14);
    add(gBush, M.bronze, group);
    return { group, z0, side: r.sk, plate: PLATE[k] };
  });

  // ---- tension bolts
  const boltGroup = new THREE.Group();
  core.add(boltGroup);
  const boltFace = FRONT - 0.32;
  const shank = cylZ(0.034, 0.034, boltFace - REAR + 0.06, 12);
  const head = cylZ(0.072, 0.072, 0.07, 6), washer = cylZ(0.082, 0.082, 0.016, 24);
  const bolts = BOLT_T.map(t => {
    const p = epiOff(t, 0.215);
    const bg = new THREE.Group();
    boltGroup.add(bg);
    add(shank, M.bolt, bg, p.x, p.y, (boltFace + REAR) / 2);
    add(washer, M.bolt, bg, p.x, p.y, boltFace + 0.008);
    add(head, M.bolt, bg, p.x, p.y, boltFace + 0.05);
    return bg;
  });

  // ---- front pulley (spins with the shaft)
  const pulley = new THREE.Group();
  pulley.position.z = FRONT + 0.47;
  root.add(pulley);
  add(cylZ(0.22, 0.22, 0.32, 40), M.steel, pulley);
  add(cylZ(0.64, 0.64, 0.05, 72), M.aluDark, pulley, 0, 0, -0.02);
  const lp = [v2(0.62, -0.15), v2(0.75, -0.15)];
  for (let gI = 0; gI < 6; gI++) {
    const y = -0.13 + gI * 0.046;
    lp.push(v2(0.75, y), v2(0.715, y + 0.023));
  }
  lp.push(v2(0.75, 0.15), v2(0.62, 0.15), v2(0.62, -0.15));
  const rim = add(new THREE.LatheGeometry(lp, 96).rotateX(Math.PI / 2), M.aluDark.clone(), pulley);
  rim.material.side = THREE.DoubleSide;
  add(extrude(circ(0, 0, 0.585, 72), [circ(0, 0, 0.5, 72)], 0.07, 0.008, 1), M.accent, pulley, 0, 0, -0.1);
  add(cylZ(0.1, 0.1, 0.08, 6), M.bolt, pulley, 0, 0, 0.2);
  add(new THREE.BoxGeometry(0.03, 0.06, 0.02), M.ceramic, pulley, 0, 0.72, 0.155);

  // ---- flywheel
  const fly = new THREE.Group();
  fly.position.z = REAR - 0.3;
  root.add(fly);
  const flyHoles = [circ(0, 0, 0.16, 40), ...ring(6, t => t).map(t => circ(0.72 * Math.cos(t + Math.PI / 6), 0.72 * Math.sin(t + Math.PI / 6), 0.13, 28))];
  add(extrude(gearPts(96, 1.2, 0.022, false, 0), flyHoles, 0.12, 0.006, 1), M.steel, fly);
  add(extrude(circ(0, 0, 1.0, 120), [circ(0, 0, 0.5, 80)], 0.012, 0), M.face, fly, 0, 0, -0.066);
  add(cylZ(0.3, 0.3, 0.22, 48), M.steel, fly);
  ring(6, t => t).forEach(t => add(cylZ(0.04, 0.04, 0.05, 6), M.bolt, fly, 0.24 * Math.cos(t), 0.24 * Math.sin(t), 0.13));

  // ---- spark plugs (math frame group, like the core)
  const plugGroup = new THREE.Group();
  plugGroup.rotation.z = Math.PI / 2;
  anc.add(plugGroup);
  const pg = {
    thread: cylY(0.048, 0.048, 0.16, 20), washer: cylY(0.07, 0.07, 0.012, 24), hex: cylY(0.08, 0.08, 0.1, 6),
    shell: cylY(0.06, 0.07, 0.04, 24), ins: cylY(0.036, 0.046, 0.26, 24), rib: cylY(0.045, 0.045, 0.014, 24),
    term: cylY(0.018, 0.018, 0.07, 12), cap: cylY(0.027, 0.027, 0.03, 12),
    boot: cylY(0.068, 0.058, 0.16, 20), bootCollar: cylY(0.042, 0.052, 0.06, 16),
  };
  const plugs = RH.map(hi => PLUG_T.map((t, pi) => {
    const n = epiN(t), p = epiOff(t, OUT + 0.15);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, stack[hi].z0);
    alignY(g, v3(n.x, n.y, 0));
    plugGroup.add(g);
    add(pg.thread, M.steel, g, 0, -0.08, 0);
    add(pg.washer, M.steel, g, 0, 0.006, 0);
    add(pg.hex, M.bolt, g, 0, 0.062, 0);
    add(pg.shell, M.steel, g, 0, 0.13, 0);
    add(pg.ins, M.ceramic, g, 0, 0.28, 0);
    for (let i = 0; i < 4; i++) add(pg.rib, M.ceramic, g, 0, 0.21 + i * 0.045, 0);
    add(pg.term, M.steel, g, 0, 0.445, 0);
    add(pg.cap, M.steel, g, 0, 0.49, 0);
    // Silicone ignition boot cap (leading = red/orange, trailing = blue)
    add(pg.boot, pi === 0 ? M.anodRed : M.silicone, g, 0, 0.56, 0);
    add(pg.bootCollar, M.rubber, g, 0, 0.66, 0);
    g.userData.base = g.position.clone();
    g.userData.dir = v3(n.x, n.y, 0);
    return g;
  }));

  const rotorZ = rotors.map(r => stack[r.si].z0);

  // shared small hardware
  const hexNut = cylY(0.034, 0.034, 0.036, 6);
  const studGeo = cylY(0.014, 0.014, 0.07, 8);
  const boltHead = cylY(0.03, 0.03, 0.03, 6);
  // place a fastener on a flange face: position p, axis d
  const fastener = (parent, p, d, nut = true) => {
    alignTo(add(studGeo, M.steel, parent, p.x + d.x * 0.02, p.y + d.y * 0.02, p.z + d.z * 0.02), d);
    alignTo(add(nut ? hexNut : boltHead, M.bolt, parent, p.x + d.x * 0.03, p.y + d.y * 0.03, p.z + d.z * 0.03), d);
  };
  // thin weld bead / clamp ring around a tube at point p with axis d
  const ringAt = (parent, geo, mat, p, d) => {
    const m = add(geo, mat, parent, p.x, p.y, p.z);
    m.quaternion.setFromUnitVectors(v3(0, 0, 1), d.clone().normalize());
    return m;
  };

  // ---- intake manifold (upper plenum, six runners, lower flanges, fuel system, throttle body)
  const intake = new THREE.Group();
  anc.add(intake);
  let throttlePlate;
  {
    const PX = 2.3, PY = 1.86;
    add(new RoundedBoxGeometry(0.8, 0.62, 4.5, 4, 0.12), M.black, intake, PX, PY, 0);
    // machined top cover with bolt row and nameplate
    add(new RoundedBoxGeometry(0.62, 0.05, 4.22, 2, 0.02), M.aluPol, intake, PX, PY + 0.33, 0);
    add(new THREE.PlaneGeometry(1.9, 0.475).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), M.plate, intake, PX, PY + 0.357, 0.4);
    for (let z = -1.95; z <= 1.96; z += 0.39) for (const dx of [-0.27, 0.27]) add(boltHead, M.bolt, intake, PX + dx, PY + 0.37, z);
    // cast ribs on the outboard face
    const rib = new RoundedBoxGeometry(0.06, 0.5, 0.05, 2, 0.015);
    for (let z = -2.0; z <= 2.01; z += 0.5) add(rib, M.black, intake, PX + 0.41, PY - 0.02, z);
    // vacuum nipples
    [-1.6, -0.6, 1.2].forEach(z => alignTo(add(cylY(0.025, 0.03, 0.12, 12), M.aluPol, intake, PX + 0.2, PY + 0.4, z), v3(0.3, 1, 0)));

    // throttle body: adapter flange, body, bellmouth, plate, cam and position sensor
    const TZ = 2.25;
    add(new RoundedBoxGeometry(0.62, 0.62, 0.06, 2, 0.04), M.aluPol, intake, PX, PY, TZ + 0.03);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => add(cylZ(0.03, 0.03, 0.04, 6), M.bolt, intake, PX + a * 0.24, PY + b * 0.24, TZ + 0.08));
    add(cylZ(0.27, 0.27, 0.3, 48), M.castAlu, intake, PX, PY, TZ + 0.21);
    add(cylZ(0.22, 0.22, 0.305, 48), M.port, intake, PX, PY, TZ + 0.21);
    const bell = [v2(0.22, 0), v2(0.27, 0), v2(0.29, 0.06), v2(0.32, 0.13), v2(0.37, 0.18), v2(0.34, 0.19), v2(0.27, 0.14), v2(0.23, 0.06)];
    const bm = add(new THREE.LatheGeometry(bell, 64).rotateX(Math.PI / 2), M.aluPol.clone(), intake, PX, PY, TZ + 0.36);
    bm.material.side = THREE.DoubleSide;
    add(extrude(circ(0, 0, 0.3, 64), [circ(0, 0, 0.272, 64)], 0.03, 0), M.accent, intake, PX, PY, TZ + 0.34);
    throttlePlate = add(cylZ(0.215, 0.215, 0.008, 40), M.aluPol, intake, PX, PY, TZ + 0.26);
    const cam = add(cylY(0.13, 0.13, 0.03, 32), M.aluPol, intake, PX + 0.29, PY, TZ + 0.21);
    cam.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(0.04, 0.05, 0.16), M.steel, intake, PX + 0.31, PY + 0.1, TZ + 0.21);
    add(new RoundedBoxGeometry(0.1, 0.16, 0.14, 2, 0.02), M.black, intake, PX - 0.32, PY, TZ + 0.21);
    add(new THREE.BoxGeometry(0.05, 0.06, 0.08), M.aluDark, intake, PX - 0.38, PY + 0.06, TZ + 0.21);

    // six runners: plenum -> silicone coupler -> injector boss -> shared lower flange per rotor
    const sp = epiOff(RUN_T, OUT), sn = epiN(RUN_T);
    const P = toWorld(sp), N = v3(-sn.y, sn.x, 0), T = v3(-N.y, N.x, 0);
    const curve = new THREE.CatmullRomCurve3([v3(2.08, 1.66, 0), v3(1.8, 1.42, 0), P.clone().addScaledVector(N, 0.38), P.clone().addScaledVector(N, 0.07)], false, 'centripetal');
    const tube = new THREE.TubeGeometry(curve, 56, 0.095, 18);
    const sleeve = cylZ(0.12, 0.12, 0.2, 24), clamp = new THREE.TorusGeometry(0.122, 0.012, 8, 28);
    const boss = cylZ(0.13, 0.115, 0.1, 24), bead = new THREE.TorusGeometry(0.1, 0.012, 6, 24);
    const cP = curve.getPointAt(0.46), cT = curve.getTangentAt(0.46);
    const bP = curve.getPointAt(0.04), bT = curve.getTangentAt(0.04);
    const eP = curve.getPointAt(0.97), eT = curve.getTangentAt(0.97);
    const flangeGeo = new RoundedBoxGeometry(0.07, 0.36, 0.74, 2, 0.025);
    const gasketGeo = new THREE.BoxGeometry(0.012, 0.37, 0.76);
    const injBody = cylY(0.03, 0.026, 0.1, 14), injCap = new RoundedBoxGeometry(0.07, 0.05, 0.06, 1, 0.012), injRing = new THREE.TorusGeometry(0.032, 0.008, 6, 16).rotateX(Math.PI / 2);
    const rot = Math.atan2(N.y, N.x);
    rotorZ.forEach(zr => {
      [-0.2, 0.2].forEach(dz => {
        const z = zr + dz, o = v3(0, 0, z);
        add(tube, M.aluPol, intake, 0, 0, z);
        ringAt(intake, boss, M.castAlu, bP.clone().add(o), bT);
        // silicone coupler with two hose clamps
        ringAt(intake, sleeve, M.silicone, cP.clone().add(o), cT);
        [-0.07, 0.07].forEach(d => ringAt(intake, clamp, M.steel, cP.clone().add(o).addScaledVector(cT, d), cT));
        ringAt(intake, bead, M.aluPol, eP.clone().add(o), eT);
        // injector
        add(injBody, M.black, intake, 1.74, 1.56, z);
        add(injRing, M.accent, intake, 1.74, 1.515, z);
        add(injCap, M.aluDark, intake, 1.7, 1.6, z);
      });
      // shared lower flange + gasket + four bolts
      const fp = P.clone().addScaledVector(N, 0.045).setZ(zr);
      add(flangeGeo, M.castAlu, intake, fp.x, fp.y, zr).rotation.z = rot;
      add(gasketGeo, M.gasket, intake, P.x + N.x * 0.006, P.y + N.y * 0.006, zr).rotation.z = rot;
      [[-0.13, -0.3], [0.13, -0.3], [-0.13, 0.3], [0.13, 0.3]].forEach(([a, b]) => {
        const q = P.clone().addScaledVector(N, 0.08).addScaledVector(T, a).setZ(zr + b);
        fastener(intake, q, N, false);
      });
    });
    // fuel rail with brackets, AN fittings, pressure regulator, gauge and braided lines
    add(new RoundedBoxGeometry(0.09, 0.09, 4.0, 2, 0.02), M.anodRed, intake, 1.72, 1.66, 0);
    [-1.5, 0, 1.5].forEach(z => add(new THREE.BoxGeometry(0.2, 0.025, 0.06), M.steel, intake, 1.82, 1.7, z));
    add(cylZ(0.05, 0.05, 0.07, 6), M.anodBlue, intake, 1.72, 1.66, 2.04);
    add(cylZ(0.038, 0.038, 0.08, 12), M.anodRed, intake, 1.72, 1.66, 2.11);
    add(cylZ(0.065, 0.065, 0.16, 20), M.aluPol, intake, 1.72, 1.66, -2.08);
    add(cylZ(0.05, 0.05, 0.06, 6), M.anodBlue, intake, 1.72, 1.66, -2.19);
    // Mini fuel pressure gauge on the regulator
    add(cylY(0.06, 0.06, 0.04, 24), M.steel, intake, 1.72, 1.76, -2.08);
    add(cylY(0.05, 0.05, 0.044, 24), M.ceramic, intake, 1.72, 1.762, -2.08);
    const feed = new THREE.CatmullRomCurve3([v3(1.72, 1.66, 2.15), v3(1.72, 1.7, 2.45), v3(1.6, 1.45, 2.7), v3(1.45, 1.1, 2.75)]);
    add(new THREE.TubeGeometry(feed, 28, 0.028, 10), M.braided, intake);
    const ret = new THREE.CatmullRomCurve3([v3(1.72, 1.66, -2.22), v3(1.72, 1.68, -2.48), v3(1.56, 1.4, -2.65), v3(1.4, 1.05, -2.68)]);
    add(new THREE.TubeGeometry(ret, 24, 0.024, 10), M.braided, intake);
  }

  // ---- exhaust header (3-into-1, flanged, with probes, flex section and V-band outlet)
  const exhaust = new THREE.Group();
  anc.add(exhaust);
  const exhaustMeshes = [];
  {
    const ep = epiOff(EXH_T, OUT + 0.115), en = epiN(EXH_T);
    const P = toWorld(ep), N = v3(-en.y, en.x, 0), T = v3(-N.y, N.x, 0);
    const C = v3(2.1, -1.12, REAR - 0.6);
    const rot = Math.atan2(N.y, N.x);
    const fl = new RoundedBoxGeometry(0.07, 0.38, 0.46, 2, 0.02);
    const gk = new THREE.BoxGeometry(0.01, 0.4, 0.48);
    const bead = new THREE.TorusGeometry(0.12, 0.014, 6, 28);
    const probe = cylY(0.012, 0.012, 0.2, 8), probeNut = cylY(0.026, 0.026, 0.03, 6);
    rotorZ.forEach((z, k) => {
      const P0 = P.clone().setZ(z).addScaledVector(N, 0.04);
      const P1 = P0.clone().addScaledVector(N, 0.42);
      const P2 = v3(1.95 + 0.05 * k, -0.82 - 0.1 * k, lerp(z, C.z, 0.55));
      const curve = new THREE.CatmullRomCurve3([P0, P1, P2, C], false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, 72, 0.115, 20);
      heatTint(geo);
      exhaustMeshes.push(add(geo, M.exhaustTint, exhaust));
      // port flange, copper gasket, four studs with nuts
      add(fl, M.exhaust, exhaust, P.x + N.x * 0.045, P.y + N.y * 0.045, z).rotation.z = rot;
      add(gk, M.gasket, exhaust, P.x + N.x * 0.005, P.y + N.y * 0.005, z).rotation.z = rot;
      [[-0.13, -0.17], [0.13, -0.17], [-0.13, 0.17], [0.13, 0.17]].forEach(([a, b]) => {
        fastener(exhaust, P.clone().addScaledVector(N, 0.08).addScaledVector(T, a).setZ(z + b), N, true);
      });
      // weld beads at the flange and near the merge
      ringAt(exhaust, bead, M.exhaust, curve.getPointAt(0.02), curve.getTangentAt(0.02));
      ringAt(exhaust, bead, M.exhaust, curve.getPointAt(0.93), curve.getTangentAt(0.93));
      // EGT probe on each primary
      const q = curve.getPointAt(0.12), qt = curve.getTangentAt(0.12);
      const up = v3(0, 1, 0).sub(qt.clone().multiplyScalar(qt.y)).normalize();
      alignTo(add(probe, M.steel, exhaust, q.x + up.x * 0.17, q.y + up.y * 0.17, q.z), up);
      alignTo(add(probeNut, M.bolt, exhaust, q.x + up.x * 0.12, q.y + up.y * 0.12, q.z), up);
    });
    // merge collector with beads and a merge spike, then O2 sensor, flex section, pipe and V-band
    exhaustMeshes.push(add(cylZ(0.26, 0.15, 0.5, 40), M.exhaust, exhaust, C.x, C.y, C.z - 0.18));
    add(new THREE.TorusGeometry(0.255, 0.016, 6, 40), M.exhaust, exhaust, C.x, C.y, C.z + 0.06);
    add(new THREE.TorusGeometry(0.152, 0.014, 6, 32), M.exhaust, exhaust, C.x, C.y, C.z - 0.43);
    const bung = add(cylY(0.05, 0.05, 0.08, 16), M.steel, exhaust, C.x, C.y + 0.22, C.z - 0.25);
    bung.rotation.x = -0.3;
    add(cylY(0.045, 0.045, 0.05, 6), M.bolt, exhaust, C.x, C.y + 0.29, C.z - 0.27);
    add(cylY(0.03, 0.03, 0.14, 12), M.steel, exhaust, C.x, C.y + 0.38, C.z - 0.3);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(C.x, C.y + 0.45, C.z - 0.3), v3(C.x - 0.1, C.y + 0.62, C.z - 0.1), v3(C.x - 0.35, C.y + 0.7, C.z + 0.4)]), 20, 0.014, 6), M.rubber, exhaust);
    const bellows = [];
    for (let i = 0; i <= 24; i++) bellows.push(v2(0.165 + 0.014 * Math.sin(i * Math.PI * 0.95), (i / 24) * 0.5));
    bellows.push(v2(0.14, 0.5), v2(0.14, 0));
    const flex = add(new THREE.LatheGeometry(bellows, 40).rotateX(-Math.PI / 2), M.steel.clone(), exhaust, C.x, C.y, C.z - 0.45);
    flex.material.side = THREE.DoubleSide;
    exhaustMeshes.push(add(cylZ(0.15, 0.15, 0.62, 32), M.exhaust, exhaust, C.x, C.y, C.z - 1.26));
    [-1.57, -1.61].forEach(dz => add(new THREE.TorusGeometry(0.168, 0.02, 6, 32), M.steel, exhaust, C.x, C.y, C.z + dz));
    add(new RoundedBoxGeometry(0.1, 0.06, 0.08, 1, 0.015), M.steel, exhaust, C.x + 0.18, C.y, C.z - 1.59);
    add(cylZ(0.15, 0.15, 0.25, 32), M.exhaust, exhaust, C.x, C.y, C.z - 1.74);
    add(new THREE.BoxGeometry(0.03, 0.35, 0.05), M.bolt, exhaust, C.x, C.y + 0.3, C.z - 1.1);
  }

  // ---- alternator and drive belt (front accessory drive)
  const acc = new THREE.Group();
  anc.add(acc);
  {
    const AX = -1.36, AY = 1.26, BZ = FRONT + 0.47;
    const body = cylZ(0.36, 0.36, 0.62, 40);
    add(body, M.castAlu, acc, AX, AY, BZ - 0.62);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      add(new THREE.BoxGeometry(0.05, 0.05, 0.5), M.castAlu, acc, AX + Math.cos(a) * 0.37, AY + Math.sin(a) * 0.37, BZ - 0.62);
    }
    add(cylZ(0.3, 0.3, 0.06, 40), M.aluDark, acc, AX, AY, BZ - 0.28);
    add(cylZ(0.1, 0.1, 0.12, 6), M.bolt, acc, AX, AY, BZ - 0.95);
    add(new RoundedBoxGeometry(0.3, 0.12, 0.3, 2, 0.03), M.aluDark, acc, AX + 0.3, AY - 0.3, BZ - 0.75);
    const altPulley = new THREE.Group();
    altPulley.position.set(AX, AY, BZ);
    acc.add(altPulley);
    add(cylZ(0.22, 0.22, 0.24, 36), M.steel, altPulley);
    add(cylZ(0.06, 0.06, 0.28, 6), M.bolt, altPulley);
    // belt: band hugging both pulleys
    const loopPts = (r0, r1) => {
      const pts = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * TAU;
        pts.push(v2(r0 * Math.cos(a), r0 * Math.sin(a)), v2(AX + r1 * Math.cos(a), AY + r1 * Math.sin(a)));
      }
      return hull(pts);
    };
    const inner = loopPts(0.77, 0.24), outer = loopPts(0.81, 0.28);
    add(extrude(outer, [inner], 0.2, 0), M.rubber, acc, 0, 0, BZ);
    acc.userData.pulley = altPulley;
    // bracket down to the front cover
    add(new THREE.BoxGeometry(0.12, 0.7, 0.08), M.aluDark, acc, AX + 0.18, AY - 0.42, FRONT - 0.15).rotation.z = 0.5;
  }

  // ---- sump
  const pan = new THREE.Group();
  anc.add(pan);
  add(new RoundedBoxGeometry(1.7, 0.56, 4.5, 4, 0.08), M.black, pan, 0, -1.82, 0);
  add(new RoundedBoxGeometry(1.84, 0.05, 4.62, 2, 0.02), M.black, pan, 0, -1.565, 0);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.5, 0.06, 0.05), M.black, pan, 0, -2.12, -1.8 + i * 0.72);
  add(cylY(0.07, 0.07, 0.05, 6), M.bolt, pan, 0.4, -2.12, -1.9);

  // ---- combustion chamber overlay on rotor housing 1 (front face)
  const NCH = 40;
  const chamberGroup = new THREE.Group();
  chamberGroup.position.z = W / 2 + 0.004;
  chamberGroup.userData.noClone = true;
  stack[2].group.add(chamberGroup);
  const idx = [];
  for (let j = 0; j < NCH - 1; j++) idx.push(j, NCH + j, j + 1, j + 1, NCH + j, NCH + j + 1);
  const chambers = [0, 1, 2].map(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NCH * 2 * 3), 3));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(g, mat);
    m.userData.custom = true;
    m.frustumCulled = false;
    chamberGroup.add(m);
    return m;
  });

  return {
    root, core, anc, stack, rotors, shaft, gears, boltGroup, bolts, pulley, fly, plugGroup, plugs,
    intake, exhaust, exhaustMeshes, throttlePlate, acc, pan, chambers, chamberGroup, FRONT, REAR, total, NCH,
  };
}

// Update the three combustion-chamber crescents of rotor 1 for shaft angle phi.
// Returns, per chamber, a continuous phase position 0..4 (intake, compression,
// combustion, exhaust) and the chamber centroid in housing-local coordinates.
export function updateChambers(eng, phi) {
  const p0 = phi + LOBE[0], psi = p0 / 3;
  const cx = E * Math.cos(p0), cy = E * Math.sin(p0);
  const c = Math.cos(psi), s = Math.sin(psi);
  const N = eng.NCH, out = [];
  eng.chambers.forEach((mesh, i) => {
    const attr = mesh.geometry.attributes.position, pos = attr.array;
    const a0 = (i * TAU) / 3;
    for (let j = 0; j < N; j++) {
      const f = j / (N - 1);
      const t = psi + a0 + (f * TAU) / 3;
      pos[j * 3] = R * Math.cos(t) + E * Math.cos(3 * t);
      pos[j * 3 + 1] = R * Math.sin(t) + E * Math.sin(3 * t);
      pos[j * 3 + 2] = 0;
      const a = a0 + (f * TAU) / 3, rr = rotorR(a) - CLR;
      const lx = rr * Math.cos(a), ly = rr * Math.sin(a);
      const k = (N + j) * 3;
      pos[k] = cx + lx * c - ly * s;
      pos[k + 1] = cy + lx * s + ly * c;
      pos[k + 2] = 0;
    }
    attr.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    const beta = psi + a0 + Math.PI / 3;
    const x = ((((beta + Math.PI / 2) % TAU) + TAU) % TAU) / (Math.PI / 2);
    const m = (N / 2) | 0;
    out.push({ x, cx: (pos[m * 3] + pos[(N + m) * 3]) / 2, cy: (pos[m * 3 + 1] + pos[(N + m) * 3 + 1]) / 2 });
  });
  return out;
}
