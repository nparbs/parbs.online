// Procedural '90s-style rotary coupe used to showcase the R3 installed.
// Car-local frame: z forward, front axle at z = 0, ground at y = 0, 1 unit = 100 mm.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const WHEELBASE = 24.25, TRACK = 7.3, WHEEL_R = 3.15;
const ARCH_R = 3.6;
const FLARE = 0.26;  // outward swell of the fender lip around each arch
const ARCH_X = 5.75; // wheel-well inner wall: outside the bay liner (±4.65), inside the tyre (6.15)
const HOOD_Z0 = -5.9, HOOD_Z1 = 5.8, HOOD_U = 0.56;

export const PAINTS = [
  ['Signal Red', 0xa3121b], ['Rally Yellow', 0xe2a90c], ['Gunmetal', 0x3a3f47], ['Pearl White', 0xe6e6e1],
];

// [z, halfWidth, bottomY, shoulderY, centreTopY, fenderPeakY]
const BODY = [
  [9.95, 3.2, 2.6, 4.0, 4.3, 4.3],
  [9.6, 6.0, 2.0, 4.4, 4.8, 4.9],
  [8.4, 7.6, 1.4, 5.1, 5.35, 5.8],
  [6.5, 8.5, 1.3, 5.95, 5.85, 6.75],
  [3.5, 8.75, 1.3, 6.75, 6.3, 7.45],
  [0.0, 8.8, 1.35, 7.05, 6.7, 7.7],
  [-3.0, 8.75, 1.35, 6.85, 7.15, 7.5],
  [-6.0, 8.6, 1.3, 6.5, 7.65, 7.4],
  [-9.0, 8.55, 1.3, 6.7, 7.9, 7.7],
  [-13.0, 8.6, 1.3, 7.0, 8.0, 8.0],
  [-17.0, 8.75, 1.3, 7.3, 8.2, 8.5],
  [-21.0, 8.85, 1.35, 7.6, 8.5, 9.0],
  [-24.25, 8.9, 1.45, 7.8, 8.7, 9.2],
  [-27.5, 8.8, 1.6, 7.9, 9.0, 9.3],
  [-30.5, 8.4, 2.0, 7.9, 9.2, 9.3],
  [-32.6, 7.9, 2.8, 7.6, 9.0, 9.0],
  [-33.4, 7.4, 3.2, 7.1, 8.4, 8.4],
];
// [z, baseHalfWidth, roofHalfWidth, roofY]
const CABIN = [
  [-6.2, 7.3, 6.9, 0], [-7.5, 7.5, 6.6, 8.75], [-9.0, 7.6, 6.25, 9.9], [-10.5, 7.7, 5.95, 10.9],
  [-12.0, 7.75, 5.75, 11.75], [-13.5, 7.8, 5.65, 12.2], [-15.5, 7.85, 5.65, 12.3], [-17.5, 7.9, 5.75, 12.15],
  [-19.5, 7.95, 5.95, 11.7], [-21.5, 8.0, 6.15, 11.05], [-23.5, 8.0, 6.35, 10.45], [-25.5, 7.95, 6.5, 9.95],
  [-27.5, 7.8, 6.6, 9.55], [-29.2, 7.6, 6.6, 9.25], [-30.0, 7.5, 6.6, 0],
];

const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
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

