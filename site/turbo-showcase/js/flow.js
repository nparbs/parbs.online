// "How it works": a small turbo/engine sim, particle streams for intake air and exhaust,
// glass plumbing between the turbo and a see-through engine, and an optional whistle / blow-off sound.

import * as THREE from 'three';
import { volute, sweep, lathe, V3, TAU } from './geo.js?v=4';
import { buildEngine } from './parts/engine.js?v=4';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

export const ENGINE_POS = V3(0, 14, 0);
const C_X = -3.4;   // compressor volute plane (world x)
const T_X = 3.3;    // turbine volute plane (world x)

// same parameters as the housings (world x), used only for their centre-line paths
const CV = volute({ x: C_X, rc0: 5.75, rc1: 6.45, tr0: 0.55, tr1: 1.55, th0: -Math.PI / 2 + 0.4, th1: 3 * Math.PI / 2, dir: -1, outLen: 4.2, outR: 1.3, nt: 8, nr: 4 });
const TV = volute({ x: T_X, rc0: 4.55, rc1: 5.6, tr0: 0.45, tr1: 1.75, th0: -Math.PI / 2 - TAU + 0.4, th1: -Math.PI / 2, dir: 1, outLen: 3.6, outR: 1.45, nt: 8, nr: 4 });
const SPIRAL = 0.78;   // volute(): fraction of the path that is spiral

// ---------------------------------------------------------------- sim
export class TurboSim {
  constructor() {
    this.throttle = 0; this.target = 0;
    this.rpmE = 1100; this.rpmT = 22000; this.boost = -12; this.wg = 0;
    this.crank = 0; this.bov = 0; this.hold = false;
    this.script = [[1.6, 0.05], [4.8, 1], [2.4, 0.05], [2.2, 0.4], [1.2, 0.05], [3.4, 1]];
    this.si = 0; this.st = 0;
    this.onBov = null;
  }
  step(dt) {
    if (this.hold) this.target = 1;
    else {
      this.st += dt;
      if (this.st > this.script[this.si][0]) { this.st = 0; this.si = (this.si + 1) % this.script.length; }
      this.target = this.script[this.si][1];
    }
    const prev = this.throttle;
    this.throttle += (this.target - this.throttle) * clamp(dt * 9);
    // lift-off with boost in the pipes: blow-off valve vents
    if (prev - this.throttle > 0.02 && this.boost > 6 && this.bov <= 0.05) { this.bov = 1; this.onBov?.(this.boost); }
    this.bov = Math.max(0, this.bov - dt * 1.6);
    const thr = this.throttle;
    // engine speed follows throttle and boost
    const rpmTarget = 1100 + 5600 * Math.pow(thr, 0.8) * (0.55 + 0.45 * clamp(this.boost / 18 + 0.4));
    this.rpmE += (rpmTarget - this.rpmE) * clamp(dt * 1.1);
    // exhaust energy spins the turbo; the open wastegate bleeds some of it past the wheel
    const energy = (this.rpmE / 6700) * (0.25 + 0.75 * thr);
    const tTarget = 22000 + 128000 * Math.pow(clamp(energy), 1.25) * (1 - 0.6 * this.wg);
    const tau = tTarget > this.rpmT ? 1.3 : 0.75;          // spool lag
    this.rpmT += (tTarget - this.rpmT) * clamp(dt / tau);
    const comp = 30 * Math.pow(this.rpmT / 150000, 2);
    const raw = -13.5 + 13.5 * thr + comp * thr;
    this.boost += (raw - this.boost) * clamp(dt * 6);
    // wastegate cracks at 17 psi, fully open by 21
    const wgT = clamp((this.boost - 17) / 4);
    this.wg += (wgT - this.wg) * clamp(dt * 5);
    this.crank += (this.rpmE / 60) * TAU * dt * 0.028;    // engine shown in slow motion
  }
  get load() { return clamp(this.rpmT / 150000); }
}

// ---------------------------------------------------------------- particles
const VERT = `
attribute float size; attribute vec3 color; attribute float alpha;
varying vec3 vC; varying float vA;
uniform float uScale;
void main() {
  vC = color; vA = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vC; varying float vA;
uniform float uOpacity;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vC * (0.6 + 0.8 * a), a * vA * uOpacity);
}`;

const TMP_C = new THREE.Color(), WHITE = new THREE.Color(0xffffff);
const EMPH = { air: 1, exh: 1 }, PHASE = [0, Math.PI, Math.PI, 0];

