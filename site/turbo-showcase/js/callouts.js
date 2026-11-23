// Callout boxes with leader arrows pointing at 3D anchor points.
// Each frame main.js passes the list of callouts that should exist, each with a visibility 0..1.
// Boxes radiate outward from the cluster of anchors, avoid a keep-out rect (the text card), and are relaxed so
// they do not overlap. The leader line draws itself in, then the box fades up.

import * as THREE from 'three';

const SVGNS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const tmp = new THREE.Vector3();

export class Callouts {
  constructor(root) {
    this.root = root;
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('class', 'co-lines');
    this.svg.innerHTML = `<defs><marker id="coArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>`;
    root.appendChild(this.svg);
    this.items = new Map();   // id → { el, path, dot, x, y, w, h, vis }
  }

  _make(c) {
    const el = document.createElement('div');
    el.className = 'co' + (c.short ? ' short' : '');
    el.innerHTML = `<div class="co-n mono">${c.n ?? ''}</div><div class="co-t mono">${c.title}</div>${c.text ? `<div class="co-x">${c.text}</div>` : ''}`;
    this.root.appendChild(el);
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('marker-end', 'url(#coArrow)');
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('r', '3.2');
    this.svg.append(path, dot);
    const it = { el, path, dot, x: null, y: null, w: 0, h: 0, len: 0 };
    return it;
  }

  // list: [{ id, n, title, text, world: Vector3, vis }]; keepOut: {x0, y0, x1, y1} in px or null
  update(list, camera, W, H, keepOut, compact = false) {
    const live = new Set();
    const shown = [];
    for (const c of list) {
      if (c.vis <= 0.001 || !c.world) continue;
      tmp.copy(c.world).project(camera);
      if (tmp.z > 1) continue;
      let it = this.items.get(c.id);
      if (!it) { it = this._make(c); this.items.set(c.id, it); }
      live.add(c.id);
      it.ax = (tmp.x * 0.5 + 0.5) * W;
      it.ay = (-tmp.y * 0.5 + 0.5) * H;
      it.vis = c.vis;
      it.c = c;
      shown.push(it);
    }
    // remove the ones that are gone
    for (const [id, it] of this.items) {
      if (live.has(id)) continue;
      it.el.remove(); it.path.remove(); it.dot.remove();
      this.items.delete(id);
    }
    if (!shown.length) return;

    // measure boxes (cheap: offsetWidth on few elements)
    if (compact !== this.compact) { this.compact = compact; this.root.classList.toggle('compact', compact); for (const it of this.items.values()) it.w = 0; }
    for (const it of shown) if (!it.w) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }   // measured once per box

    // centre of the anchors
    let cx = 0, cy = 0;
    for (const it of shown) { cx += it.ax; cy += it.ay; }
    cx /= shown.length; cy /= shown.length;
    const reach = compact ? 54 : Math.min(150, Math.max(90, W * 0.08));
    const pad = 12, top = compact ? 64 : 84, right = W - (compact ? 10 : 200);
    // on phones the text card is docked at the bottom: keep the boxes above it
    const bottom = compact && keepOut ? Math.min(H - 10, keepOut.y0 - 10) : H - (compact ? 10 : 100);

    // targets: push out from the cluster centre, mostly sideways
    for (const it of shown) {
      let dx = it.ax - cx, dy = (it.ay - cy) * 0.7;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dx = 1;
      const l = Math.hypot(dx, dy);
      dx /= l; dy /= l;
      it.side = it.c.side ?? (dx >= 0 ? 1 : -1);
      let tx = it.ax + (it.side > 0 ? reach * (0.6 + 0.4 * Math.abs(dx)) : -reach * (0.6 + 0.4 * Math.abs(dx)) - it.w);
      let ty = it.ay + dy * reach * 0.8 - it.h / 2;
      it.tx = tx; it.ty = ty;
    }
    // keep inside the viewport and out of the card
    const fit = it => {
      it.tx = clamp(it.tx, pad, right - it.w);
      it.ty = clamp(it.ty, top, bottom - it.h);
      if (keepOut && !compact && it.tx < keepOut.x1 + 14 && it.tx + it.w > keepOut.x0 - 14 && it.ty < keepOut.y1 && it.ty + it.h > keepOut.y0) {
        it.tx = keepOut.x1 + 18;
        if (it.side < 0) it.side = 1;
      }
    };
    shown.forEach(fit);
    // relax overlaps (a few passes, vertical first)
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i], b = shown[j];
        const ox = Math.min(a.tx + a.w, b.tx + b.w) - Math.max(a.tx, b.tx) + 10;
        const oy = Math.min(a.ty + a.h, b.ty + b.h) - Math.max(a.ty, b.ty) + 8;
        if (ox > 0 && oy > 0) {
          moved = true;
          if (oy < ox * 1.4) {
            const s = (a.ty + a.h / 2 < b.ty + b.h / 2 ? -1 : 1) * oy / 2;
            a.ty += s; b.ty -= s;
          } else {
            const s = (a.tx + a.w / 2 < b.tx + b.w / 2 ? -1 : 1) * ox / 2;
            a.tx += s; b.tx -= s;
          }
        }
      }
      shown.forEach(fit);
      if (!moved) break;
    }

    for (const it of shown) {
      // smooth so boxes glide instead of jumping when the camera moves
      if (it.x === null) { it.x = it.tx; it.y = it.ty; }
      it.x += (it.tx - it.x) * 0.25;
      it.y += (it.ty - it.y) * 0.25;
      const v = it.vis;
      const lineT = clamp(v / 0.55), boxT = clamp((v - 0.4) / 0.6);
      // the line leaves the box edge nearest the anchor, runs flat for a stub, then angles in to the anchor
      const boxLeft = it.ax < it.x + it.w / 2;
      const ex = boxLeft ? it.x : it.x + it.w;
      const ey = clamp(it.ay, it.y + 10, it.y + it.h - 10);
      const sx = ex + (boxLeft ? -22 : 22);
      const d = `M${ex.toFixed(1)} ${ey.toFixed(1)} L${sx.toFixed(1)} ${ey.toFixed(1)} L${it.ax.toFixed(1)} ${it.ay.toFixed(1)}`;
      it.path.setAttribute('d', d);
      const len = 22 + Math.hypot(it.ax - sx, it.ay - ey);
      it.path.style.strokeDasharray = `${len} ${len}`;
      it.path.style.strokeDashoffset = `${len * (1 - lineT)}`;
      it.path.style.opacity = lineT > 0 ? 1 : 0;
      it.dot.setAttribute('cx', it.ax.toFixed(1));
      it.dot.setAttribute('cy', it.ay.toFixed(1));
      it.dot.style.opacity = lineT;
      it.el.style.opacity = boxT;
      it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${(it.y + (1 - boxT) * 8).toFixed(1)}px, 0)`;
    }
  }

  clear() { this.update([], null, 0, 0, null); }
}