// FD-style section: widest at the waist (about wheel-centre height), hard tuck under the sill,
// and tumblehome rolling in to the shoulder.
const WAIST = 0.4;
const sideX = (hw, t) => hw * (t < WAIST ? 1 - 0.12 * ((WAIST - t) / WAIST) ** 2 : 1 - 0.075 * ((t - WAIST) / (1 - WAIST)) ** 1.6);
const NB = 6, NS = 40, NT = 120;
function bodyRing(z) {
  const row = bodyAt(z), [hw, yb, yS] = row, hwB = sideX(hw, 0), hwS = sideX(hw, 1), pts = [];
  for (let i = 0; i < NB; i++) pts.push({ x: (hwB * i) / NB, y: yb, k: 'b' });
  for (let i = 0; i < NS; i++) { const t = i / NS; pts.push({ x: sideX(hw, t), y: yb + (yS - yb) * t, k: 's' }); }
  for (let i = 0; i <= NT; i++) { const u = Math.cos((i / NT) * Math.PI); pts.push({ x: u * hwS, y: topY(u, row), k: 't', u }); }
  for (let i = NS - 1; i >= 0; i--) { const t = i / NS; pts.push({ x: -sideX(hw, t), y: yb + (yS - yb) * t, k: 's' }); }
  for (let i = NB - 1; i >= 1; i--) pts.push({ x: (-hwB * i) / NB, y: yb, k: 'b' });
  return pts;
}
// signed distance to a rounded rectangle (centre cx,cz; half sizes hx,hz; corner r)
const rrect = (x, z, cx, cz, hx, hz, r) => {
  const qx = Math.abs(x - cx) - hx + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
};
const POP = { cx: 6.05, cz: 6.55, hx: 1.3, hz: 0.82, r: 0.28 }; // wide, shallow lid like the FD's // pop-up lid on each front fender
const DOOR_Z = [-5.95, -17.3];

const NS2 = 8, NT2 = 34;
function cabinRing(z) {
  const [wb, wt, yRraw] = cabinAt(z);
  const yB = bodyAt(z)[3] - 0.05;
  const yR = Math.max(yB, yRraw);
  const H = yR - yB, drop = Math.min(0.6, 0.45 * H), bub = Math.min(0.1, 0.06 * H), pts = [];
  for (let i = 0; i < NS2; i++) { const t = i / NS2; pts.push({ x: lerp(wb, wt, t) + 0.18 * Math.sin(Math.PI * t) * Math.min(1, H), y: yB + (H - drop) * t, k: 's', t }); }
  for (let i = 0; i <= NT2; i++) {
    const u = Math.cos((i / NT2) * Math.PI), a = Math.abs(u);
    pts.push({ x: u * wt, y: yR - drop * a ** 2.2 + bub * Math.exp(-(((a - 0.42) / 0.17) ** 2)), k: 't', u });
  }
  for (let i = NS2 - 1; i >= 0; i--) { const t = i / NS2; pts.push({ x: -(lerp(wb, wt, t) + 0.18 * Math.sin(Math.PI * t) * Math.min(1, H)), y: yB + (H - drop) * t, k: 's', t }); }
  return pts;
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
  const g = new THREE.ExtrudeGeometry(shape, { depth: core, curveSegments: 24, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2 });
  g.translate(0, 0, -core / 2);
  return g;
}
const v2 = (x, y) => new THREE.Vector2(x, y);
const arcPts = (r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return v2(r * Math.cos(a), r * Math.sin(a)); });

