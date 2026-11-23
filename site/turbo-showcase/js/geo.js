// Geometry helpers shared by every part builder.
// Units: 1 unit = 10 mm. The turbo shaft axis is the X axis.
// Compressor side is -X, turbine side is +X, origin is the centre of the bearing housing.

import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- lathe
// Revolve a profile around the X axis.
// profile: array of [x, r] (axial position, radius). Sharp corners stay sharp:
// neighbouring segments are only smoothed when they meet at less than `crease` radians.
export function lathe(profile, { segs = 64, phi0 = 0, phiLen = TAU, crease = 0.6 } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  const n2 = [];
  let len = 0;
  const lens = [0];
  for (let i = 0; i < profile.length - 1; i++) {
    const [x0, r0] = profile[i], [x1, r1] = profile[i + 1];
    const dx = x1 - x0, dr = r1 - r0, l = Math.hypot(dx, dr);
    n2.push(l < 1e-9 ? null : [-dr / l, dx / l]);
    len += l; lens.push(len);
  }
  const endN = (i, end) => {
    const a = n2[i];
    const j = end ? i + 1 : i - 1;
    const b = n2[j];
    if (!b) return a;
    const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    if (ang > crease) return a;
    const m = [a[0] + b[0], a[1] + b[1]], l = Math.hypot(m[0], m[1]) || 1;
    return [m[0] / l, m[1] / l];
  };
  for (let i = 0; i < n2.length; i++) {
    if (!n2[i]) continue;
    const base = pos.length / 3;
    const na = endN(i, false), nb = endN(i, true);
    for (let s = 0; s <= segs; s++) {
      const phi = phi0 + (phiLen * s) / segs, c = Math.cos(phi), sn = Math.sin(phi);
      for (const [k, n] of [[i, na], [i + 1, nb]]) {
        const [x, r] = profile[k];
        pos.push(x, r * c, r * sn);
        nor.push(n[0], n[1] * c, n[1] * sn);
        uv.push(s / segs, lens[k] / (len || 1));
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2, b = a + 1, c2 = a + 2, d = a + 3;
      idx.push(a, c2, b, b, c2, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- sweep
// A tube along a path with a varying radius.
// path(t) for t in [0,1] returns { p: Vector3, r: number } (r may also be [ry, rz] for an ellipse).
// Frames use parallel transport, so the tube does not twist.
export function sweep(path, { nt = 96, nr = 32, capStart = false, capEnd = false, up = V3(0, 0, 1) } = {}) {
  const P = [], R = [], T = [];
  for (let i = 0; i <= nt; i++) {
    const s = path(i / nt);
    P.push(s.p.clone());
    R.push(Array.isArray(s.r) ? s.r : [s.r, s.r]);
  }
  for (let i = 0; i <= nt; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(nt, i + 1)];
    T.push(b.clone().sub(a).normalize());
  }
  let N = up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0])));
  if (N.lengthSq() < 1e-6) N = V3(0, 1, 0).sub(T[0].clone().multiplyScalar(T[0].y));
  N.normalize();
  const Ns = [], Bs = [];
  for (let i = 0; i <= nt; i++) {
    if (i > 0) {
      const ax = T[i - 1].clone().cross(T[i]);
      const s = ax.length();
      if (s > 1e-9) N.applyAxisAngle(ax.divideScalar(s), Math.asin(Math.min(1, s)));
      N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize();
    }
    Ns.push(N.clone());
    Bs.push(T[i].clone().cross(N).normalize());
  }
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= nt; i++) {
    for (let j = 0; j <= nr; j++) {
      const a = (j / nr) * TAU, c = Math.cos(a), s = Math.sin(a);
      const n = Ns[i].clone().multiplyScalar(c).add(Bs[i].clone().multiplyScalar(s));
      const off = Ns[i].clone().multiplyScalar(c * R[i][0]).add(Bs[i].clone().multiplyScalar(s * R[i][1]));
      pos.push(P[i].x + off.x, P[i].y + off.y, P[i].z + off.z);
      nor.push(n.x, n.y, n.z);
      uv.push(j / nr, i / nt);
    }
  }
  for (let i = 0; i < nt; i++) {
    for (let j = 0; j < nr; j++) {
      const a = i * (nr + 1) + j, b = a + nr + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const cap = (i, sign) => {
    const c = pos.length / 3;
    pos.push(P[i].x, P[i].y, P[i].z); nor.push(T[i].x * sign, T[i].y * sign, T[i].z * sign); uv.push(0.5, 0.5);
    for (let j = 0; j <= nr; j++) {
      const k = (i * (nr + 1) + j) * 3;
      pos.push(pos[k], pos[k + 1], pos[k + 2]);
      nor.push(T[i].x * sign, T[i].y * sign, T[i].z * sign);
      uv.push(0.5 + 0.5 * Math.cos((j / nr) * TAU), 0.5 + 0.5 * Math.sin((j / nr) * TAU));
    }
    for (let j = 0; j < nr; j++) sign > 0 ? idx.push(c, c + 1 + j, c + 2 + j) : idx.push(c, c + 2 + j, c + 1 + j);
  };
  if (capStart) cap(0, -1);
  if (capEnd) cap(nt, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- volute
// The snail-shell scroll of a compressor or turbine housing.
// It spirals around the X axis at axial position x, from angle th0 to th1 (radians,
// measured from +Y towards +Z), while the centreline radius grows rc0 → rc1 and the tube
// radius grows tr0 → tr1. It then carries straight on along the tangent for outLen
// (the compressor outlet or turbine inlet), with the tube radius easing to outR.
// dir = +1 spirals +Y → +Z, -1 the other way.
// Returns { geo, path, end: { p, t } } where end.p is the outlet mouth centre and end.t its direction.
export function volute({ x = 0, rc0 = 4, rc1 = 5.2, tr0 = 0.4, tr1 = 1.4, th0 = 0.5, th1 = TAU,
  outLen = 4, outR = null, dir = 1, nt = 160, nr = 36 } = {}) {
  const spiralFrac = 0.78;
  outR = outR ?? tr1;
  const at = th => {
    const u = (th - th0) / (th1 - th0);
    const rc = rc0 + (rc1 - rc0) * u;
    const tr = tr0 + (tr1 - tr0) * Math.sqrt(Math.max(0, u));
    return { rc, tr, p: V3(x, rc * Math.cos(th * dir), rc * Math.sin(th * dir)) };
  };
  const endS = at(th1);
  const dth = 1e-3, prev = at(th1 - dth);
  const tan = endS.p.clone().sub(prev.p).normalize();
  const path = t => {
    if (t <= spiralFrac) {
      const th = th0 + (th1 - th0) * (t / spiralFrac);
      const s = at(th);
      return { p: s.p, r: s.tr };
    }
    const u = (t - spiralFrac) / (1 - spiralFrac);
    const e = u * u * (3 - 2 * u);
    return { p: endS.p.clone().add(tan.clone().multiplyScalar(outLen * u)), r: tr1 + (outR - tr1) * e };
  };
  const geo = sweep(path, { nt, nr, capStart: true, up: V3(1, 0, 0) });
  return { geo, path, end: { p: endS.p.clone().add(tan.clone().multiplyScalar(outLen)), t: tan } };
}

// ---------------------------------------------------------------- skin
// A thin solid (blade, vane, plate) from a mid-surface.
// surf(u, v) returns a Vector3 for u, v in [0,1]; thick is a number or (u, v) => number.
// u usually runs leading edge → trailing edge, v hub → tip.
export function skin(surf, { nu = 24, nv = 10, thick = 0.08 } = {}) {
  const th = typeof thick === 'function' ? thick : () => thick;
  const grid = [], norms = [];
  const e = 1e-3;
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const u = i / nu, v = j / nv;
      const p = surf(u, v);
      const du = surf(Math.min(1, u + e), v).sub(surf(Math.max(0, u - e), v));
      const dv = surf(u, Math.min(1, v + e)).sub(surf(u, Math.max(0, v - e)));
      const n = du.cross(dv).normalize();
      grid.push(p); norms.push(n);
    }
  }
  const at = (i, j) => i * (nv + 1) + j;
  const geos = [];
  const sheet = sign => {
    const pos = [], idx = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const k = at(i, j), h = th(i / nu, j / nv) * 0.5 * sign;
      const p = grid[k].clone().add(norms[k].clone().multiplyScalar(h));
      pos.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      sign > 0 ? idx.push(a, b, c, c, b, d) : idx.push(a, c, b, c, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
  };
  sheet(1); sheet(-1);
  // edge strips joining the two sheets
  const edge = list => {
    const pos = [], idx = [];
    list.forEach(([i, j], n) => {
      const k = at(i, j), h = th(i / nu, j / nv) * 0.5;
      const a = grid[k].clone().add(norms[k].clone().multiplyScalar(h));
      const b = grid[k].clone().add(norms[k].clone().multiplyScalar(-h));
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (n > 0) { const q = n * 2; idx.push(q - 2, q - 1, q, q, q - 1, q + 1); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
  };
  const L = [], Rr = [], B = [], Tt = [];
  for (let j = 0; j <= nv; j++) { L.push([0, j]); Rr.push([nu, j]); }
  for (let i = 0; i <= nu; i++) { B.push([i, 0]); Tt.push([i, nv]); }
  edge(L); edge(Rr); edge(B); edge(Tt);
  return merge(geos);
}

// ---------------------------------------------------------------- small parts
// Hex head / nut with its axis along +X, sitting on x = 0 and extending to x = h.
export function hex(r = 0.3, h = 0.2) {
  const g = new THREE.CylinderGeometry(r, r, h, 6, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate(h / 2, 0, 0);
  return g;
}
// Plain cylinder along +X from x0 to x1.
export function rod(r, x0, x1, segs = 24) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, segs, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}
// Cylinder between two points.
export function rodBetween(a, b, r, segs = 16) {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), segs, 1);
  g.translate(0, d.length() / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// Merge non-indexed or indexed geometries that share position/normal (uv optional).
export function merge(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0);
      uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Shorthand: mesh with shadows on.
export function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
