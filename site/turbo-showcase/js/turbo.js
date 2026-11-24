// Assembles the STRATA T64 from its part builders and owns the explode / fade / x-ray state.

import * as THREE from 'three';
import { buildCompressorWheel } from './parts/compressorWheel.js?v=4';
import { buildTurbineWheel } from './parts/turbineWheel.js?v=4';
import { buildCompressorHousing } from './parts/compressorHousing.js?v=4';
import { buildTurbineHousing } from './parts/turbineHousing.js?v=4';
import { buildChra, buildBackplate } from './parts/chra.js?v=4';
import { buildShaft, buildBearing } from './parts/shaft.js?v=4';
import { buildActuator } from './parts/actuator.js?v=4';
import { buildVband, buildOilLines } from './parts/clamps.js?v=4';

const v = (x, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// home = assembled position, off = exploded offset, at = explode start (0..1 of the explode), xray = housing that
// turns to glass in the "how it works" view
export const LAYOUT = [
  { key: 'vbandOutlet',       build: M => buildVband(M, 3.95), home: v(7.0),        off: v(17.0, 3.0),     at: 0.00 },
  { key: 'oilFeed',           build: null,                     home: v(0),          off: v(0, 5.5, 1.5),   at: 0.02 },
  { key: 'oilDrain',          build: null,                     home: v(0),          off: v(0.5, -5.0),     at: 0.04 },
  { key: 'actuator',          build: buildActuator,            home: v(-3.4, -1.5, -9.6), off: v(0, -2.0, -5.5), at: 0.06 },
  { key: 'vbandTurbine',      build: M => buildVband(M, 3.62), home: v(2.32),       off: v(5.6, 7.0),      at: 0.10 },
  { key: 'turbineHousing',    build: buildTurbineHousing,      home: v(2.3),        off: v(12.5),          at: 0.14, xray: true },
  { key: 'compressorHousing', build: buildCompressorHousing,   home: v(-2.45),      off: v(-13.0),         at: 0.14, xray: true },
  { key: 'compressorWheel',   build: buildCompressorWheel,     home: v(-2.7),       off: v(-6.6),          at: 0.30, spin: true },
  { key: 'backplate',         build: buildBackplate,           home: v(-2.45),      off: v(-3.0),          at: 0.40, xray: true },
  { key: 'turbineWheel',      build: buildTurbineWheel,        home: v(2.55),       off: v(6.6),           at: 0.44, spin: true },
  { key: 'shaft',             build: buildShaft,               home: v(0),          off: v(1.0, -6.2),     at: 0.50, spin: true },
  { key: 'bearing',           build: buildBearing,             home: v(0),          off: v(0, -3.6),       at: 0.62 },
  { key: 'chra',              build: buildChra,                home: v(0),          off: v(0),             at: 0, xray: true },
];
const SPAN = 0.42;  // each part's own explode takes this much of the 0..1 explode

export function buildTurbo(M) {
  const root = new THREE.Group();
  const parts = {};
  const oil = buildOilLines(M);

  for (const L of LAYOUT) {
    let g;
    if (L.key === 'oilFeed') g = oil.userData.feed;
    else if (L.key === 'oilDrain') g = oil.userData.drain;
    else g = L.build(M);
    if (g.parent) g.parent.remove(g);
    const holder = new THREE.Group();   // holder moves; g keeps its own rotation (spinning parts)
    holder.add(g);
    holder.position.copy(L.home);
    root.add(holder);
    // own material per mesh so each part can fade on its own
    // one clone per material per part (not per mesh), so each part can fade on its own
    const clones = new Map();
    g.traverse(o => {
      if (!o.isMesh) return;
      let c = clones.get(o.material);
      if (!c) {
        c = o.material.clone();
        c.userData.base = { opacity: c.opacity, transparent: c.transparent, color: c.color.clone() };
        clones.set(o.material, c);
      }
      o.material = c;
    });
    const mats = [...clones.values()];
    // x-ray ghost: every mesh gets a twin that shares its geometry and draws as additive fresnel glass,
    // so overlapping shells add up cleanly in any draw order instead of sorting into grey smears
    let ghost = null;
    if (L.xray) {
      ghost = makeGhostMaterial();
      const twins = [];
      g.traverse(o => { if (o.isMesh) twins.push(o); });
      for (const o of twins) {
        const tw = new THREE.Mesh(o.geometry, ghost);
        tw.castShadow = tw.receiveShadow = false;
        tw.renderOrder = 2;
        tw.visible = false;
        o.add(tw);
        o.userData.twin = tw;
      }
    }
    const anchors = g.userData.anchors || (L.key === 'oilFeed' ? { feed: oil.userData.anchors?.feed } : L.key === 'oilDrain' ? { drain: oil.userData.anchors?.drain } : {});
    parts[L.key] = { ...L, holder, group: g, mats, ghost, anchors, fade: 1, xrayF: 0, applied: '' };
  }
  // the oil-line anchors are given relative to the CHRA origin; the feed/drain groups share it
  const spinners = LAYOUT.filter(L => L.spin).map(L => parts[L.key].group);
  const cages = parts.bearing.group.userData.cages || [];
  const wgArm = parts.turbineHousing.group.userData.wgArm || null;
  const actRod = parts.actuator.group.userData.rod || null;
  const rodDir = v(9.3 - 1.0, 0, 3.0).normalize();

  let explode = 0;
  function setExplode(e) {
    explode = e;
    for (const p of Object.values(parts)) {
      const t = ease(clamp((e - p.at) / SPAN));
      p.holder.position.copy(p.home).addScaledVector(p.off, t);
    }
  }
  // fade: 1 = solid, 0 = invisible; x-ray: housings become tinted glass
  function applyMats() {
    for (const p of Object.values(parts)) {
      const xr = p.xray ? p.xrayF : 0;
      // solid fades out completely as the glass twin fades in (cross-over is quick so they rarely overlap)
      const solid = p.fade * (1 - clamp(xr * 1.6));
      const glass = p.fade * clamp(xr * 1.25);
      const sig = solid.toFixed(3) + '|' + glass.toFixed(3);
      if (sig === p.applied) continue;      // nothing changed for this part
      p.applied = sig;
      for (const m of p.mats) {
        const b = m.userData.base;
        const op = b.opacity * solid;
        const tr = op < 0.999;
        m.transparent = tr;                 // no needsUpdate: transparency does not change the shader program
        m.opacity = op;
        m.depthWrite = !tr || op > 0.6;
        m.visible = op > 0.004;
      }
      if (p.ghost) {
        p.ghost.uniforms.uOpacity.value = glass;
        p.group.traverse(o => { if (o.userData.twin) o.userData.twin.visible = glass > 0.004; });
      }
      p.holder.visible = solid > 0.004 || glass > 0.004;
    }
  }
  function setFade(key, f) { parts[key].fade = f; }
  function setAllFade(f) { for (const p of Object.values(parts)) p.fade = f; }
  function setXray(x) { for (const p of Object.values(parts)) p.xrayF = x; }

  let shaftAngle = 0;
  function spin(dAngle) {
    shaftAngle -= dAngle;      // the shaft turns in the −ψ direction
    for (const s of spinners) s.rotation.x = shaftAngle;
    cages.forEach(c => (c.rotation.x = shaftAngle * 0.4));
  }
  function setWastegate(w) {
    if (wgArm) wgArm.rotation.y = -0.1 * w;
    if (actRod) actRod.position.copy(rodDir).multiplyScalar(0.34 * w);
  }

  // world position of a named anchor on a part
  const tmp = new THREE.Vector3();
  function anchorWorld(key, name, out = new THREE.Vector3()) {
    const p = parts[key];
    const a = p?.anchors?.[name];
    if (!a) return null;
    return p.group.localToWorld(out.copy(a));
  }
  function partCenter(key, out = new THREE.Vector3()) {
    const box = new THREE.Box3().setFromObject(parts[key].holder);
    return box.getCenter(out);
  }
  function partSize(key) {
    const box = new THREE.Box3().setFromObject(parts[key].holder);
    return box.getSize(tmp).length();
  }

  setExplode(0);
  applyMats();
  return { root, parts, setExplode, setFade, setAllFade, setXray, applyMats, spin, setWastegate, anchorWorld, partCenter, partSize,
    get explode() { return explode; } };
}

const XRAY_TINT = new THREE.Color(0x7fc8ff);

// additive fresnel "glass": faint faces, bright silhouettes and creases
function makeGhostMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: XRAY_TINT.clone() } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.4);
        float a = (0.025 + 0.4 * rim) * uOpacity;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
