// FD-inspired gauge cluster (SVG) plus the engine controls for the installed-car section.
// Big centre tach with a spring-damped needle, oil pressure left, water temp right,
// warning lamps, LCD gear/odometer, shift light.

import { LIMIT_RPM, SHIFT_RPM } from './sim.js';
import { PAINTS } from './car.js';

const NS = 'http://www.w3.org/2000/svg';
const rad = d => (d * Math.PI) / 180;
const pt = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

// spring-damped needle
class Needle {
  constructor(k = 420, z = 0.62) { this.x = 0; this.v = 0; this.k = k; this.c = 2 * Math.sqrt(k) * z; }
  step(target, dt) {
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      this.v += (this.k * (target - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

function tachSVG() {
  const cx = 160, cy = 118, R = 96, A0 = -135, A1 = 135;
  const ang = v => A0 + (A1 - A0) * (v / 10);
  let ticks = '', nums = '';
  for (let i = 0; i <= 20; i++) {
    const v = i / 2, a = ang(v), major = i % 2 === 0, red = v >= 9;
    const [x0, y0] = pt(cx, cy, R - (major ? 14 : 8), a), [x1, y1] = pt(cx, cy, R - 2, a);
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${red ? 'tk red' : 'tk'}${major ? ' mj' : ''}"/>`;
    if (major) { const [tx, ty] = pt(cx, cy, R - 28, a); nums += `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}" class="num${red ? ' red' : ''}">${v}</text>`; }
  }
  const small = (gx, label, lo, hi, id, unit) => {
    const r = 46, b0 = -120, b1 = 120;
    let t = '';
    for (let i = 0; i <= 4; i++) {
      const a = b0 + (b1 - b0) * (i / 4), [x0, y0] = pt(gx, 140, r - 8, a), [x1, y1] = pt(gx, 140, r - 1, a);
      t += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="tk mj"/>`;
    }
    const [lx, ly] = pt(gx, 140, r - 18, b0), [hx, hy] = pt(gx, 140, r - 18, b1);
    return `<g class="sub">
      <circle cx="${gx}" cy="140" r="${r + 4}" class="bezel"/>
      <path d="${arc(gx, 140, r - 1, b0, b1)}" class="track"/>${t}
      <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" class="lo">${lo}</text>
      <text x="${hx.toFixed(1)}" y="${(hy + 4).toFixed(1)}" class="lo">${hi}</text>
      <text x="${gx}" y="${140 + 26}" class="lbl">${label}</text>
      <text x="${gx}" y="${140 + 37}" class="unit">${unit}</text>
      <g id="${id}"><line x1="${gx}" y1="140" x2="${gx}" y2="${140 - r + 10}" class="ndl"/></g>
      <circle cx="${gx}" cy="140" r="5" class="hub"/>
    </g>`;
  };
  return `<svg viewBox="-64 0 448 230" class="gauges" aria-hidden="true">
    ${small(-6, 'OIL', '0', '10', 'nOil', 'kg/cm²')}
    ${small(326, 'WATER', 'C', 'H', 'nWater', '')}
    <circle cx="${cx}" cy="${cy}" r="${R + 8}" class="bezel"/>
    <path d="${arc(cx, cy, R - 1, ang(9), ang(10))}" class="redzone"/>
    ${ticks}${nums}
    <text x="${cx}" y="${cy - 34}" class="lbl">×1000 r/min</text>
    <circle id="shift" cx="${cx}" cy="${cy - 56}" r="5" class="shift"/>
    <g class="lamps">
      <g id="lBat"><rect x="${cx - 58}" y="${cy + 26}" width="32" height="15" rx="3"/><text x="${cx - 42}" y="${cy + 37}">CHG</text></g>
      <g id="lOil"><rect x="${cx - 16}" y="${cy + 26}" width="32" height="15" rx="3"/><text x="${cx}" y="${cy + 37}">OIL</text></g>
      <g id="lEng"><rect x="${cx + 26}" y="${cy + 26}" width="32" height="15" rx="3"/><text x="${cx + 42}" y="${cy + 37}">ENG</text></g>
    </g>
    <rect x="${cx - 40}" y="${cy + 50}" width="80" height="32" rx="3" class="lcd"/>
    <text id="lcdGear" x="${cx - 26}" y="${cy + 73}" class="lcdg">N</text>
    <text id="lcdOdo" x="${cx + 34}" y="${cy + 64}" class="lcdt">ODO</text>
    <text id="lcdOdoN" x="${cx + 34}" y="${cy + 76}" class="lcdt">013 207</text>
    <g id="nTach"><line x1="${cx}" y1="${cy + 14}" x2="${cx}" y2="${cy - R + 6}" class="ndl big"/></g>
    <circle cx="${cx}" cy="${cy}" r="9" class="hub"/>
  </svg>`;
}

export class Cluster {
  constructor(sim, { onToggle, onPaint, onMute, onDemo, onUnlock }) {
    this.sim = sim;
    this.el = document.createElement('div');
    this.el.className = 'cluster';
    this.el.innerHTML = `
      ${tachSVG()}
      <div class="ctl mono">
        <button class="c-start" type="button">Start</button>
        <button class="c-rev" type="button" title="Hold to rev (or hold space)">Hold to rev</button>
        <button class="c-demo" type="button">Rev demo</button>
        <button class="c-mute" type="button" aria-pressed="false" title="Mute">Sound on</button>
      </div>
      <div class="paints" role="group" aria-label="Paint">
        ${PAINTS.map(([n, hex], i) => `<button type="button" title="${n}" aria-label="${n}" style="--p:#${hex.toString(16).padStart(6, '0')}" class="${i ? '' : 'on'}"></button>`).join('')}
      </div>`;
    document.body.appendChild(this.el);
    const $ = q => this.el.querySelector(q);
    this.n = { tach: $('#nTach'), oil: $('#nOil'), water: $('#nWater'), shift: $('#shift'), lamps: [$('#lBat'), $('#lOil'), $('#lEng')], start: $('.c-start'), mute: $('.c-mute'), gear: $('#lcdGear') };
    this.tach = new Needle(520, 0.58);
    this.oil = new Needle(90, 0.8);
    this.water = new Needle(40, 0.9);
    this.visible = false;
    this.holding = false;

    $('.c-start').addEventListener('click', () => { onUnlock(); onToggle(); });
    const rev = $('.c-rev');
    const down = e => { e.preventDefault(); onUnlock(); this.holding = true; rev.classList.add('on'); };
    const up = () => { this.holding = false; rev.classList.remove('on'); };
    rev.addEventListener('pointerdown', down);
    addEventListener('pointerup', up);
    rev.addEventListener('pointerleave', up);
    rev.addEventListener('contextmenu', e => e.preventDefault());
    $('.c-demo').addEventListener('click', () => { onUnlock(); onDemo(); });
    let muted = false;
    this.n.mute.addEventListener('click', () => {
      onUnlock();
      muted = !muted;
      this.n.mute.textContent = muted ? 'Muted' : 'Sound on';
      this.n.mute.setAttribute('aria-pressed', muted);
      onMute(muted);
    });
    this.el.querySelectorAll('.paints button').forEach((b, i) => b.addEventListener('click', () => {
      this.el.querySelectorAll('.paints button').forEach(x => x.classList.toggle('on', x === b));
      onPaint(PAINTS[i][1]);
    }));
    // hold space to rev while the cluster is up
    addEventListener('keydown', e => {
      if (e.code !== 'Space' || !this.visible || e.target.closest?.('button, input, textarea')) return;
      e.preventDefault();
      if (!e.repeat) { onUnlock(); this.holding = true; rev.classList.add('on'); }
    });
    addEventListener('keyup', e => { if (e.code === 'Space') up(); });
  }

  show(on) {
    if (on === this.visible) return;
    this.visible = on;
    this.el.classList.toggle('show', on);
    document.body.classList.toggle('cluster-on', on);
    if (!on) { this.holding = false; }
  }

  update(dt, time) {
    const s = this.sim;
    const rot = (g, deg, cx, cy) => g.setAttribute('transform', `rotate(${deg.toFixed(2)} ${cx} ${cy})`);
    rot(this.n.tach, -135 + 270 * (this.tach.step(s.tach, dt) / 10000), 160, 118);
    rot(this.n.oil, -120 + 240 * this.oil.step(s.oilPressure, dt), -6, 140);
    rot(this.n.water, -120 + 240 * this.water.step(s.waterTemp * (s.on ? 1 : 0.0), dt), 326, 140);
    const shift = s.rpm > SHIFT_RPM && (s.rpm >= LIMIT_RPM - 50 ? Math.sin(time * 40) > 0 : true);
    this.n.shift.classList.toggle('on', shift);
    const lamps = s.lamps;
    this.n.lamps.forEach(l => l.classList.toggle('on', lamps));
    this.n.gear.textContent = s.on ? 'N' : '';
    const label = s.on && s.state !== 'stopping' ? 'Stop' : 'Start';
    if (this.n.start.textContent !== label) this.n.start.textContent = label;
  }
}