class Stream {
  constructor(n, router, colors, size) {
    this.n = n; this.router = router; this.colors = colors;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.p = Array.from({ length: n }, () => ({ live: false }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 600 }, uOpacity: { value: 1 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.baseSize = size;
    this.acc = 0;
    this.free = Array.from({ length: n }, (_, k) => n - 1 - k);   // stack of dead slots
    for (let k = 0; k < n; k++) this.size[k] = size * (0.8 + 0.4 * Math.sin(k * 12.9898));
  }
  spawn(kind) {
    if (!this.free.length) return;
    const r = this.router(kind);
    if (!Number.isFinite(r.cum[r.cum.length - 1])) return;      // never let a bad route take a slot
    const k = this.free.pop();
    Object.assign(this.p[k], { live: true, pts: r.pts, cum: r.cum, stage: r.stage, s: 0, i: 0, speed: rnd(0.85, 1.15), kind });
  }
  kill(k) { this.p[k].live = false; this.alpha[k] = 0; this.free.push(k); }
  update(dt, rate, speed, fade) {
    this.acc += rate * dt;
    while (this.acc >= 1) { this.acc -= 1; this.spawn(); }
    const tmpC = TMP_C;
    for (let k = 0; k < this.n; k++) {
      const q = this.p[k];
      if (!q.live) continue;
      q.s += speed * q.speed * dt;
      const L = q.cum[q.cum.length - 1];
      if (!(q.s < L)) { this.kill(k); continue; }
      while (q.cum[q.i + 1] < q.s) q.i++;
      const i = q.i, t = (q.s - q.cum[i]) / (q.cum[i + 1] - q.cum[i] || 1);
      const a = i * 3, b = a + 3;
      this.pos[k * 3] = lerp(q.pts[a], q.pts[b], t);
      this.pos[k * 3 + 1] = lerp(q.pts[a + 1], q.pts[b + 1], t);
      this.pos[k * 3 + 2] = lerp(q.pts[a + 2], q.pts[b + 2], t);
      const st = lerp(q.stage[i], q.stage[i + 1], t);   // 0..1 colour progress along the route
      this.colors(st, q.kind, tmpC);
      this.col[k * 3] = tmpC.r; this.col[k * 3 + 1] = tmpC.g; this.col[k * 3 + 2] = tmpC.b;
      const life = q.s / L;
      this.alpha[k] = clamp(life * 12) * clamp((1 - life) * 10) * fade;
    }
    const at = this.points.geometry.attributes;
    at.position.needsUpdate = at.color.needsUpdate = at.alpha.needsUpdate = true;
  }
}

// polyline helpers
function route() {
  const pts = [], stage = [];
  return {
    pts, stage,
    add(p, st) { pts.push(p.x, p.y, p.z); stage.push(st); },
    done() {
      const cum = [0];
      for (let i = 3; i < pts.length; i += 3) cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2], pts[i + 2] - pts[i - 1]));
      return { pts: new Float32Array(pts), cum, stage };
    },
  };
}
const ax = (x, r, psi) => V3(x, r * Math.cos(psi), r * Math.sin(psi));
const jitter = (p, s) => p.clone().add(V3(rnd(-s, s), rnd(-s, s), rnd(-s, s)));
function curvePts(curve, n, st0, st1, R, jit) {
  for (let i = 0; i <= n; i++) R.add(jitter(curve.getPoint(i / n), jit), lerp(st0, st1, i / n));
}

