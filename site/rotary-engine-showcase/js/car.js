// Procedural FD3S RX-7 GT300 / Time-Attack racecar.
// Car-local frame: +Z forward, +Y up, front axle at z = 0, ground at y = 0, 1 unit = 100 mm.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  carbonFiberTextures,
  intercoolerTexture,
  radialMachinedTexture,
  tireSidewallTexture,
  windshieldBannerTexture,
  hoodDecalTexture,
  wingEndplateDecalTexture,
} from './textures.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const WHEELBASE = 24.25, TRACK = 7.55, WHEEL_R = 3.15;
const ARCH_R = 3.55;
const FLARE = 0.44;
const ARCH_X = 5.75;
const HOOD_Z0 = -5.9, HOOD_Z1 = 7.55, HOOD_U = 0.53;

export const PAINTS = [
  ['Signal Red', 0xa8101a],
  ['Rally Yellow', 0xe6aa08],
  ['Gunmetal', 0x363c46],
  ['Pearl White', 0xecece8],
];

// Sleek FD3S RX-7 body stations with low nose, sculpted front quarter panels & coke-bottle waist:
// [z, halfWidth, bottomY, shoulderY, centreTopY, fenderPeakY]
const BODY = [
  [10.0,  3.4,  1.85, 3.25, 3.38, 3.45],
  [9.55,  6.25, 1.48, 3.92, 4.02, 4.30],
  [8.2,   8.0,  1.22, 4.82, 4.78, 5.45],
  [6.0,   8.78, 1.20, 5.80, 5.45, 6.55],
  [3.0,   9.05, 1.22, 6.58, 6.02, 7.25],
  [0.0,   9.12, 1.24, 6.80, 6.36, 7.42],
  [-3.2,  8.88, 1.24, 6.55, 6.60, 7.12],
  [-6.0,  8.62, 1.22, 6.38, 6.82, 6.92],
  [-9.5,  8.58, 1.22, 6.50, 6.98, 7.12],
  [-13.5, 8.68, 1.22, 6.76, 7.15, 7.42],
  [-17.5, 8.90, 1.22, 7.08, 7.45, 7.95],
  [-21.2, 9.12, 1.28, 7.42, 7.82, 8.55],
  [-24.25,9.18, 1.38, 7.66, 8.08, 8.85],
  [-27.5, 8.96, 1.52, 7.76, 8.42, 8.92],
  [-30.5, 8.48, 1.92, 7.68, 8.58, 8.82],
  [-32.6, 7.92, 2.65, 7.42, 8.42, 8.42],
  [-33.4, 7.42, 3.05, 6.98, 7.95, 7.95],
];

// Low, sleek FD3S fastback greenhouse centerline & width stations:
// [z, beltHalfW, roofHalfW, roofCenterY]
const CABIN = [
  [-5.95, 7.30, 6.55, 6.92],
  [-7.4,  7.42, 6.18, 8.02],
  [-9.2,  7.52, 5.75, 9.25],
  [-11.0, 7.60, 5.40, 10.22],
  [-12.8, 7.66, 5.18, 10.76],
  [-14.8, 7.72, 5.12, 10.92],
  [-16.8, 7.78, 5.14, 10.88],
  [-18.8, 7.84, 5.24, 10.64],
  [-20.8, 7.88, 5.42, 10.22],
  [-23.0, 7.86, 5.66, 9.68],
  [-25.4, 7.78, 5.92, 9.12],
  [-27.8, 7.62, 6.12, 8.68],
  [-29.9, 7.38, 6.18, 8.38],
];

const cr = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

function sampler(table) {
  return z => {
    let i = 0;
    while (i < table.length - 2 && z < table[i + 1][0]) i++;
    const r0 = table[Math.max(0, i - 1)], r1 = table[i], r2 = table[i + 1], r3 = table[Math.min(table.length - 1, i + 2)];
    const t = clamp((r1[0] - z) / (r1[0] - r2[0]));
    const out = [];
    for (let c = 1; c < r1.length; c++) out.push(cr(r0[c], r1[c], r2[c], r3[c], t));
    return out;
  };
}
const bodyAt = sampler(BODY);
const cabinAt = sampler(CABIN);

function topY(u, row) {
  const [, , yS, yC, yF] = row;
  const a = Math.abs(u);
  const T = yC + (yF - yC) * Math.exp(-(((a - 0.74) / 0.21) ** 2));
  return yS + (T - yS) * Math.sqrt(Math.max(0, 1 - a ** 6));
}

const WAIST = 0.4;
const sideX = (hw, t) => hw * (t < WAIST ? 1 - 0.11 * ((WAIST - t) / WAIST) ** 2 : 1 - 0.075 * ((t - WAIST) / (1 - WAIST)) ** 1.6);
const NB = 6, NS = 40, NT = 120;

function bodyRing(z) {
  const row = bodyAt(z), [hw, yb, yS] = row, hwB = sideX(hw, 0), hwS = sideX(hw, 1), pts = [];
  for (let i = 0; i < NB; i++) pts.push({ x: (hwB * i) / NB, y: yb, k: 'b' });
  for (let i = 0; i < NS; i++) { const t = i / NS; pts.push({ x: sideX(hw, t), y: yb + (yS - yb) * t, k: 's', t }); }
  for (let i = 0; i <= NT; i++) { const u = Math.cos((i / NT) * Math.PI); pts.push({ x: u * hwS, y: topY(u, row), k: 't', u }); }
  for (let i = NS - 1; i >= 0; i--) { const t = i / NS; pts.push({ x: -sideX(hw, t), y: yb + (yS - yb) * t, k: 's', t }); }
  for (let i = NB - 1; i >= 1; i--) pts.push({ x: (-hwB * i) / NB, y: yb, k: 'b' });
  return pts;
}

const rrect = (x, z, cx, cz, hx, hz, r) => {
  const qx = Math.abs(x - cx) - hx + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
};
const POP = { cx: 6.1, cz: 6.5, hx: 1.32, hz: 0.9, r: 0.36 };
// Point on a rounded-rect outline (offset `off` outward) along polar angle `th` from its centre.
function rrBoundary(cx, cz, hx, hz, r, th, off = 0) {
  const dx = Math.cos(th), dz = Math.sin(th);
  let lo = 0, hi = Math.hypot(hx, hz) + Math.abs(off) + 1;
  for (let i = 0; i < 32; i++) {
    const m = (lo + hi) / 2;
    if (rrect(cx + dx * m, cz + dz * m, cx, cz, hx, hz, r) < off) lo = m; else hi = m;
  }
  return [cx + dx * lo, cz + dz * lo];
}
const DOOR_Z = [-5.95, -17.3];

// Smooth C2 greenhouse surface seated flush into the body top surface
function cabinPt(z, u, offset = 0) {
  const [wb, wt, yRraw] = cabinAt(z);
  const row = bodyAt(z);
  const hwS = sideX(row[0], 1);
  // Base height matches the actual body shoulder surface at x = wb so panels seat seamlessly!
  const yB = topY(clamp(wb / hwS, 0, 0.99), row) - 0.06;
  const yR = Math.max(yB + 0.06, yRraw);
  const H = yR - yB;
  const a = Math.abs(u), sgn = u < 0 ? -1 : 1;

  const xOut = sgn * (a <= 0.64
    ? (a / 0.64) * wt
    : lerp(wt, wb, (a - 0.64) / 0.36) + 0.1 * Math.sin(((a - 0.64) / 0.36) * Math.PI) * Math.min(1, H * 0.28));

  const roofFactor = ss(-11.4, -12.8, z) * (1 - ss(-18.4, -19.8, z));
  const bubble = 0.08 * roofFactor * Math.exp(-(((a - 0.35) / 0.16) ** 2));
  const dome = Math.pow(Math.max(0, 1 - Math.pow(a, 2.5)), 0.6);
  const yOut = yB + H * dome + bubble;

  if (offset === 0) return [xOut, yOut, z];
  const nx = sgn * Math.pow(a, 1.3) * 0.84;
  const ny = Math.max(0.28, dome);
  const nl = Math.hypot(nx, ny);
  return [xOut + (nx / nl) * offset, yOut + (ny / nl) * offset, z];
}

