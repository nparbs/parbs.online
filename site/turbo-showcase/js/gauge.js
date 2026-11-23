export class BoostGauge {
  constructor(el) {
    this.ns = 'http://www.w3.org/2000/svg';
    this.psi = 0; this.targetPsi = 0; this.rpm = 0; this.wg = 0;
    this.angle = this._angleOf(-12); this.vel = 0;
    this.cx = 120; this.cy = 112;
    this.svg = this._el('svg', { viewBox: '0 0 240 240', width: '100%', height: '100%' });
    this._init();
    el.appendChild(this.svg);
  }

  _el(t, a) {
    const e = document.createElementNS(this.ns, t);
    for (let k in a) e.setAttribute(k, a[k]);
    return e;
  }

  _angleOf(psi) {
    return -225 + ((psi + 15) / 45) * 270;
  }

  _arc(r, s, e) {
    const rs = s * Math.PI / 180, re = e * Math.PI / 180;
    const x1 = this.cx + r * Math.cos(rs), y1 = this.cy + r * Math.sin(rs);
    const x2 = this.cx + r * Math.cos(re), y2 = this.cy + r * Math.sin(re);
    const largeArc = Math.abs(e - s) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  _init() {
    this.band = this._el('path', { fill: 'none', stroke: '#ff5b1f', 'stroke-width': 4, 'stroke-opacity': 0.8 });
    this.liveArc = this._el('path', { fill: 'none', 'stroke-width': 3 });
    this.needle = this._el('polygon', { fill: '#ff5b1f', points: '-2,2 2,2 0,-80' });
    this.hub = this._el('circle', { fill: '#0a0c0f', stroke: '#eceef0', 'stroke-width': 1, cx: this.cx, cy: this.cy, r: 5 });
    this.psiTxt = this._el('text', { x: 120, y: 150, 'text-anchor': 'middle', fill: '#eceef0', 'font-size': '30px', 'font-weight': '600', 'font-family': 'JetBrains Mono, monospace' });
    this.psiLbl = this._el('text', { x: 120, y: 166, 'text-anchor': 'middle', fill: '#8f979f', 'font-size': '10px', 'font-family': 'JetBrains Mono, monospace' });
    this.rpmTxt = this._el('text', { x: 120, y: 205, 'text-anchor': 'middle', fill: '#8f979f', 'font-size': '11px', 'font-family': 'JetBrains Mono, monospace' });
    this.wgPill = this._el('rect', { x: 106, y: 215.5, width: 28, height: 13, rx: 6.5, fill: '#ff5b1f', 'fill-opacity': 0 });
    this.wgTxt = this._el('text', { x: 120, y: 224, 'text-anchor': 'middle', fill: '#8f979f', 'font-size': '8px', 'font-weight': 'bold', 'font-family': 'JetBrains Mono, monospace' });
    this.wgTxt.textContent = 'WG';

    this.svg.append(this.band, this.liveArc, this.needle, this.hub, this.psiTxt, this.psiLbl, this.rpmTxt, this.wgPill, this.wgTxt);

    for (let i = -15; i <= 30; i++) {
      const ang = this._angleOf(i);
      const rad = ang * Math.PI / 180;
      const isMaj = i % 5 === 0;
      const t = this._el('line', {
        x1: this.cx + 85 * Math.cos(rad), y1: this.cy + 85 * Math.sin(rad),
        x2: this.cx + 95 * Math.cos(rad), y2: this.cy + 95 * Math.sin(rad),
        stroke: i === 0 ? '#eceef0' : '#8f979f', 'stroke-width': isMaj ? 1.5 : 0.5
      });
      this.svg.appendChild(t);
      if (isMaj) {
        const txt = this._el('text', {
          x: this.cx + 105 * Math.cos(rad), y: this.cy + 105 * Math.sin(rad),
          'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#8f979f',
          'font-size': '11px', 'font-family': 'JetBrains Mono, monospace'
        });
        txt.textContent = i;
        this.svg.appendChild(txt);
      }
    }
    this.band.setAttribute('d', this._arc(88, this._angleOf(22), this._angleOf(30)));
  }

  set(psi, rpm, wg) {
    this.targetPsi = psi; this.rpm = rpm; this.wg = wg;
  }

  tick(dt) {
    const targetAng = this._angleOf(this.targetPsi);
    const diff = targetAng - this.angle;
    this.vel += (diff * 90 - this.vel * 14) * dt;
    this.angle = Math.min(this._angleOf(31), Math.max(this._angleOf(-16), this.angle + this.vel * dt));

    this.needle.setAttribute('transform', `translate(${this.cx}, ${this.cy}) rotate(${this.angle + 90})`);
    
    const zeroAng = this._angleOf(0);
    if (this.angle >= zeroAng) {   // follow the needle, not the target, so the arc never flips mid-swing
      this.liveArc.setAttribute('d', this._arc(72, zeroAng, this.angle));
      this.liveArc.setAttribute('stroke', '#1fb3ff');
    } else {
      this.liveArc.setAttribute('d', this._arc(72, this.angle, zeroAng));
      this.liveArc.setAttribute('stroke', '#8f979f');
    }

    if (this.targetPsi < 0) {
      this.psiTxt.textContent = Math.abs(this.targetPsi * 2.036).toFixed(1);
      this.psiLbl.textContent = 'inHg VAC';
    } else {
      this.psiTxt.textContent = this.targetPsi.toFixed(1);
      this.psiLbl.textContent = 'PSI BOOST';
    }

    const roundedRpm = Math.round(this.rpm / 100) * 100;
    this.rpmTxt.textContent = `SHAFT ${roundedRpm.toLocaleString('en-US')} RPM`;
    this.wgPill.setAttribute('fill-opacity', this.wg);
    this.wgTxt.setAttribute('fill', this.wg > 0.05 ? '#000' : '#8f979f');
  }
}