// ---------------------------------------------------------------- build
export function buildFlow(M) {
  const group = new THREE.Group();
  const engine = buildEngine(M);
  engine.position.copy(ENGINE_POS);
  group.add(engine);
  const engineMats = new Set();
  engine.traverse(o => {
    if (!(o.isMesh || o.isLineSegments)) return;
    const m = o.material;
    if (m.blending === THREE.AdditiveBlending) return;     // combustion flashes drive their own opacity
    m.userData.baseOp = m.opacity;
    m.userData.baseTr = m.transparent;
    engineMats.add(m);
  });
  let lastF = -1;
  const flashes = [0, 0, 0, 0];
  const ports = engine.userData.ports || {};
  const intakePorts = (ports.intake || [-5.25, -1.75, 1.75, 5.25].map(x => V3(x, 4, 3.25))).map(p => p.clone().add(ENGINE_POS));
  const exhPorts = (ports.exhaust || [-5.25, -1.75, 1.75, 5.25].map(x => V3(x, 4, -3.25))).map(p => p.clone().add(ENGINE_POS));

  const cOut = CV.end.p, tIn = TV.end.p;
  const plenY = intakePorts[0].y, plenZ = intakePorts[0].z + 2.7;
  const charge = new THREE.CatmullRomCurve3([
    cOut.clone(), V3(cOut.x, cOut.y + 2.6, cOut.z), V3(-6.8, 9.6, plenZ), V3(-9.4, 13.5, plenZ), V3(-9.4, plenY - 1.4, plenZ), V3(-7.6, plenY, plenZ),
  ], false, 'catmullrom', 0.3);
  const runnersIn = intakePorts.map(p => new THREE.CatmullRomCurve3([V3(p.x, plenY, plenZ), V3(p.x, plenY + 0.2, plenZ - 1.4), p.clone()]));
  const collector = V3(tIn.x, tIn.y + 5.0, tIn.z);
  const runnersEx = exhPorts.map(p => new THREE.CatmullRomCurve3([
    p.clone(), V3(p.x, p.y - 0.8, p.z - 1.8), V3(lerp(p.x, collector.x, 0.6), lerp(p.y, collector.y, 0.6), collector.z - 0.3), collector.clone(), tIn.clone(),
  ], false, 'catmullrom', 0.4));
  const downpipe = new THREE.CatmullRomCurve3([V3(7.2, 0, 0), V3(11, 0, 0), V3(15, -1.5, 0), V3(19, -5, 0), V3(21, -9, 0)], false, 'catmullrom', 0.3);
  const podX0 = -15.2, podX1 = -10.4;

  // ---- glass plumbing
  const glass = M.glass.clone();
  const tube = (curve, r, nt = 64) => {
    const m = new THREE.Mesh(sweep(t => ({ p: curve.getPoint(t), r }), { nt, nr: 24 }), glass);
    m.renderOrder = 2; group.add(m); return m;
  };
  tube(charge, 1.2, 90);
  runnersIn.forEach(c => tube(c, 0.62, 20));
  runnersEx.forEach(c => tube(c, 0.55, 48));
  tube(downpipe, 2.9, 60);
  const plenum = new THREE.Mesh(lathe([[-7.8, 0], [-7.8, 1.3], [7.2, 1.3], [7.2, 0]], { segs: 32 }), glass);
  plenum.position.set(0, plenY, plenZ); plenum.renderOrder = 2; group.add(plenum);
  // pod air filter on the compressor inlet
  const pod = new THREE.Mesh(lathe([[podX0, 0], [podX0, 3.6], [podX1 - 0.6, 4.2], [podX1, 3.8]], { segs: 48 }), glass);
  pod.renderOrder = 2; group.add(pod);
  const pleats = new THREE.Group();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * TAU;
    const g = new THREE.Mesh(new THREE.BoxGeometry(podX1 - podX0 - 0.8, 0.03, 0.18), M.glassEdge ? new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.25, depthWrite: false }) : glass);
    g.position.set((podX0 + podX1) / 2 - 0.3, 3.85 * Math.cos(a), 3.85 * Math.sin(a));
    g.rotation.x = a;
    pleats.add(g);
  }
  group.add(pleats);
  const glassMats = [glass, ...pleats.children.map(c => c.material)];

  // ---- routes
  const cTh0 = -Math.PI / 2 + 0.4, cTh1 = 3 * Math.PI / 2;
  const airRoute = () => {
    const R = route();
    const psi0 = rnd(0, TAU), r0 = Math.sqrt(Math.random()) * 3.2;
    R.add(ax(podX0 - 3.5, r0 * 1.2, psi0), 0);
    R.add(ax(podX0 + 0.5, r0, psi0), 0.02);
    const r1 = 0.9 + Math.sqrt(Math.random()) * 2.0;
    R.add(ax(-8.5, lerp(r0, r1, 0.5), psi0), 0.05);
    R.add(ax(-6.05, r1, psi0), 0.1);
    // through the wheel: spun in the −ψ direction and flung outward
    let psi = psi0;
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      psi -= 0.24;
      R.add(ax(lerp(-6.05, -3.25, Math.pow(u, 1.6)), lerp(r1, 4.15, Math.pow(u, 2.2)), psi), lerp(0.1, 0.32, u));
    }
    // diffuser
    for (let i = 1; i <= 3; i++) { psi -= 0.18; R.add(ax(-3.3, lerp(4.15, 5.6, i / 3), psi), 0.34 + i * 0.02); }
    // into the volute at this angle, then round to the outlet
    let th = (-psi) % TAU; while (th < cTh0) th += TAU; while (th > cTh1) th -= TAU;
    // the volute covers TAU − 0.4 rad, so a few angles fall in the tongue gap: clamp them onto the scroll
    const t0 = clamp((th - cTh0) / (cTh1 - cTh0)) * SPIRAL;
    const off = V3(rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(-0.5, 0.5));
    const steps = Math.max(2, Math.round((1 - t0) * 26));
    for (let i = 0; i <= steps; i++) {
      const t = lerp(t0, 1, i / steps), s = CV.path(t);
      R.add(s.p.clone().addScaledVector(off, s.r * 0.9), lerp(0.4, 0.55, i / steps));
    }
    curvePts(charge, 22, 0.55, 0.85, R, 0.45);
    const k = (Math.random() * 4) | 0, c = runnersIn[k];
    R.add(jitter(V3(lerp(-7.6, c.points[0].x, 0.5), plenY, plenZ), 0.5), 0.88);
    curvePts(c, 6, 0.9, 1, R, 0.25);
    return R.done();
  };
  const tTh0 = -Math.PI / 2 - TAU + 0.4, tTh1 = -Math.PI / 2;
  let wgOpen = 0;
  const exhRoute = () => {
    const R = route();
    const k = (Math.random() * 4) | 0;
    curvePts(runnersEx[k], 18, 0, 0.18, R, 0.3);
    const off = V3(rnd(-0.55, 0.55), rnd(-0.55, 0.55), rnd(-0.55, 0.55));
    const bypass = Math.random() < wgOpen * 0.55;
    // into the volute from the inlet leg, spiralling inward (t decreasing)
    const tExit = bypass ? rnd(0.55, 0.7) * SPIRAL : rnd(0.02, 0.98) * SPIRAL;
    const steps = Math.max(3, Math.round((1 - tExit) * 30));
    for (let i = 0; i <= steps; i++) {
      const t = lerp(1, tExit, i / steps), s = TV.path(t);
      R.add(s.p.clone().addScaledVector(off, s.r * 0.85), lerp(0.2, 0.4, i / steps));
    }
    const th = tTh0 + (tExit / SPIRAL) * (tTh1 - tTh0);
    let psi = th;
    if (bypass) {
      // straight through the open wastegate port into the outlet, skipping the wheel
      R.add(ax(T_X + 1.4, 3.9, psi - 0.1), 0.42);
      R.add(ax(6.0, 2.6, psi - 0.25), 0.45);
      R.add(ax(7.2, 2.0, psi - 0.3), 0.5);
    } else {
      R.add(ax(3.05, 3.55, psi), 0.42);
      const r2 = 1.1 + Math.random() * 1.7;
      for (let i = 1; i <= 8; i++) {
        const u = i / 8;
        psi -= 0.2;
        R.add(ax(lerp(3.05, 5.5, Math.pow(u, 0.7)), lerp(3.4, r2, Math.pow(u, 0.6)), psi), lerp(0.42, 0.78, u));
      }
      R.add(ax(7.2, r2 * 0.9, psi - 0.2), 0.82);
    }
    const j = Math.sqrt(Math.random()) * 2.2, ja = rnd(0, TAU);
    for (let i = 1; i <= 14; i++) {
      const p = downpipe.getPoint(i / 14);
      R.add(p.add(V3(0, j * Math.cos(ja) * 0.8, j * Math.sin(ja))), lerp(0.82, 1, i / 14));
    }
    return R.done();
  };
  // blow-off: a puff vented from the charge pipe
  const bovRoute = () => {
    const R = route();
    const p0 = charge.getPoint(0.42);
    const dir = V3(rnd(-1, 0.2), rnd(0.4, 1.2), rnd(0.6, 1.4)).normalize();
    for (let i = 0; i <= 10; i++) R.add(p0.clone().addScaledVector(dir, i * 0.55 * (1 + i * 0.08)).add(V3(rnd(-0.2, 0.2), rnd(-0.2, 0.2), rnd(-0.2, 0.2))), i / 10);
    return R.done();
  };

  const AIR_A = new THREE.Color(0x2a8cff), AIR_B = new THREE.Color(0x8fe9ff), AIR_C = new THREE.Color(0xffd7a1);
  const EX_A = new THREE.Color(0xff3d12), EX_B = new THREE.Color(0xffa040), EX_C = new THREE.Color(0x6a5450);
  const air = new Stream(1800, () => airRoute(), (st, _, c) => {
    if (st < 0.3) c.copy(AIR_A).lerp(AIR_B, st / 0.3);
    else c.copy(AIR_B).lerp(AIR_C, clamp((st - 0.3) / 0.4) * 0.55);   // heat of compression
  }, 2.0);
  const exh = new Stream(1600, () => exhRoute(), (st, _, c) => {
    if (st < 0.4) c.copy(EX_A).lerp(EX_B, st / 0.4);
    else c.copy(EX_B).lerp(EX_C, clamp((st - 0.4) / 0.45));       // energy taken out by the turbine
  }, 2.2);
  const bov = new Stream(260, () => bovRoute(), (st, _, c) => c.copy(AIR_B).lerp(WHITE, st), 3.4);
  group.add(air.points, exh.points, bov.points);

  let bovBurst = 0;
  return {
    group, engine,
    burstBov(n = 160) { bovBurst += n; },
    update(dt, sim, vis, emph = EMPH) {
      const f = clamp(vis);
      if (f <= 0.01) {                       // hidden: no particle, buffer or material work at all
        if (group.visible) group.visible = false;
        return;
      }
      group.visible = true;
      wgOpen = sim.wg;
      const load = sim.load, thr = sim.throttle;
      air.update(dt, f > 0.02 ? 50 + 520 * load * (0.3 + 0.7 * thr) : 0, 6 + 26 * load * (0.4 + 0.6 * thr), f * emph.air);
      exh.update(dt, f > 0.02 ? 40 + 420 * (sim.rpmE / 6700) * (0.3 + 0.7 * thr) : 0, 5 + 18 * (sim.rpmE / 6700), f * emph.exh);
      if (bovBurst > 0) { const n = Math.min(bovBurst, 40); for (let i = 0; i < n; i++) bov.spawn(); bovBurst -= n; }
      bov.update(dt, 0, 9, f);
      // engine: crank + combustion flashes (same phase rule as the valve timing in engine.js)
      const set = engine.userData.setCrank;
      if (set) {
        for (let i = 0; i < 4; i++) {
          const c = ((sim.crank + PHASE[i] + (i === 1 || i === 3 ? TAU : 0)) % (2 * TAU) + 2 * TAU) % (2 * TAU);
          flashes[i] = c < 0.9 ? (1 - c / 0.9) * (0.35 + 0.65 * thr) : 0;
        }
        set(sim.crank, flashes);
      }
      // fades only when the visibility changes
      if (Math.abs(f - lastF) > 0.001) {
        lastF = f;
        for (const m of glassMats) m.opacity = (m === glass ? 0.12 : 0.25) * f;
        for (const m of engineMats) {
          const op = m.userData.baseOp * f, tr = m.userData.baseTr || op < 0.999;
          m.transparent = tr;
          m.opacity = op;
        }
      }
    },
    setScale(h) { air.mat.uniforms.uScale.value = exh.mat.uniforms.uScale.value = bov.mat.uniforms.uScale.value = h * 0.65; },
  };
}