function patchGeometry(nu, nv, fn, flip = false) {
  const pos = [], uvs = [], idx = [];
  for (let iv = 0; iv <= nv; iv++) {
    const v = iv / nv;
    for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu;
      const [x, y, z] = fn(u, v);
      pos.push(x, y, z);
      uvs.push(u, v);
    }
  }
  const stride = nu + 1;
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = iv * stride + iu, b = a + 1, c = a + stride + 1, d = a + stride;
      if (flip) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function gridGeometry(positions, colors, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function extrude(outer, holes, depth, bevel = 0) {
  const shape = new THREE.Shape(outer);
  holes.forEach(h => shape.holes.push(new THREE.Path(h)));
  const core = Math.max(0.001, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core, curveSegments: 24,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2,
  });
  g.translate(0, 0, -core / 2);
  return g;
}

const v2 = (x, y) => new THREE.Vector2(x, y);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const arcPts = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => {
  const a = lerp(a0, a1, i / n);
  return v2(r * Math.cos(a), r * Math.sin(a));
});

export function buildCar() {
  const root = new THREE.Group();
  const M = o => new THREE.MeshStandardMaterial(o);

  const cf = carbonFiberTextures([14, 14]);
  const cfFine = carbonFiberTextures([8, 8]);
  const fmicTex = intercoolerTexture();
  const rotorTex = radialMachinedTexture(303, true);
  const tireTex = tireSidewallTexture();

  const paint = new THREE.MeshPhysicalMaterial({
    color: PAINTS[0][1], metalness: 0.48, roughness: 0.24,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.35,
    vertexColors: true, side: THREE.DoubleSide,
  });
  const paintSolid = new THREE.MeshPhysicalMaterial({
    color: PAINTS[0][1], metalness: 0.48, roughness: 0.24,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.35,
    side: THREE.DoubleSide,
  });
  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: cf.map, bumpMap: cf.bumpMap, bumpScale: 0.015,
    metalness: 0.25, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });
  const carbonFine = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: cfFine.map, bumpMap: cfFine.bumpMap, bumpScale: 0.012,
    metalness: 0.25, roughness: 0.26, clearcoat: 0.95, clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x070b10, metalness: 0.14, roughness: 0.03,
    clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 1.85,
    transparent: true, opacity: 0.78, side: THREE.DoubleSide,
  });
  const mirrorGlass = new THREE.MeshPhysicalMaterial({
    color: 0xe4eef8, metalness: 1.0, roughness: 0.02, clearcoat: 1.0, envMapIntensity: 2.0,
  });
  const trim = M({ color: 0x0b0c0f, metalness: 0.08, roughness: 0.52, side: THREE.DoubleSide });
  const dark = M({ color: 0x111316, metalness: 0.2, roughness: 0.75 });
  const bay = M({ color: 0x15171b, metalness: 0.35, roughness: 0.68, side: THREE.DoubleSide });
  const UNDER = 0.48;
  const hoodUnder = M({ color: new THREE.Color(PAINTS[0][1]).multiplyScalar(UNDER), metalness: 0.3, roughness: 0.58, side: THREE.BackSide });
  const rubber = M({ color: 0x16171a, metalness: 0, roughness: 0.88 });
  const tireSideMat = M({ color: 0xffffff, map: tireTex, metalness: 0, roughness: 0.85 });
  const rimBronze = M({ color: 0x9b825e, metalness: 0.92, roughness: 0.22 });
  const rimLip = M({ color: 0xd8dce2, metalness: 1.0, roughness: 0.12, side: THREE.DoubleSide });
  const rimDark = M({ color: 0x3b3f46, metalness: 0.9, roughness: 0.32, side: THREE.DoubleSide });
  const disc = M({ color: 0xc2c6cc, map: rotorTex, bumpMap: rotorTex, bumpScale: 0.02, metalness: 0.95, roughness: 0.32 });
  const caliper = M({ color: 0xd92616, metalness: 0.35, roughness: 0.32 });
  const anodRed = M({ color: 0xd41c24, metalness: 0.82, roughness: 0.22 });
  const anodBlue = M({ color: 0x1d5fd1, metalness: 0.8, roughness: 0.24 });
  const rollCageMat = M({ color: 0xff4b1a, metalness: 0.45, roughness: 0.3 });
  const seatMat = M({ color: 0x17181c, metalness: 0.05, roughness: 0.88 });
  const headLens = M({ color: 0xeef4ff, emissive: 0x000000, metalness: 0.1, roughness: 0.08 });
  const tailRing = M({ color: 0x6e0808, emissive: 0x550000, metalness: 0.1, roughness: 0.16 });
  const tailInner = M({ color: 0x3a0505, emissive: 0x1a0000, metalness: 0.1, roughness: 0.22 });
  const rainLightMat = M({ color: 0x990a0a, emissive: 0xcc1100, metalness: 0.1, roughness: 0.2 });
  const amber = M({ color: 0xd87c10, emissive: 0x381600, roughness: 0.24 });
  const steel = M({ color: 0xc8ccd2, metalness: 1.0, roughness: 0.18 });
  const goldFoil = M({ color: 0xd9a836, metalness: 0.92, roughness: 0.28 });
  const tiBlue = M({ color: 0x4b74d9, metalness: 1.0, roughness: 0.16 });
  const fmicMat = M({ color: 0xffffff, map: fmicTex, metalness: 0.82, roughness: 0.34 });
  const drlMat = M({ color: 0xeef5ff, emissive: 0x223344, metalness: 0.1, roughness: 0.1 });

  const decalMat = tex => new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, alphaTest: 0.04,
    roughness: 0.22, metalness: 0.08, clearcoat: 0.75, clearcoatRoughness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    side: THREE.FrontSide,
  });

  const add = (geo, mat, parent = root, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // =========================================================================
  // 1. BODY SHELL (sculpted FD3S front quarter panels, smooth wheel arches)
  // =========================================================================
  const zFront = 10.0, zRear = -33.4, NZ = 460;
  const zs = Array.from({ length: NZ + 1 }, (_, i) => lerp(zFront, zRear, i / NZ));
  const rings = zs.map(bodyRing), MR = rings[0].length;
  const pos = [], col = [], idx = [];
  rings.forEach((ring, r) => {
    const z = zs[r];
    ring.forEach(p => {
      let x = p.x, y = p.y, zOut = z, shade = 1;
      for (const wz of [0, -WHEELBASE]) {
        if (Math.abs(x) < ARCH_X) continue;
        const d = Math.hypot(z - wz, y - WHEEL_R);
        const f = 1 - ss(ARCH_R - 0.24, ARCH_R, d);
        if (f > 0) {
          x = Math.sign(x) * lerp(Math.abs(x), ARCH_X, f);
          shade = Math.min(shade, lerp(1, 0.04, f));
        } else if (p.k === 's' || Math.abs(p.u) > 0.88) {
          x += Math.sign(x) * FLARE * Math.exp(-(((d - ARCH_R - 0.52) / 0.62) ** 2));
        }
      }
      if (p.k === 't' && Math.abs(p.u) < 0.88 && z < -6.0 && z > -30.2) shade = 0.05;
      const ax = Math.abs(x);
      if (z > 7.9) {
        const mouth = (x / 4.6) ** 2 + ((y - 2.18) / 0.92) ** 2;
        const sideDuct = ((ax - 6.6) / 1.05) ** 2 + ((y - 2.15) / 0.5) ** 2;
        const mIn = 1 - ss(0.74, 1.0, mouth);
        const sIn = 1 - ss(0.72, 1.0, sideDuct);
        if (mIn > 0) { zOut -= mIn * 1.38; shade = Math.min(shade, lerp(1, 0.02, mIn)); }
        if (sIn > 0) { zOut -= sIn * 0.72; shade = Math.min(shade, lerp(1, 0.04, sIn)); }
        if (y < 1.5) shade = Math.min(shade, 0.08);
      }
      if (z < -32.2 && y < 2.8) shade = Math.min(shade, 0.08);
      // Recessed headlight bucket pocket in the front fenders (real 3D pop-up lids sit over these!)
      if (p.k === 't') {
        const d = rrect(ax, z, POP.cx, POP.cz, POP.hx, POP.hz, POP.r);
        // Depression stays fully hidden under the flush lid; only a crisp shut-line ribbon shows.
        const inPop = 1 - ss(-0.26, -0.1, d);
        if (inPop > 0) y -= inPop * 0.3;
        shade = Math.min(shade, lerp(1, 0.04, 1 - ss(-0.12, -0.03, d)));
      }
      if ((p.k === 's' || Math.abs(p.u) > 0.86) && y > 1.8) {
        for (const dz of DOOR_Z) shade = Math.min(shade, lerp(0.22, 1, ss(0.035, 0.13, Math.abs(z - dz))));
      }
      // Sculpted FD3S front quarter panel extractor vent pocket behind front wheel
      if (p.k === 's' && z < -3.8 && z > -5.75 && y > 2.05 && y < 5.35) {
        const gCenter = -4.78 + (y - 3.7) * 0.14;
        const gDist = Math.abs(z - gCenter);
        const gMask = (1 - ss(0.28, 0.52, gDist)) * ss(2.05, 2.55, y) * (1 - ss(4.85, 5.35, y));
        if (gMask > 0) {
          x -= Math.sign(x) * gMask * 0.34;
          shade = Math.min(shade, lerp(1, 0.05, gMask));
        }
      }
      pos.push(x, y, zOut);
      col.push(shade, shade, shade);
    });
  });
  const inHood = r => zs[r] <= HOOD_Z1 && zs[r] >= HOOD_Z0;
  const hoodPt = k => rings[0][k].k === 't' && Math.abs(rings[0][k].u) < HOOD_U;
  for (let r = 0; r < NZ; r++) {
    for (let k = 0; k < MR; k++) {
      const k1 = (k + 1) % MR;
      if (inHood(r) && inHood(r + 1) && hoodPt(k) && hoodPt(k1)) continue;
      const a = r * MR + k, b = (r + 1) * MR + k, c = (r + 1) * MR + k1, d = r * MR + k1;
      idx.push(a, b, c, a, c, d);
    }
  }
  for (const [r, flip] of [[0, true], [NZ, false]]) {
    let cx = 0, cy = 0;
    for (let k = 0; k < MR; k++) { cx += pos[(r * MR + k) * 3]; cy += pos[(r * MR + k) * 3 + 1]; }
    const ci = pos.length / 3;
    pos.push(cx / MR, cy / MR, zs[r] - (r === 0 ? 0.88 : 0));
    const cc = r === 0 ? 0.02 : 1;
    col.push(cc, cc, cc);
    for (let k = 0; k < MR; k++) {
      const a = r * MR + k, b = r * MR + ((k + 1) % MR);
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  add(gridGeometry(pos, col, idx), paint);

  // Front quarter panel aero strakes inside the FD side gill + flush amber side markers
  for (const s of [1, -1]) {
    const rowG = bodyAt(-4.78);
    const gx = s * (sideX(rowG[0], 0.45) - 0.14);
    for (const gy of [3.15, 3.85, 4.45]) {
      const strake = add(new RoundedBoxGeometry(0.32, 0.08, 0.82, 1, 0.02), carbonFine, root, gx, gy, -4.78 + (gy - 3.7) * 0.14);
      strake.rotation.y = -s * 0.12;
    }
    // Flush front quarter side marker ahead of front wheel
    const rowM = bodyAt(5.55);
    const mx = s * (sideX(rowM[0], 0.36) + 0.02);
    const marker = add(new RoundedBoxGeometry(0.08, 0.22, 0.68, 1, 0.03), amber, root, mx, 3.05, 5.55);
    marker.rotation.y = s * 0.16;
  }

  // =========================================================================
  // 2. REDESIGNED FD3S RACE HOOD (full-length to nose, thick double-skin with
  //    underside bracing ribs, recessed RE Amemiya center vent & 3-rotor decal)
  // =========================================================================
  const hood = new THREE.Group();
  const hingeZ = HOOD_Z0, hingeY = bodyAt(hingeZ)[3];
  hood.position.set(0, hingeY, hingeZ);
  root.add(hood);
  {
    const surfH = (x, z) => {
      const row = bodyAt(z), hwS = sideX(row[0], 1);
      // Slight sculpted center power-bulge & subtle front heat-extractor dip
      const base = topY(clamp(x / hwS, -0.98, 0.98), row) - hingeY;
      const ventDip = -0.06 * Math.exp(-((x / 2.2) ** 2)) * Math.exp(-(((z - 3.6) / 1.6) ** 2));
      return base + ventDip;
    };
    const hoodHalfW = z => sideX(bodyAt(z)[0], 1) * HOOD_U - 0.04;

    // Top painted skin + lower inner skin (real panel thickness so it looks solid when raised!)
    const NUH = 36, NVH = 44;
    const topGeo = patchGeometry(NUH, NVH, (u, v) => {
      const z = lerp(HOOD_Z1, HOOD_Z0, v);
      const x = lerp(-hoodHalfW(z), hoodHalfW(z), u);
      return [x, surfH(x, z) + 0.015, z - hingeZ];
    }, false);
    add(topGeo, paintSolid, hood);

    const botGeo = patchGeometry(NUH, NVH, (u, v) => {
      const z = lerp(HOOD_Z1, HOOD_Z0, v);
      const x = lerp(-hoodHalfW(z), hoodHalfW(z), u);
      return [x, surfH(x, z) - 0.09, z - hingeZ];
    }, true);
    add(botGeo, hoodUnder, hood).castShadow = false;

    // Perimeter thickness edge around all 4 sides of the hood (no paper-thin edges!)
    for (const s of [1, -1]) {
      const sideEdge = patchGeometry(2, NVH, (u, v) => {
        const z = lerp(HOOD_Z1, HOOD_Z0, v);
        const x = s * hoodHalfW(z);
        return [x, surfH(x, z) + lerp(-0.09, 0.015, u), z - hingeZ];
      }, s < 0);
      add(sideEdge, hoodUnder, hood).castShadow = false;
    }
    const frontEdge = patchGeometry(NUH, 2, (u, v) => {
      const x = lerp(-hoodHalfW(HOOD_Z1), hoodHalfW(HOOD_Z1), u);
      return [x, surfH(x, HOOD_Z1) + lerp(-0.09, 0.015, v), HOOD_Z1 - hingeZ];
    }, false);
    add(frontEdge, hoodUnder, hood).castShadow = false;

    // Underside structural X-brace ribs (visible when the hood is open in the showcase!)
    for (const [x0, z0, x1, z1] of [
      [-2.8, -5.2, 2.8, 6.2],
      [2.8, -5.2, -2.8, 6.2],
      [-3.4, -0.5, 3.4, -0.5],
      [-3.1, 3.8, 3.1, 3.8],
    ]) {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const t = i / 9;
        const rx = lerp(x0, x1, t), rz = lerp(z0, z1, t);
        return v3(rx, surfH(rx, rz) - 0.12, rz - hingeZ);
      });
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.065, 8), hoodUnder, hood).castShadow = false;
    }

    // Recessed carbon heat-extractor vent: dark ducted well, raised carbon surround, angled gill slats
    const V = { cx: 0, cz: 3.65, hx: 1.95, hz: 1.12, r: 0.42 };
    const vTaper = z => 1 - 0.1 * clamp((z - V.cz) / V.hz, -1, 1); // slightly narrower at the front
    const vPt = (th, off, lift) => {
      const [bx, bz] = rrBoundary(V.cx, V.cz, V.hx, V.hz, V.r, th, off);
      const x = bx * vTaper(bz);
      return [x, surfH(x, bz) + lift, bz - hingeZ];
    };
    // Dark well floor
    const well = patchGeometry(48, 6, (u, v) => {
      const [x, , z] = vPt(u * TAU, -0.06, 0);
      const c = [V.cx, V.cz - hingeZ];
      const px = lerp(c[0], x, v), pz = lerp(c[1], z, v);
      return [px, surfH(px, pz + hingeZ) + 0.022, pz];
    }, true);
    add(well, M({ color: 0x050607, metalness: 0.1, roughness: 0.9, side: THREE.DoubleSide }), hood).castShadow = false;
    // Carbon surround frame (inner lip raised, outer edge feathered into the paint)
    const frame = patchGeometry(64, 3, (u, v) => {
      const th = u * TAU;
      if (v < 0.34) return vPt(th, lerp(-0.08, -0.02, v / 0.34), lerp(0.02, 0.07, v / 0.34));
      if (v < 0.67) return vPt(th, lerp(-0.02, 0.14, (v - 0.34) / 0.33), 0.07);
      return vPt(th, lerp(0.14, 0.24, (v - 0.67) / 0.33), lerp(0.07, 0.028, (v - 0.67) / 0.33));
    }, true);
    add(frame, carbonFine, hood).castShadow = false;
    // 7 angled gill slats (front edge low, trailing edge high -> extract bay heat)
    for (let li = 0; li < 7; li++) {
      const lz = V.cz - V.hz + 0.3 + li * ((V.hz * 2 - 0.6) / 6);
      const half = rrBoundary(V.cx, V.cz, V.hx, V.hz, V.r, 0, -0.1)[0] * vTaper(lz);
      const edgeIn = Math.min(1, (V.hz - Math.abs(lz - V.cz)) / V.r);
      const w = 2 * half * (0.82 + 0.18 * edgeIn) - 0.1;
      const ly = surfH(0, lz);
      const lSlope = Math.atan2(surfH(0, lz - 0.25) - surfH(0, lz + 0.25), 0.5);
      const slat = add(new RoundedBoxGeometry(w, 0.035, 0.26, 1, 0.012), carbonFine, hood, 0, ly + 0.05, lz - hingeZ);
      slat.rotation.x = lSlope + 0.42;
    }

    // AeroCatch-style flush hood latches near the front corners
    for (const s of [1, -1]) {
      const pz = 6.35, px = s * 2.6;
      const pinSlope = Math.atan2(surfH(px, pz - 0.3) - surfH(px, pz + 0.3), 0.6);
      const latch = new THREE.Group();
      latch.position.set(px, surfH(px, pz) + 0.02, pz - hingeZ);
      latch.rotation.x = pinSlope;
      hood.add(latch);
      add(new RoundedBoxGeometry(0.34, 0.03, 0.66, 2, 0.014), dark, latch);
      add(new RoundedBoxGeometry(0.16, 0.035, 0.46, 2, 0.014), steel, latch, 0, 0.02, -0.03);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), anodRed, latch, 0, 0.035, 0.22);
    }

    // Nano Banana 3-Rotor TRIAD R3 Hood Decal (centered cleanly behind the radiator vent!)
    const hoodDecalGeo = patchGeometry(24, 24, (u, v) => {
      const x = lerp(-2.25, 2.25, u);
      const z = lerp(2.0, -4.7, v);
      return [x, surfH(x, z) + 0.035, z - hingeZ];
    }, false);
    add(hoodDecalGeo, decalMat(hoodDecalTexture()), hood).castShadow = false;
  }

  // =========================================================================
  // 3. LOW, SEAMLESS FD3S GREENHOUSE (ZERO PANEL MISALIGNMENT!)
  // =========================================================================
  const zWindBase = -5.98;
  const zFrontEdge = -11.6;
  const zRearEdge = -19.2;
  const zHatchEnd = -29.85;
  const uRoof = 0.64;
  const uPillarW = 0.06;
  const zFH = u => zFrontEdge - 0.45 * (1 - clamp((u / uRoof) ** 2));
  const zRH = u => zRearEdge + 0.35 * (1 - clamp((u / uRoof) ** 2));
  const uA = z => lerp(0.80, uRoof, Math.pow(clamp((zWindBase - z) / (zWindBase - zFrontEdge)), 0.85));
  const uHatch = z => lerp(uRoof, 0.78, Math.pow(clamp((zRearEdge - z) / (zRearEdge - zHatchEnd)), 1.1));
  const uSideTop = z => {
    if (z >= zFrontEdge) return uA(z) + uPillarW;
    if (z >= zRearEdge) return uRoof + uPillarW;
    return lerp(uRoof + uPillarW, 1.0, ss(zRearEdge, -23.8, z));
  };
  {
    // A. Wrap-Around Curved Windshield Glass
    const windGeo = patchGeometry(40, 28, (u, v) => {
      const uu = lerp(-1, 1, u);
      const z = lerp(zWindBase, zFH(uu * uRoof), v);
      return cabinPt(z, uu * uA(z), 0.004);
    }, false);
    add(windGeo, glass).castShadow = false;

    // Bottom black ceramic frit strip
    const fritBot = patchGeometry(32, 4, (u, v) => {
      const uu = lerp(-1, 1, u);
      const z = lerp(zWindBase, zWindBase - 0.42, v);
      return cabinPt(z, uu * uA(z), 0.016);
    }, false);
    add(fritBot, trim).castShadow = false;

    // Nano Banana Windshield Sunstrip Banner
    const bannerGeo = patchGeometry(36, 8, (u, v) => {
      const uu = lerp(-1, 1, u);
      const tV = lerp(0.76, 0.995, v);
      const z = lerp(zWindBase, zFH(uu * uRoof), tV);
      return cabinPt(z, uu * (uA(z) - 0.006), 0.022);
    }, false);
    add(bannerGeo, decalMat(windshieldBannerTexture())).castShadow = false;

    // Twin Windshield Wipers on cowl
    const [, cowlY] = cabinPt(zWindBase - 0.15, 0, 0.05);
    for (const wx of [-0.6, 2.75]) {
      const arm = add(new RoundedBoxGeometry(3.2, 0.055, 0.085, 1, 0.02), trim, root, wx, cowlY, zWindBase - 0.22);
      arm.rotation.y = 0.08;
      arm.rotation.z = -0.04;
    }

    // B. Low Double-Bubble Painted Roof Panel (exact match to zFH & zRH!)
    const roofGeo = patchGeometry(36, 24, (u, v) => {
      const uu = lerp(-uRoof, uRoof, u);
      return cabinPt(lerp(zFH(uu), zRH(uu), v), uu, 0.042);
    }, false);
    add(roofGeo, paintSolid);

    // Low-profile Carbon Roof Scoop
    const [, roofMidY] = cabinPt(-14.6, 0, 0.045);
    const scoop = new THREE.Group();
    scoop.position.set(0, roofMidY, -14.6);
    root.add(scoop);
    add(new RoundedBoxGeometry(1.35, 0.3, 1.95, 3, 0.1), carbonFine, scoop, 0, 0.04, 0);
    add(new RoundedBoxGeometry(1.02, 0.16, 0.12, 2, 0.04), dark, scoop, 0, 0.02, 0.94);

    // C. Seamless Painted A-Pillars, Roof Rails, Sweeping FD C-Pillars & Side Glass
    for (const s of [1, -1]) {
      const flip = s < 0;

      // A-Pillar: exact edge from zWindBase to zFrontEdge
      const aPillar = patchGeometry(8, 24, (u, v) => {
        const z = lerp(zWindBase, zFrontEdge, v);
        return cabinPt(z, s * lerp(uA(z) - 0.008, uA(z) + uPillarW, u), 0.042);
      }, flip);
      add(aPillar, paintSolid);

      // Roof Cant Rail: exact continuation from zFrontEdge to zRearEdge
      const rail = patchGeometry(8, 24, (u, v) => {
        const z = lerp(zFrontEdge, zRearEdge, v);
        return cabinPt(z, s * lerp(uRoof - 0.008, uRoof + uPillarW, u), 0.042);
      }, flip);
      add(rail, paintSolid);

      // Sweeping FD C-Pillar / Sail Panel: exact continuation from zRearEdge to zHatchEnd
      const cPillar = patchGeometry(12, 28, (u, v) => {
        const z = lerp(zRearEdge, zHatchEnd, v);
        const uIn = uHatch(z) - 0.008;
        const uOut = z > -23.8 ? uSideTop(z) : 1.0;
        return cabinPt(z, s * lerp(uIn, uOut, u), 0.042);
      }, flip);
      add(cPillar, paintSolid);

      // Flush Side Window Glass: exact boundary uSideTop(z) -> 1.0!
      const sideGlass = patchGeometry(10, 36, (u, v) => {
        const z = lerp(zWindBase - 0.12, -23.8, v);
        return cabinPt(z, s * lerp(uSideTop(z) - 0.008, 1.0, u), 0.004);
      }, flip);
      add(sideGlass, glass).castShadow = false;

      // Slim Matte-Black B-Pillar divider
      const bPillar = patchGeometry(6, 12, (u, v) => {
        const z = lerp(-17.0, -17.85, u);
        return cabinPt(z, s * lerp(uRoof + uPillarW - 0.005, 0.995, v), 0.024);
      }, flip);
      add(bPillar, trim);

      // Crisp Black Window Beltline Trim
      const beltTrim = patchGeometry(4, 32, (u, v) => {
        const z = lerp(zWindBase - 0.08, -24.0, v);
        return cabinPt(z, s * lerp(0.968, 1.005, u), 0.028);
      }, flip);
      add(beltTrim, trim).castShadow = false;
    }

    // D. Wrap-Around Fastback Rear Hatch Glass (exact match to zRH & uHatch!)
    const hatchGeo = patchGeometry(38, 32, (u, v) => {
      const uu = lerp(-1, 1, u);
      const z = lerp(zRH(uu * uRoof), zHatchEnd, v);
      return cabinPt(z, uu * uHatch(z), 0.004);
    }, false);
    add(hatchGeo, glass).castShadow = false;

    const hatchTrim = patchGeometry(32, 4, (u, v) => {
      const uu = lerp(-1, 1, u);
      const z = lerp(zHatchEnd + 0.34, zHatchEnd - 0.1, v);
      return cabinPt(z, uu * uHatch(z), 0.02);
    }, false);
    add(hatchTrim, trim).castShadow = false;
  }

  // =========================================================================
  // 4. SCULPTED AERODYNAMIC CARBON GT MIRRORS
  // =========================================================================
  for (const s of [1, -1]) {
    const mirror = new THREE.Group();
    const [mx, my, mz] = cabinPt(-7.65, s * 0.96, 0.04);
    mirror.position.set(mx, my + 0.06, mz);
    root.add(mirror);

    const base = add(new RoundedBoxGeometry(0.16, 0.38, 0.82, 2, 0.05), carbonFine, mirror);
    base.rotation.z = s * 0.32;

    const stalk1 = new THREE.CatmullRomCurve3([v3(0, -0.02, 0.12), v3(s * 0.35, 0.09, 0.02), v3(s * 0.68, 0.2, -0.14)]);
    const stalk2 = new THREE.CatmullRomCurve3([v3(0, 0.08, -0.18), v3(s * 0.34, 0.16, -0.22), v3(s * 0.66, 0.23, -0.22)]);
    add(new THREE.TubeGeometry(stalk1, 16, 0.068, 10), carbonFine, mirror);
    add(new THREE.TubeGeometry(stalk2, 16, 0.05, 10), carbonFine, mirror);

    const head = new THREE.Group();
    head.position.set(s * 0.98, 0.28, -0.18);
    head.rotation.y = -s * 0.14;
    head.rotation.z = s * 0.06;
    mirror.add(head);

    const podPts = [
      v2(0.01, 0.54), v2(0.18, 0.48), v2(0.35, 0.34), v2(0.47, 0.14),
      v2(0.49, -0.08), v2(0.44, -0.25), v2(0.37, -0.31), v2(0.01, -0.29),
    ];
    add(new THREE.LatheGeometry(podPts, 32).rotateX(Math.PI / 2).scale(1.08, 0.58, 0.88), carbonFine, head);
    const mg = add(new THREE.CircleGeometry(0.4, 32).scale(1.0, 0.5, 1), mirrorGlass, head, 0, 0, -0.27);
    mg.rotation.y = Math.PI;
    mg.castShadow = false;
  }

  // =========================================================================
  // 5. FRONT RACE AERO: TUCKED FMIC, CARBON SPLITTER WITH END-FENCES, CANARDS, TOW HOOK
  // =========================================================================
  const noseZ = (ax, y) => {
    for (let z = zFront; z > zFront - 4; z -= 0.02) {
      const row = bodyAt(z), t = (y - row[1]) / (row[2] - row[1]);
      if (t >= 0 && t <= 1 && sideX(row[0], t) >= ax) return z;
    }
    return zFront - 4;
  };
  {
    // Visible Front-Mount Intercooler tucked cleanly INSIDE the recessed mouth (zero bumper overlap!)
    add(new RoundedBoxGeometry(5.5, 1.12, 0.36, 2, 0.05), fmicMat, root, 0, 2.15, 8.82);
    for (const s of [1, -1]) {
      add(new RoundedBoxGeometry(0.55, 1.08, 0.4, 2, 0.1), steel, root, s * 2.98, 2.15, 8.72);
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.38, 16).rotateZ(Math.PI / 2), anodBlue, root, s * 3.35, 2.15, 8.58);
    }

    // Carbon Front Splitter extending cleanly under the chin with outer vertical end-fences
    const splitShape = new THREE.Shape([
      v2(-8.45, 4.8), v2(-8.65, 7.3), v2(-7.95, 9.0), v2(-5.5, 10.35),
      v2(0, 10.72), v2(5.5, 10.35), v2(7.95, 9.0), v2(8.65, 7.3), v2(8.45, 4.8),
    ]);
    const splitGeo = new THREE.ExtrudeGeometry(splitShape, {
      depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2,
    }).rotateX(Math.PI / 2);
    add(splitGeo, carbon, root, 0, 1.18, 0);

    // Exact side-duct bumper angle for horizontal duct blades
    const dZIn = noseZ(5.85, 2.15), dZOut = noseZ(7.15, 2.15);
    const dMidZ = (dZIn + dZOut) / 2;
    const dYaw = Math.atan2(dZIn - dZOut, 1.3);

    for (const s of [1, -1]) {
      // Vertical carbon splitter end-fences (GT300 aero detail)
      add(new RoundedBoxGeometry(0.1, 0.72, 2.6, 2, 0.025), carbonFine, root, s * 8.62, 1.52, 7.2);

      // Aluminum splitter tie-rods anchored cleanly from front splitter to lower bumper lip
      const rodA = v3(s * 2.35, 1.24, 10.24), rodB = v3(s * 2.35, 1.84, 9.58);
      const rodDir = v3().subVectors(rodB, rodA), rodLen = rodDir.length();
      const rod = add(new THREE.CylinderGeometry(0.035, 0.035, rodLen, 12), steel, root,
        (rodA.x + rodB.x) / 2, (rodA.y + rodB.y) / 2, (rodA.z + rodB.z) / 2);
      rod.quaternion.setFromUnitVectors(v3(0, 1, 0), rodDir.clone().normalize());
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), anodRed, root, rodA.x, rodA.y + 0.04, rodA.z);
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), anodRed, root, rodB.x, rodB.y - 0.04, rodB.z);

      // Horizontal aero splitter blade tucked cleanly inside each side oil-cooler duct
      const blade = add(new RoundedBoxGeometry(1.25, 0.055, 0.45, 1, 0.02), carbonFine, root, s * 6.5, 2.15, dMidZ - 0.32);
      blade.rotation.y = s * dYaw;

      // Dual carbon bumper canards
      for (const [cz, cy, w] of [[8.25, 2.12, 0.8], [7.2, 2.92, 0.68]]) {
        const row = bodyAt(cz);
        const cx = s * (sideX(row[0], (cy - row[1]) / (row[2] - row[1])) + 0.12);
        const canard = add(new RoundedBoxGeometry(w, 0.07, 1.35, 2, 0.02), carbonFine, root, cx, cy, cz);
        canard.rotation.y = s * 0.32;
        canard.rotation.x = 0.22;
        canard.rotation.z = s * 0.14;
      }

      // Carbon side skirts with rear bargeboards
      add(new RoundedBoxGeometry(0.85, 0.14, 16.8, 2, 0.04), carbon, root, s * 8.48, 1.22, -12.1);
      const wg = add(new RoundedBoxGeometry(0.1, 0.92, 1.32, 2, 0.03), carbonFine, root, s * 8.92, 1.64, -19.8);
      wg.rotation.z = -s * 0.1;
    }

    // Front anodized red tow ring emerging cleanly from the mouth opening
    const tow = add(new THREE.TorusGeometry(0.26, 0.06, 10, 24), anodRed, root, 2.4, 1.86, 9.52);
    tow.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.12, 0.07, 0.48), steel, root, 2.4, 1.86, 9.18);
  }

  // =========================================================================
  // 6. REDESIGNED RACE ENGINE BAY (Boxed Frame Rails, Camber-Plate Strut Towers,
  //    Gold-Foil Firewall, V-Mount Aluminum Radiator + Twin Fans, Slam Panel)
  // =========================================================================
  {
    const bayTopY = z => {
      const row = bodyAt(z);
      return Math.min(row[3], row[4]) - 0.36;
    };
    const bx = 4.35, bz0 = -5.85, bz1 = 7.25, byBot = 1.42;

    // Engine bay floor pan & subframe crossmember
    add(new THREE.PlaneGeometry(bx * 2, bz1 - bz0).rotateX(-Math.PI / 2), bay, root, 0, byBot, (bz0 + bz1) / 2).castShadow = false;
    add(new RoundedBoxGeometry(bx * 2 - 0.2, 0.36, 0.95, 2, 0.06), dark, root, 0, 1.72, 0.0);

    // Gold-foil heat-shielded firewall at rear of bay (z = -5.85)
    const fwH = bayTopY(bz0) - byBot;
    add(new THREE.PlaneGeometry(bx * 2, fwH), bay, root, 0, byBot + fwH / 2, bz0).castShadow = false;
    add(new THREE.PlaneGeometry(4.4, fwH - 0.7), goldFoil, root, 0, byBot + fwH / 2 - 0.1, bz0 + 0.04).castShadow = false;

    // Contoured inner fender aprons + boxed longitudinal chassis frame rails (strictly below hood!)
    for (const s of [1, -1]) {
      const wallGeo = patchGeometry(20, 2, (u, v) => {
        const z = lerp(bz0, bz1, u);
        const y = lerp(byBot, bayTopY(z), v);
        return [s * bx, y, z];
      }, s > 0);
      add(wallGeo, bay).castShadow = false;

      // Longitudinal chassis frame rail
      add(new RoundedBoxGeometry(0.55, 0.65, 12.4, 2, 0.06), dark, root, s * 3.78, 2.25, 0.6);

      // Sculpted strut tower + anodized red camber plate + 4 bolts + central coilover knob
      const stY = 4.65;
      add(new THREE.CylinderGeometry(0.72, 0.92, 2.2, 24), dark, root, s * 3.82, stY - 1.1, 0.15);
      add(new THREE.CylinderGeometry(0.68, 0.68, 0.1, 24), anodRed, root, s * 3.82, stY + 0.02, 0.15);
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 16), steel, root, s * 3.82, stY + 0.1, 0.15);
      for (let bi = 0; bi < 4; bi++) {
        const ba = (bi * TAU) / 4 + Math.PI / 4;
        add(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 6), steel, root, s * 3.82 + Math.cos(ba) * 0.44, stY + 0.08, 0.15 + Math.sin(ba) * 0.44);
      }

      // Rear-hinged hood strut arms tucked along bay sides
      add(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8).rotateX(Math.PI / 2), steel, root, s * 4.18, 5.1, -3.9);
    }

    // Triangulated carbon/billet rear firewall strut bar (cleanly behind the 3-rotor engine!)
    add(new THREE.CylinderGeometry(0.08, 0.08, 7.5, 16).rotateZ(Math.PI / 2), carbonFine, root, 0, 5.38, -5.25);

    // V-Mount Aluminum Race Radiator (strictly below hood & hood scoop clearance!)
    const radGroup = new THREE.Group();
    radGroup.position.set(0, 2.9, 5.25);
    radGroup.rotation.x = -0.72;
    root.add(radGroup);
    add(new RoundedBoxGeometry(6.8, 2.55, 0.34, 2, 0.06), fmicMat, radGroup);
    for (const s of [1, -1]) add(new RoundedBoxGeometry(0.42, 2.6, 0.4, 2, 0.08), steel, radGroup, s * 3.55, 0, 0);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), anodRed, radGroup, 3.45, 1.36, 0);
    for (const s of [1, -1]) {
      add(new THREE.TorusGeometry(0.9, 0.075, 10, 28), dark, radGroup, s * 1.55, 0, -0.22);
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 16).rotateX(Math.PI / 2), dark, radGroup, s * 1.55, 0, -0.22);
      for (let fi = 0; fi < 5; fi++) {
        const blade = add(new THREE.BoxGeometry(0.76, 0.16, 0.04), dark, radGroup, s * 1.55, 0, -0.22);
        blade.rotation.z = (fi * TAU) / 5;
      }
    }
    const pipeCurve = new THREE.CatmullRomCurve3([v3(2.95, 3.65, 4.35), v3(2.65, 3.98, 2.6), v3(1.05, 4.22, 1.3), v3(0.35, 4.35, 0.45)]);
    add(new THREE.TubeGeometry(pipeCurve, 24, 0.12, 12), steel, root);
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 14).rotateX(Math.PI / 2), anodBlue, root, 2.9, 3.74, 4.05);

    // Carbon Front Core Support / Slam Panel (tucked cleanly below hood leading edge)
    const slamY = bayTopY(bz1);
    add(new RoundedBoxGeometry(bx * 2 + 0.15, 0.14, 0.85, 2, 0.04), carbonFine, root, 0, slamY - 0.1, bz1 - 0.35);
    add(new THREE.PlaneGeometry(bx * 2, slamY - byBot), bay, root, 0, byBot + (slamY - byBot) / 2, bz1).castShadow = false;

    // Dual Brake / Clutch Master Cylinder + Reservoirs & Carbon Cold-Air Box on firewall
    add(new THREE.CylinderGeometry(0.72, 0.72, 0.5, 28).rotateX(Math.PI / 2), dark, root, 3.35, 4.55, -5.52);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 16).rotateX(Math.PI / 2), steel, root, 3.35, 4.55, -4.95);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16), headLens, root, 3.35, 4.92, -4.95);
    add(new RoundedBoxGeometry(1.4, 0.92, 1.25, 2, 0.1), carbonFine, root, -3.55, 4.0, -4.65);
  }

  // =========================================================================
  // 7. EXACT SLOPE-MATCHED TWIN-PROJECTOR POP-UP HEADLIGHTS + 99-SPEC BUMPER LAMPS
  // =========================================================================
  const surfY = (x, z) => { const row = bodyAt(z), hwS = sideX(row[0], 1); return topY(clamp(x / hwS, -0.98, 0.98), row); };
  const popups = [1, -1].map(s => {
    const z0 = POP.cz - POP.hz, L = POP.hz * 2;
    const pivot = new THREE.Group();
    const pivY = surfY(s * POP.cx, z0);
    const frontY = surfY(s * POP.cx, z0 + L) - pivY; // fender falls away toward the nose
    const stowedSlope = Math.atan2(frontY, L);
    // FD-style: lid swings up until it sits slightly nose-up (~8°), lamp face vertical.
    const POP_A = 0.14 - stowedSlope;
    const cA = Math.cos(POP_A), sA = Math.sin(POP_A);
    pivot.position.set(s * POP.cx, pivY, z0);
    root.add(pivot);

    // Local frames: "closed" = pivot-local; "open" = world-aligned frame after pivot rotates by -POP_A.
    const toClosed = (yo, zo) => [yo * cA - zo * sA, yo * sA + zo * cA];
    const zOpen = (y, z) => -y * sA + z * cA;
    const lidY = (lx, lz) => surfY(s * POP.cx + lx, z0 + lz) - pivY;
    const LID_LIFT = 0.014, LID_T = 0.075;

    // Rounded-rect painted lid following the fender crown exactly (flush when closed)
    const lidPt = (th, f, lift) => {
      const [bx, bz] = rrBoundary(0, L / 2, POP.hx, POP.hz, POP.r, th, -0.005);
      const lx = bx * f, lz = L / 2 + (bz - L / 2) * f;
      return [lx, lidY(lx, lz) + lift, lz];
    };
    add(patchGeometry(56, 8, (u, v) => lidPt(u * TAU, v, LID_LIFT), false), paintSolid, pivot);
    // Lid edge return + dark underside so the open lid reads as a solid pressed panel
    add(patchGeometry(56, 2, (u, v) => lidPt(u * TAU, 1, lerp(LID_LIFT, LID_LIFT - LID_T, v)), true), paintSolid, pivot).castShadow = false;
    add(patchGeometry(56, 6, (u, v) => lidPt(u * TAU, v * 0.98, LID_LIFT - LID_T), true), trim, pivot).castShadow = false;

    // Lamp housing: solid satin-black block that lives under the lid, front face vertical when open
    const pod = new THREE.Group();
    pod.visible = false;
    pivot.add(pod);
    const w = POP.hx - 0.14, zf = L - 0.1, zr = 0.18, yBot = -1.3, podTop = LID_LIFT - LID_T - 0.012;
    const topAt = (lx, zo) => { // closed-frame point on the lid underside whose open-frame z equals zo
      let lo = -1, hi = L + 1;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (zOpen(lidY(lx, m) + podTop, m) < zo) lo = m; else hi = m;
      }
      return [lx, lidY(lx, lo) + podTop, lo];
    };
    const openY = p => p[1] * cA + p[2] * sA;
    const atOpen = (lx, yo, zo) => { const [y, z] = toClosed(yo, zo); return [lx, y, z]; };
    const hb = M({ color: 0x0c0d10, metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide });
    add(patchGeometry(12, 12, (u, v) => topAt(lerp(-w, w, u), lerp(zf, zr, v)), false), hb, pod);
    for (const [zo, flip] of [[zf, true], [zr, false]]) {
      add(patchGeometry(12, 4, (u, v) => {
        const lx = lerp(-w, w, u);
        return atOpen(lx, lerp(openY(topAt(lx, zo)), yBot, v), zo);
      }, flip), hb, pod);
    }
    for (const sx of [1, -1]) {
      add(patchGeometry(12, 4, (u, v) => {
        const zo = lerp(zf, zr, u);
        return atOpen(sx * w, lerp(openY(topAt(sx * w, zo)), yBot, v), zo);
      }, sx > 0), hb, pod);
    }

    // Lamp face (world-vertical when raised): chrome reflector bowls, projector lenses, DRL rings.
    // The fender is crowned, so size each lamp from the lid/fender heights at its own x position.
    const lampX = w * 0.5;
    const yTopF = Math.min(...[-1, 1].flatMap(k => [k * (lampX - 0.3), k * lampX, k * (lampX + 0.3)]).map(lx => openY(topAt(lx, zf))));
    const ySurfF = Math.max(lidY(lampX, zf), lidY(-lampX, zf)) - LID_LIFT;
    const faceH = yTopF - ySurfF;
    const face = new THREE.Group();
    const lampR = clamp(faceH * 0.36, 0.2, 0.33);
    const lampY = yTopF - 0.05 - lampR;
    const [fy, fz] = toClosed(lampY, zf + 0.004);
    face.position.set(0, fy, fz);
    face.rotation.x = POP_A;
    pod.add(face);
    for (const px of [-lampX, lampX]) {
      add(new THREE.CylinderGeometry(lampR + 0.05, lampR + 0.07, 0.06, 32).rotateX(Math.PI / 2), dark, face, px, 0, 0.03);
      const bowl = add(new THREE.SphereGeometry(lampR, 28, 12, 0, TAU, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1, 0.5), steel, face, px, 0, 0.07);
      bowl.material = M({ color: 0xdfe4ea, metalness: 1, roughness: 0.08, side: THREE.BackSide });
      add(new THREE.SphereGeometry(lampR * 0.55, 20, 14).scale(1, 1, 0.6), headLens, face, px, 0, 0.06);
      add(new THREE.TorusGeometry(lampR + 0.015, 0.022, 8, 32), drlMat, face, px, 0, 0.075);
    }
    return { pivot, pod, POP_A };
  });
  const setPopups = t => popups.forEach(({ pivot, pod, POP_A }) => {
    pivot.rotation.x = -POP_A * t;
    pod.visible = t > 0.02;
  });

  // Crisp dark shut-line ribbons around each closed headlight lid (fixed to the body)
  for (const s of [1, -1]) {
    const ribbon = patchGeometry(64, 1, (u, v) => {
      const [bx, bz] = rrBoundary(POP.cx, POP.cz, POP.hx, POP.hz, POP.r, u * TAU, lerp(-0.035, 0.03, v));
      return [s * bx, surfY(s * bx, bz) + 0.006, bz];
    }, s < 0);
    add(ribbon, M({ color: 0x050506, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide }), root).castShadow = false;
  }
  // 99-Spec FD3S Bumper Combination Lamps matched to EXACT bumper curvature & yaw (zero overlap!)
  {
    const cZIn = noseZ(5.55, 3.22), cZOut = noseZ(6.95, 3.22);
    const cMidZ = (cZIn + cZOut) / 2;
    const cYaw = Math.atan2(cZIn - cZOut, 1.4);
    for (const s of [1, -1]) {
      const combo = new THREE.Group();
      combo.position.set(s * 6.25, 3.22, cMidZ + 0.02);
      combo.rotation.y = s * cYaw;
      combo.rotation.x = -0.1;
      root.add(combo);
      add(new RoundedBoxGeometry(1.48, 0.36, 0.14, 2, 0.05), trim, combo);
      add(new RoundedBoxGeometry(0.62, 0.22, 0.08, 1, 0.03), amber, combo, s * 0.36, 0, 0.055);
      add(new RoundedBoxGeometry(0.6, 0.2, 0.08, 1, 0.03), drlMat, combo, -s * 0.36, 0, 0.055);
    }
  }

  // =========================================================================
  // 8. 99-SPEC FD TAIL LIGHTS, CARBON DIFFUSER, HIGH-MOUNT GT WING, TITANIUM EXHAUST
  // =========================================================================
  {
    add(new RoundedBoxGeometry(13.8, 1.35, 0.18, 2, 0.06), trim, root, 0, 7.0, -33.42);
    for (const s of [1, -1]) {
      for (const [x, isInner] of [[2.55, true], [4.0, false], [5.45, false]]) {
        add(new THREE.TorusGeometry(0.42, 0.075, 12, 32), tailRing, root, s * x, 7.0, -33.54);
        add(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24).rotateX(Math.PI / 2), isInner ? amber : tailInner, root, s * x, 7.0, -33.51);
      }
    }

    const diff = add(new RoundedBoxGeometry(12.2, 0.2, 2.6, 2, 0.04), carbon, root, 0, 1.72, -32.6);
    diff.rotation.x = -0.14;
    for (const fx of [-4.4, -1.6, 1.6, 4.4]) {
      const fin = add(new RoundedBoxGeometry(0.12, 1.2, 2.25, 2, 0.03), carbonFine, root, fx, 2.12, -32.72);
      fin.rotation.x = -0.1;
    }
    add(new RoundedBoxGeometry(0.62, 0.42, 0.14, 1, 0.03), trim, root, 0, 2.18, -33.62);
    add(new RoundedBoxGeometry(0.44, 0.26, 0.06, 1, 0.02), rainLightMat, root, 0, 2.18, -33.68);
    const rtow = add(new THREE.TorusGeometry(0.24, 0.055, 8, 20), anodRed, root, 3.1, 2.08, -33.75);
    rtow.rotation.x = Math.PI / 2;

    // High-Mount Swan-Neck Carbon GT Wing
    const wingY = 10.65, wingZ = -32.25, wingSpan = 16.4;
    const foil = new THREE.Shape([
      v2(1.15, 0.02), v2(0.7, 0.14), v2(0.0, 0.16), v2(-0.75, 0.08),
      v2(-1.18, -0.06), v2(-0.7, -0.08), v2(0.1, -0.02), v2(0.85, -0.04),
    ]);
    const bladeGeo = new THREE.ExtrudeGeometry(foil, {
      depth: wingSpan, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2,
    }).rotateY(Math.PI / 2);
    bladeGeo.translate(-wingSpan / 2, 0, 0);
    const blade = add(bladeGeo, carbon, root, 0, wingY, wingZ);
    blade.rotation.x = 0.08;

    const wingDecalGeo = patchGeometry(4, 2, (u, v) => {
      const x = lerp(5.75, -5.75, u);
      const dz = lerp(-0.9, 0.9, v);
      return [x, wingY + 0.19 - dz * 0.08, wingZ + dz];
    }, false);
    add(wingDecalGeo, decalMat(windshieldBannerTexture()), root).castShadow = false;

    const upProf = new THREE.Shape([
      v2(0, 0), v2(0.85, 0), v2(0.45, 2.1), v2(-0.25, 2.35),
      v2(-0.68, 2.15), v2(-0.55, 1.9), v2(0.05, 1.95), v2(0.25, 0.45), v2(-0.22, 0),
    ]);
    const upGeo = new THREE.ExtrudeGeometry(upProf, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    upGeo.translate(0, 0, -0.07).rotateY(Math.PI / 2);
    const epDecalMat = decalMat(wingEndplateDecalTexture());
    for (const s of [1, -1]) {
      add(upGeo, dark, root, s * 4.4, 8.48, wingZ + 0.15);
      const ep = new THREE.Shape([v2(-1.55, -0.85), v2(1.42, -0.55), v2(1.52, 0.58), v2(-1.35, 0.85)]);
      const epGeo = new THREE.ExtrudeGeometry(ep, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
      epGeo.translate(0, 0, -0.045).rotateY(Math.PI / 2);
      add(epGeo, carbonFine, root, s * (wingSpan / 2 + 0.05), wingY, wingZ);

      const epDecalGeo = patchGeometry(2, 2, (u, v) => [
        s * (wingSpan / 2 + 0.12),
        lerp(wingY - 0.65, wingY + 0.65, v),
        s > 0 ? lerp(wingZ + 0.85, wingZ - 0.85, u) : lerp(wingZ - 0.85, wingZ + 0.85, u),
      ], false);
      add(epDecalGeo, epDecalMat, root).castShadow = false;
    }

    for (const x of [-2.45, -3.75]) {
      add(new THREE.CylinderGeometry(0.48, 0.48, 1.1, 28).rotateX(Math.PI / 2), steel, root, x, 2.48, -33.25);
      add(new THREE.CylinderGeometry(0.495, 0.495, 0.28, 28).rotateX(Math.PI / 2), tiBlue, root, x, 2.48, -33.68);
      add(new THREE.CylinderGeometry(0.4, 0.4, 1.14, 28).rotateX(Math.PI / 2), dark, root, x, 2.48, -33.25);
    }
  }

  // =========================================================================
  // 9. RACE INTERIOR & TUCKED ROLL CAGE (100% inside cabinPt!)
  // =========================================================================
  {
    for (const s of [1, -1]) {
      const sx = s * 2.35;
      add(new RoundedBoxGeometry(2.1, 0.48, 2.25, 2, 0.18), seatMat, root, sx, 6.7, -14.2);
      add(new RoundedBoxGeometry(2.05, 2.65, 0.48, 2, 0.18), seatMat, root, sx, 8.15, -15.55).rotation.x = -0.22;
      for (const b of [1, -1]) {
        add(new RoundedBoxGeometry(0.26, 1.9, 0.72, 2, 0.1), seatMat, root, sx + b * 0.98, 7.9, -15.2).rotation.x = -0.22;
        add(new RoundedBoxGeometry(0.15, 1.65, 0.12, 1, 0.04), anodRed, root, sx + b * 0.42, 8.25, -15.25).rotation.x = -0.22;
      }
    }
    add(new RoundedBoxGeometry(11.8, 0.8, 1.65, 2, 0.26), dark, root, 0, 7.15, -9.2);
    add(new RoundedBoxGeometry(2.9, 0.52, 1.15, 2, 0.18), dark, root, 2.35, 7.65, -9.45);
    const wheel = add(new THREE.TorusGeometry(0.76, 0.095, 10, 32), dark, root, 2.35, 8.22, -10.75);
    wheel.rotation.x = -0.38;
    add(new THREE.BoxGeometry(0.15, 0.18, 0.18), amber, root, 2.35, 8.92, -10.48);

    const inP = (z, u, inset = 0.58) => {
      const [x, y, zz] = cabinPt(z, u, -inset);
      return v3(x, y, zz);
    };
    const cageTube = (pts, r = 0.088) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 10), rollCageMat);

    const hoopZ = -17.3;
    cageTube([
      inP(hoopZ, -0.92, 0.68), inP(hoopZ, -0.8, 0.62), inP(hoopZ, -0.6, 0.56),
      inP(hoopZ, 0, 0.54),
      inP(hoopZ, 0.6, 0.56), inP(hoopZ, 0.8, 0.62), inP(hoopZ, 0.92, 0.68),
    ], 0.092);
    cageTube([inP(hoopZ, -0.58, 0.58), inP(hoopZ, 0.88, 0.7)], 0.08);
    const hL = inP(hoopZ, -0.84, 0.64), hR = inP(hoopZ, 0.84, 0.64);
    cageTube([v3(hL.x, 8.15, hoopZ), v3(hR.x, 8.15, hoopZ)], 0.08);
    for (const s of [1, -1]) {
      cageTube([
        inP(-7.6, s * 0.86, 0.68),
        inP(-9.8, s * 0.74, 0.62),
        inP(-12.2, s * 0.6, 0.56),
        inP(-14.8, s * 0.6, 0.56),
        inP(hoopZ, s * 0.6, 0.56),
      ], 0.08);
      cageTube([
        inP(hoopZ, s * 0.6, 0.56),
        inP(-21.0, s * 0.64, 0.62),
        inP(-24.4, s * 0.7, 0.68),
      ], 0.08);
    }
    cageTube([inP(-12.2, -0.6, 0.56), inP(-12.2, 0, 0.54), inP(-12.2, 0.6, 0.56)], 0.075);
  }

  // =========================================================================
  // 10. DEEP-DISH 6-SPOKE FORGED RACE WHEELS, SLICK TIRES & DRILLED BRAKES
  // =========================================================================
  const tireProfile = [
    v2(2.14, -1.18), v2(2.86, -1.2), v2(3.08, -1.06), v2(3.15, -0.74),
    v2(3.15, 0.74), v2(3.08, 1.06), v2(2.86, 1.2), v2(2.14, 1.18),
  ];
  const tireGeo = new THREE.LatheGeometry(tireProfile, 64).rotateZ(Math.PI / 2);
  const sideRingGeo = new THREE.RingGeometry(2.15, 3.06, 64).rotateY(Math.PI / 2);
  const spokeHoles = Array.from({ length: 6 }, (_, k) => {
    const a = (k * TAU) / 6, b = ((k + 1) * TAU) / 6;
    return [...arcPts(1.82, a + 0.11, b - 0.11, 10), ...arcPts(0.74, b - 0.28, a + 0.28, 4)];
  });
  const faceGeo = extrude(arcPts(2.04, 0, TAU, 72).slice(0, -1), spokeHoles, 0.24, 0.045).rotateY(Math.PI / 2);
  const lipGeo = new THREE.TorusGeometry(2.08, 0.085, 14, 64).rotateY(Math.PI / 2);
  const barrelGeo = new THREE.CylinderGeometry(2.08, 2.08, 2.15, 48, 1, true).rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.24, 32).rotateZ(Math.PI / 2);
  const lugGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.22, 6).rotateZ(Math.PI / 2);
  const discGeo = new THREE.CylinderGeometry(1.7, 1.7, 0.22, 48).rotateZ(Math.PI / 2);
  const discFaceGeo = new THREE.CircleGeometry(1.68, 48).rotateY(Math.PI / 2);

  const wheels = [];
  for (const wz of [0, -WHEELBASE]) {
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(s * TRACK, WHEEL_R, wz);
      if (s < 0) g.rotation.y = Math.PI;
      root.add(g);
      const spin = new THREE.Group();
      g.add(spin);
      add(tireGeo, rubber, spin);
      add(sideRingGeo, tireSideMat, spin, 1.205, 0, 0).castShadow = false;
      add(barrelGeo, rimDark, spin);
      add(lipGeo, rimLip, spin, 1.0, 0, 0);
      add(faceGeo, rimBronze, spin, 0.66, 0, 0);
      add(capGeo, dark, spin, 0.8, 0, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        add(lugGeo, anodRed, spin, 0.84, 0.56 * Math.cos(a), 0.56 * Math.sin(a));
      }
      add(discGeo, steel, spin, -0.22, 0, 0);
      add(discFaceGeo, disc, spin, -0.105, 0, 0).castShadow = false;
      add(new RoundedBoxGeometry(0.62, 1.55, 0.88, 2, 0.14), caliper, g, -0.05, 1.02, -0.95);
      wheels.push({ spin, s });
    }
  }

  root.traverse(o => { if (o.isMesh && o.material === glass) o.castShadow = false; });

  return {
    root, hood, popups, wheels, setPopups,
    setPaint(hex) {
      paint.color.setHex(hex);
      paintSolid.color.setHex(hex);
      hoodUnder.color.setHex(hex).multiplyScalar(UNDER);
    },
    setRoll(dist) { wheels.forEach(w => { w.spin.rotation.x = (dist / WHEEL_R) * w.s; }); },
    setLights(on, brake = 0) {
      headLens.emissive.setRGB(on ? 1.8 : 0, on ? 1.85 : 0, on ? 2.0 : 0);
      drlMat.emissive.setRGB(on ? 1.4 : 0.14, on ? 1.55 : 0.2, on ? 1.8 : 0.28);
      tailRing.emissive.setRGB(0.35 + (on ? 0.65 : 0) + brake * 1.6, 0.02, 0.01);
      tailInner.emissive.setRGB(0.12 + (on ? 0.25 : 0) + brake * 1.2, 0, 0);
    },
  };
}
