// Procedural three-rotor exhaust note. An AudioWorklet fires one excitation per rotor flank
// (3 per shaft rev), each feeding a small bank of resonators (pipe body + rasp), then:
// waveshaper → rpm-tracked lowpass → 120 Hz peak → compressor. Induction hiss runs beside it.
// Created lazily from a user gesture (browsers block audio until then).

const WORKLET = `
const TAU = Math.PI * 2;
const OUT_GAIN = 4;
class Rotary extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 0, minValue: 0, maxValue: 12000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'starter', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'cut', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.phase = 0; this.rotor = 0; this.env = 0; this.jit = 0; this.popEnv = 0; this.t = 0;
    this.rpmS = 0; this.x1 = 0; this.x2 = 0; this.dcx = 0;
    // resonators: [freq, decay radius, weight]
    this.res = [[92, 0.9965, 1.0], [236, 0.993, 0.55], [540, 0.985, 0.32], [1650, 0.955, 0.12]].map(([f, r, w]) => ({ f, r, w, y1: 0, y2: 0 }));
    this.gainR = [1.0, 0.84, 0.93];
    this.port.onmessage = e => { if (e.data === 'pop') this.popEnv = 3 + 1.5 * Math.random(); };
  }
  process(_, outputs, p) {
    const out = outputs[0][0], n = out.length, sr = sampleRate;
    const rpmT = p.rpm[0], thr = p.throttle[0], starter = p.starter[0], cut = p.cut[0] > 0.5;
    const res = this.res;
    for (const r of res) { r.c = 2 * r.r * Math.cos(TAU * r.f / sr); r.r2 = r.r * r.r; r.g = (1 - r.r2) / 2; }
    for (let i = 0; i < n; i++) {
      this.rpmS += (rpmT - this.rpmS) * 0.0015;
      const rpm = this.rpmS, fFire = rpm / 60 * 3;
      this.t += 1 / sr;
      if (fFire > 1) {
        this.phase += fFire / sr * (1 + this.jit);
        if (this.phase >= 1) {
          this.phase -= 1;
          this.rotor = (this.rotor + 1) % 3;
          const idleness = Math.max(0, 1 - rpm / 2200);
          this.jit = (Math.random() - 0.5) * 0.16 * idleness;               // lumpy idle timing
          let amp = (0.32 + 0.68 * Math.pow(thr, 0.7)) * (0.55 + 0.45 * Math.min(1, rpm / 3000));
          amp *= 1 + 0.6 * Math.min(1, Math.max(0, (rpm - 5000) / 4000));   // short high-rpm pulses carry less energy
          amp *= this.gainR[this.rotor] * (1 + (Math.random() - 0.5) * 0.5 * idleness);
          if (starter > 0.5) amp = 0.12 + Math.random() * 0.05;              // cranking: compression puffs only
          if (cut) amp *= 0.04;
          this.env = amp;
          this.tau = Math.min(0.0045, 0.42 / Math.max(fFire, 1));
        }
      }
      const dec = Math.exp(-1 / (sr * (this.tau || 0.004)));
      const noise = Math.random() * 2 - 1;
      let x = this.env * (1 + 0.55 * noise);
      this.env *= dec;
      let pop = 0;
      if (this.popEnv > 0.001) { pop = this.popEnv * noise; x += pop * 1.4; this.popEnv *= 0.9975; }
      // band-pass resonators: zeros at DC and Nyquist, ~unity gain at their peak
      const bx = x - this.x2;
      this.x2 = this.x1; this.x1 = x;
      let y = 0;
      for (const r of res) {
        const v = r.c * r.y1 - r.r2 * r.y2 + bx * r.g;
        r.y2 = r.y1; r.y1 = v; y += v * r.w;
      }
      y = y * OUT_GAIN + bx * 0.06 + pop * 0.45;
      // DC blocker
      this.dc = y - this.dcx + 0.995 * (this.dc || 0); this.dcx = y; y = this.dc;
      if (starter > 0) {                                                       // starter whine + gear rattle
        const ws = 980 + 140 * Math.sin(TAU * 11.5 * this.t);
        this.sPh = ((this.sPh || 0) + ws / sr) % 1;
        y += starter * (0.04 * Math.sin(TAU * this.sPh) + 0.018 * Math.sin(TAU * 2 * this.sPh) + 0.012 * noise);
      }
      out[i] = y;
    }
    return true;
  }
}
registerProcessor('rotary', Rotary);
`;

export class EngineAudio {
  constructor() { this.ctx = null; this.muted = false; this.ready = null; }

  // call from a click/keydown handler
  ensure() {
    if (!this.ready) this.ready = this.#build().catch(err => { console.warn('Engine audio unavailable:', err); this.ready = null; });
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ready;
  }

  async #build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, 'rotary', { outputChannelCount: [1] });

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 2.4) / Math.tanh(2.4); }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.8;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking'; peak.frequency.value = 120; peak.Q.value = 1.1; peak.gain.value = 5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.55;
    node.connect(shaper).connect(lp).connect(peak).connect(comp).connect(master).connect(ctx.destination);

    // induction hiss
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf; hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.3;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    hiss.connect(bp).connect(hissGain).connect(master);
    hiss.start();

    Object.assign(this, { ctx, node, lp, bp, hissGain, master });
    if (ctx.state === 'suspended') await ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  update(sim) {
    const events = sim.takeEvents();
    if (!this.node) return;
    const t = this.ctx.currentTime, P = this.node.parameters;
    const rpm = sim.rpm, thr = sim.throttle;
    P.get('rpm').setValueAtTime(rpm, t);
    P.get('throttle').setValueAtTime(thr, t);
    P.get('starter').setValueAtTime(sim.starter, t);
    P.get('cut').setValueAtTime(sim.cut ? 1 : 0, t);
    this.lp.frequency.setTargetAtTime(500 + rpm * 0.85 + thr * 1800, t, 0.03);
    this.bp.frequency.setTargetAtTime(700 + rpm * 0.3, t, 0.05);
    this.hissGain.gain.setTargetAtTime(sim.running ? 0.004 + 0.1 * thr * (rpm / 9000) : 0, t, 0.05);
    for (const e of events) if (e === 'pop') this.node.port.postMessage('pop');
  }
}