// ---------------------------------------------------------------- sound (off until the visitor turns it on)
export class TurboAudio {
  constructor() {
    this.on = false; this.ctx = null;
    // silence background tabs: rAF stops there, so the drone would hang on one note
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx || !this.on) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }
  start() {
    if (!this.ctx) {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(ctx.destination);
      // whistle: two detuned sines through a band-pass
      this.osc = [ctx.createOscillator(), ctx.createOscillator()];
      this.osc[1].detune.value = 9;
      this.wg = ctx.createGain(); this.wg.gain.value = 0;
      this.osc.forEach(o => { o.type = 'sine'; o.connect(this.wg); o.start(); });
      this.wg.connect(this.out);
      // rumble: filtered noise for the exhaust
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }
      this.noiseBuf = buf;
      const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 180;
      this.rg = ctx.createGain(); this.rg.gain.value = 0;
      n.connect(this.lp); this.lp.connect(this.rg); this.rg.connect(this.out); n.start();
    }
    clearTimeout(this.sleep);
    this.ctx.resume();
    this.on = true;
    this.out.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.1);
  }
  stop() {
    this.on = false;
    if (!this.ctx) return;
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    clearTimeout(this.sleep);
    this.sleep = setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 400);   // stop the audio thread once faded
  }
  update(sim, vis) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, l = sim.load;
    const f = 900 + 5200 * l;
    this.osc[0].frequency.setTargetAtTime(f, t, 0.05);
    this.osc[1].frequency.setTargetAtTime(f * 1.5, t, 0.05);
    this.wg.gain.setTargetAtTime(vis * 0.05 * l * l, t, 0.08);
    this.lp.frequency.setTargetAtTime(120 + 260 * (sim.rpmE / 6700), t, 0.1);
    this.rg.gain.setTargetAtTime(vis * (0.08 + 0.25 * sim.throttle), t, 0.1);
  }
  bov(psi) {
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 * clamp(psi / 20, 0.3, 1), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    hp.frequency.setValueAtTime(4200, t); hp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    s.connect(hp); hp.connect(g); g.connect(this.out);
    s.onended = () => { s.disconnect(); hp.disconnect(); g.disconnect(); };
    s.start(t, Math.random()); s.stop(t + 0.7);
  }
}