export function buildCar() {
  const root = new THREE.Group();
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const paint = new THREE.MeshPhysicalMaterial({ color: PAINTS[0][1], metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05, vertexColors: true, side: THREE.DoubleSide });
  const paintSolid = new THREE.MeshPhysicalMaterial({ color: PAINTS[0][1], metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0e13, metalness: 0.2, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const trim = M({ color: 0x0b0c0e, metalness: 0, roughness: 0.62, side: THREE.DoubleSide });
  const dark = M({ color: 0x111214, metalness: 0.2, roughness: 0.8 });
  const bay = M({ color: 0x15171a, metalness: 0.4, roughness: 0.7, side: THREE.BackSide });
  const UNDER = 0.55; // hood underside: body colour, darker and satin
  const hoodUnder = M({ color: new THREE.Color(PAINTS[0][1]).multiplyScalar(UNDER), metalness: 0.3, roughness: 0.6, side: THREE.BackSide });
  const rubber = M({ color: 0x18191b, metalness: 0, roughness: 0.86 });
  const rim = M({ color: 0xb9bcc0, metalness: 1, roughness: 0.22 });
  const rimDark = M({ color: 0x5d6168, metalness: 1, roughness: 0.3, side: THREE.DoubleSide });
  const disc = M({ color: 0x8d9095, metalness: 1, roughness: 0.4 });
  const caliper = M({ color: 0xd2391a, metalness: 0.3, roughness: 0.4 });
  const headLens = M({ color: 0xeef3ff, emissive: 0x000000, metalness: 0.1, roughness: 0.1 });
  const tailLens = M({ color: 0x5a0606, emissive: 0x3a0000, metalness: 0.1, roughness: 0.2 });
  const amber = M({ color: 0xd07a10, emissive: 0x2a1200, roughness: 0.3 });
  const steel = M({ color: 0xc4c7cb, metalness: 1, roughness: 0.2 });

  const add = (geo, mat, parent = root, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---- body shell
  const zFront = 9.95, zRear = -33.4, NZ = 420;
  const zs = Array.from({ length: NZ + 1 }, (_, i) => lerp(zFront, zRear, i / NZ));
  const rings = zs.map(bodyRing), MR = rings[0].length;
  const pos = [], col = [], idx = [];
  rings.forEach((ring, r) => {
    const z = zs[r];
    ring.forEach(p => {
      let x = p.x, shade = 1;
      for (const wz of [0, -WHEELBASE]) {
        if (Math.abs(x) < ARCH_X) continue;
        const d = Math.hypot(z - wz, p.y - WHEEL_R);
        const f = 1 - ss(ARCH_R - 0.2, ARCH_R, d);
        if (f > 0) { x = Math.sign(x) * lerp(Math.abs(x), ARCH_X, f); shade = Math.min(shade, lerp(1, 0.05, f)); }
        else if (p.k === 's' || Math.abs(p.u) > 0.9) x += Math.sign(x) * FLARE * Math.exp(-(((d - ARCH_R - 0.5) / 0.55) ** 2)); // fender flare
      }
      if (p.k === 't' && Math.abs(p.u) < 0.88 && z < -6.1 && z > -30.2) shade = 0.1;           // interior floor seen through glass
      const ax = Math.abs(x), y = p.y;
      if (z > 8.2) {
        const mouth = (x / 4.5) ** 2 + ((y - 2.55) / 0.98) ** 2;                                // big oval intake
        const side = ((ax - 6.45) / 1.05) ** 2 + ((y - 2.8) / 0.52) ** 2;                       // flanking ovals
        shade = Math.min(shade, lerp(0.03, 1, ss(0.86, 1.0, mouth)), lerp(0.06, 1, ss(0.8, 1.0, side)));
        if (y < 1.75) shade = Math.min(shade, 0.12);                                             // chin lip
      }
      if (z < -32.4 && y < 2.6) shade = Math.min(shade, 0.12);                                   // rear valance
      if (p.k === 't') {                                                                         // pop-up lid shut lines
        const d = rrect(ax, z, POP.cx, POP.cz, POP.hx, POP.hz, POP.r);
        shade = Math.min(shade, lerp(0.22, 1, ss(0.03, 0.13, Math.abs(d))));
      }
      if ((p.k === 's' || Math.abs(p.u) > 0.86) && y > 1.9) for (const dz of DOOR_Z) shade = Math.min(shade, lerp(0.25, 1, ss(0.04, 0.14, Math.abs(z - dz)))); // door shut lines
      pos.push(x, p.y, z);
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
  // end caps
  for (const [r, flip] of [[0, true], [NZ, false]]) {
    let cx = 0, cy = 0;
    for (let k = 0; k < MR; k++) { cx += pos[(r * MR + k) * 3]; cy += pos[(r * MR + k) * 3 + 1]; }
    const ci = pos.length / 3;
    pos.push(cx / MR, cy / MR, zs[r]);
    const cc = r === 0 ? 0.03 : 1; // the nose cap sits inside the mouth
    col.push(cc, cc, cc);
    for (let k = 0; k < MR; k++) {
      const a = r * MR + k, b = r * MR + ((k + 1) % MR);
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  add(gridGeometry(pos, col, idx), paint);

  // ---- hood (rear-hinged), a patch of the same surface
  const hood = new THREE.Group();
  const hingeZ = HOOD_Z0, hingeY = bodyAt(hingeZ)[3];
  hood.position.set(0, hingeY, hingeZ);
  root.add(hood);
  {
    const rIdx = zs.map((z, r) => r).filter(inHood);
    const kIdx = rings[0].map((p, k) => k).filter(hoodPt);
    const hp = [], hi = [], nk = kIdx.length;
    rIdx.forEach(r => kIdx.forEach(k => { const p = rings[r][k]; hp.push(p.x, p.y + 0.015 - hingeY, zs[r] - hingeZ); }));
    for (let a = 0; a < rIdx.length - 1; a++) for (let b = 0; b < nk - 1; b++) {
      const p = a * nk + b;
      hi.push(p, p + nk, p + nk + 1, p, p + nk + 1, p + 1);
    }
    const hg = gridGeometry(hp, null, hi);
    add(hg, paintSolid, hood);
    add(hg, hoodUnder, hood).castShadow = false;
  }

  // ---- greenhouse: glass, roof panel, pillars
  {
    const zc0 = -6.2, zc1 = -30.0, NZC = 120;
    const czs = Array.from({ length: NZC + 1 }, (_, i) => lerp(zc0, zc1, i / NZC));
    const crs = czs.map(cabinRing), MC = crs[0].length;
    const cp = [];
    crs.forEach((ring, r) => ring.forEach(p => cp.push(p.x, p.y, czs[r])));
    const gIdx = [], rIdx = [], tIdx = [];
    for (let r = 0; r < NZC; r++) {
      const zc = (czs[r] + czs[r + 1]) / 2;
      for (let k = 0; k < MC - 1; k++) {
        const p = crs[r][k], q = crs[r][k + 1];
        const a = r * MC + k, b = (r + 1) * MC + k, c = (r + 1) * MC + k + 1, d = r * MC + k + 1;
        const top = p.k === 't' && q.k === 't';
        const au = top ? Math.max(Math.abs(p.u), Math.abs(q.u)) : 0;
        const side = !top;
        const ts = side ? Math.min(p.t ?? 1, q.t ?? 1) : 1;
        let list = gIdx;
        if (top && zc <= -11.6 && zc >= -19.8) list = rIdx;
        else if (side && ts < 0.13) list = tIdx;
        else if (zc > -11.6 && ((top && au > 0.9) || (side && ts > 0.74))) list = tIdx;
        else if (side && zc <= -19.8 && zc >= -21.0) list = tIdx;
        else if (top && au > 0.93) list = tIdx;
        list.push(a, b, c, a, c, d);
      }
    }
    const shared = new THREE.Float32BufferAttribute(cp, 3);
    const mk = (ids, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', shared);
      g.setIndex(ids);
      g.computeVertexNormals();
      return add(g, mat);
    };
    mk(gIdx, glass).castShadow = false;
    mk(rIdx, paintSolid);
    mk(tIdx, trim);
  }

  // ---- engine bay
  {
    // walls reach right up to the hood cut so the shell's inner skin (arch insets) never shows
    const liner = new THREE.BoxGeometry(9.3, 5.75, 11.8);
    const invisible = new THREE.MeshBasicMaterial({ visible: false });
    const m = add(liner, [bay, bay, invisible, bay, bay, bay], root, 0, 4.17, -0.05);
    m.castShadow = false;
    for (const s of [1, -1]) {
      add(new THREE.CylinderGeometry(0.55, 0.62, 1.6, 24), dark, root, s * 4.0, 5.3, 0.3);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 6), steel, root, s * 4.0, 6.14, 0.3);
    }
    const rad = add(new RoundedBoxGeometry(8.8, 2.6, 0.35, 2, 0.08), dark, root, 0, 3.6, 4.85);
    rad.rotation.x = -0.35;
    add(new THREE.CylinderGeometry(0.85, 0.85, 0.6, 32).rotateX(Math.PI / 2), dark, root, 3.7, 5.2, -5.55);
    add(new RoundedBoxGeometry(1.6, 1.2, 1.4, 2, 0.1), dark, root, -3.9, 4.4, -4.6);
  }

  // ---- pop-up headlights
  // Shut, the lid is just the painted fender with its shut line drawn in. Raised, the unit pivots
  // about the lid's rear edge so its lamp face (angled down by POP_A when stowed) ends up facing forward.
  // FD-style pod: a wedge hinged at the lid's rear edge. Stowed, the lid is the fender (shut line
  // drawn in the paint) and the lamp face points down into the body. Raised by POP_A, the painted
  // lid leans back and the lamp face stands vertical, facing straight ahead.
  const POP_A = 1.0;
  const surfY = (x, z) => { const row = bodyAt(z), hwS = sideX(row[0], 1); return topY(x / hwS, row); };
  const popups = [1, -1].map(s => {
    const z0 = POP.cz - POP.hz, L = POP.hz * 2, Wd = POP.hx * 2 - 0.12, D = 1.28;
    const cA = Math.cos(POP_A), sA = Math.sin(POP_A);
    // side profile in (z, y): pivot, lid front edge, bottom of the lamp face, back under the pivot
    const prof = new THREE.Shape([v2(0, 0), v2(L, 0), v2(L - D * sA, -D * cA), v2(0.05, -0.32)]);
    const podGeo = new THREE.ExtrudeGeometry(prof, { depth: Wd, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    podGeo.translate(0, 0, -Wd / 2).rotateY(-Math.PI / 2);
    const pivot = new THREE.Group();
    pivot.position.set(s * POP.cx, surfY(POP.cx, z0) - 0.03, z0);
    pivot.visible = false;
    root.add(pivot);
    add(podGeo, trim, pivot);
    // painted lid, slightly crowned so it reads as a piece of the fender
    const lidGeo = new RoundedBoxGeometry(Wd + 0.06, 0.1, L + 0.04, 2, 0.04);
    const lp = lidGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) lp.setY(i, lp.getY(i) + 0.08 * (1 - (lp.getX(i) / (Wd / 2 + 0.05)) ** 2));
    lidGeo.computeVertexNormals();
    add(lidGeo, paintSolid, pivot, 0, 0.03, L / 2);
    // lamp on the face: chrome reflector bowl behind a clear rounded-rectangle lens
    const face = new THREE.Group();
    face.position.set(0, -D * cA / 2, L - D * sA / 2);
    face.rotation.x = POP_A;                         // +z → face normal (0, -sinA, cosA)
    pivot.add(face);
    add(new RoundedBoxGeometry(Wd - 0.34, D - 0.36, 0.06, 2, 0.16), steel, face, 0, 0, 0.02);
    add(new RoundedBoxGeometry(Wd - 0.44, D - 0.46, 0.06, 2, 0.14), headLens, face, 0, 0, 0.06);
    return pivot;
  });
  const setPopups = t => popups.forEach(p => { p.visible = t > 0.01; p.rotation.x = -POP_A * t; });

  // front side lamps sit in the flanking ovals, on the bumper surface
  const noseZ = (ax, y) => {
    for (let z = zFront; z > zFront - 4; z -= 0.02) {
      const row = bodyAt(z), t = (y - row[1]) / (row[2] - row[1]);
      if (t >= 0 && t <= 1 && sideX(row[0], t) >= ax) return z;
    }
    return zFront - 4;
  };
  for (const s of [1, -1]) {
    const lz = noseZ(6.45, 2.8);
    const lamp = add(new THREE.SphereGeometry(1, 24, 12).scale(0.82, 0.38, 0.18), amber, root, s * 6.45, 2.8, lz - 0.08);
    lamp.rotation.y = s * 0.55;
  }

  // ---- lights, wing, mirrors, tips, interior
  add(new RoundedBoxGeometry(13.4, 1.3, 0.14, 2, 0.05), trim, root, 0, 7.35, -33.42);
  for (const s of [1, -1]) for (const x of [2.7, 4.05, 5.4]) add(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 28).rotateX(Math.PI / 2), tailLens, root, s * x, 7.35, -33.5);
  add(new RoundedBoxGeometry(14.2, 0.16, 1.5, 2, 0.07), paintSolid, root, 0, 10.15, -32.0).rotation.x = 0.06;
  for (const s of [1, -1]) add(new RoundedBoxGeometry(0.3, 1.0, 0.6, 1, 0.08), paintSolid, root, s * 5.6, 9.65, -32.0);
  for (const s of [1, -1]) {
    // door mirror on a short stalk from the front corner of the side glass
    add(new RoundedBoxGeometry(1.0, 0.2, 0.5, 1, 0.08), paintSolid, root, s * 7.95, 8.0, -7.45).rotation.y = s * 0.12;
    const mh = add(new RoundedBoxGeometry(0.55, 0.72, 1.15, 2, 0.24), paintSolid, root, s * 8.6, 8.3, -7.75);
    mh.rotation.y = s * 0.1;
    add(new RoundedBoxGeometry(0.42, 0.58, 0.04, 1, 0.02), trim, root, s * 8.62, 8.3, -8.33);
  }
  for (const x of [-2.1, -3.3]) {
    add(new THREE.CylinderGeometry(0.46, 0.46, 0.9, 28).rotateX(Math.PI / 2), steel, root, x, 2.75, -33.25);
    add(new THREE.CylinderGeometry(0.38, 0.38, 0.92, 28).rotateX(Math.PI / 2), dark, root, x, 2.75, -33.25);
  }
  {
    const seat = new RoundedBoxGeometry(2.6, 0.7, 2.6, 2, 0.25), back = new RoundedBoxGeometry(2.6, 3.0, 0.7, 2, 0.25);
    for (const s of [1, -1]) {
      add(seat, dark, root, s * 2.5, 8.3, -14.2);
      add(back, dark, root, s * 2.5, 9.9, -15.6).rotation.x = -0.22;
    }
    add(new RoundedBoxGeometry(14.2, 0.9, 1.8, 2, 0.3), dark, root, 0, 8.7, -9.4);
    add(new THREE.TorusGeometry(0.95, 0.12, 10, 32), dark, root, 2.5, 9.8, -10.9).rotation.x = -0.45;
  }

  // ---- wheels
  const tireProfile = [v2(2.15, -1.1), v2(2.85, -1.13), v2(3.07, -1.0), v2(3.15, -0.7), v2(3.15, 0.7), v2(3.07, 1.0), v2(2.85, 1.13), v2(2.15, 1.1)];
  const tireGeo = new THREE.LatheGeometry(tireProfile, 64).rotateZ(Math.PI / 2);
  const spokeHoles = Array.from({ length: 5 }, (_, k) => {
    const a = (k * TAU) / 5, b = ((k + 1) * TAU) / 5;
    return [...arcPts(1.86, a + 0.13, b - 0.13, 10), ...arcPts(0.8, b - 0.36, a + 0.36, 4)];
  });
  const faceGeo = extrude(arcPts(2.06, 0, TAU, 72).slice(0, -1), spokeHoles, 0.2, 0.04).rotateY(Math.PI / 2);
  const barrelGeo = new THREE.CylinderGeometry(2.08, 2.08, 2.0, 48, 1, true).rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(0.46, 0.5, 0.2, 32).rotateZ(Math.PI / 2);
  const lugGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 6).rotateZ(Math.PI / 2);
  const discGeo = new THREE.CylinderGeometry(1.62, 1.62, 0.24, 48).rotateZ(Math.PI / 2);
  const wheels = [];
  for (const wz of [0, -WHEELBASE]) for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(s * TRACK, WHEEL_R, wz);
    if (s < 0) g.rotation.y = Math.PI;
    root.add(g);
    const spin = new THREE.Group();
    g.add(spin);
    add(tireGeo, rubber, spin);
    add(barrelGeo, rimDark, spin);
    add(faceGeo, rim, spin, 0.72, 0, 0);
    add(capGeo, rim, spin, 0.86, 0, 0);
    for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 + TAU / 10; add(lugGeo, steel, spin, 0.9, 0.62 * Math.cos(a), 0.62 * Math.sin(a)); }
    add(discGeo, disc, spin, -0.2, 0, 0);
    add(new RoundedBoxGeometry(0.6, 1.3, 0.8, 2, 0.12), caliper, g, -0.05, 1.05, -0.95);
    wheels.push({ spin, s });
  }

  root.traverse(o => { if (o.isMesh && o.material === glass) o.castShadow = false; });

  return {
    root, hood, popups, wheels, setPopups,
    setPaint(hex) { paint.color.setHex(hex); paintSolid.color.setHex(hex); hoodUnder.color.setHex(hex).multiplyScalar(UNDER); },
    setRoll(dist) { wheels.forEach(w => { w.spin.rotation.x = (dist / WHEEL_R) * w.s; }); },
    setLights(on, brake = 0) {
      headLens.emissive.setRGB(on ? 1.6 : 0, on ? 1.65 : 0, on ? 1.75 : 0);
      tailLens.emissive.setRGB(0.25 + (on ? 0.6 : 0) + brake * 1.4, 0, 0);
    },
  };
}
