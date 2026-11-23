// Autoscroll "video mode": plays the page as a timed tour. main.js calls step(dt) every frame
// while playing and scrolls to the returned s. Two speeds; any wheel/touch/key input pauses.

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const SPEEDS = [['1×', 1], ['2×', 2]];

export class Tour {
  // sections: the .scene elements; chapters: [[name, s]]
  // cues: [{ s, fn, dur?, end? }] fired once when the tour passes s; with dur (tour seconds) end() runs dur later
  constructor({ sections, chapters, getS, onPlay, onPause, onEnd, cues = [], spaceFree = () => false }) {
    this.chapters = chapters;
    this.getS = getS;
    this.onPlay = onPlay;
    this.onPause = onPause;
    this.onEnd = onEnd;
    this.cues = cues;
    this.spaceFree = spaceFree;  // true where Space belongs to the page (How section: floors the turbo)
    this.active = false;
    this.playing = false;
    this.speedIdx = 0;
    this.t = 0;
    this.open = new Map();       // running timed cues -> tour time they end
    this.fired = new Set();
    this.build(sections);
    this.ui();
  }

  // timeline: piecewise-linear keyframes { t, s }. Each section spends ~78% of its time on
  // s i → i+0.7 (card pinned, main animation) and the rest moving on to the next.
  build(sections) {
    const K = [{ t: 0, s: 0 }];
    let t = 0;
    sections.forEach((sec, i) => {
      const words = (sec.innerText || '').split(/\s+/).filter(Boolean).length;
      const vh = sec.offsetHeight / innerHeight;
      if (sec.dataset.tour) {                                   // custom beats: "s:sec,s:sec,..."
        for (const beat of sec.dataset.tour.split(',')) {
          const [ds, dt] = beat.split(':').map(Number);
          t += dt;
          K.push({ t, s: i + ds });
        }
        return;
      }
      const T = Math.max(clamp(3 + words / 4.2, 8, 17), vh * 3.2);
      const last = i === sections.length - 1;
      K.push({ t: t + T * 0.78, s: i + 0.7 });
      t += T;
      K.push({ t, s: last ? i + 0.98 : i + 1 });
    });
    this.K = K;
    this.T = t;
  }

  sAt(t) {
    const K = this.K;
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1].t) i++;
    const a = K[i], b = K[i + 1];
    return a.s + (b.s - a.s) * clamp((t - a.t) / Math.max(1e-6, b.t - a.t));
  }
  tAt(s) {
    const K = this.K;
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (s <= b.s && b.s > a.s) return a.t + (b.t - a.t) * clamp((s - a.s) / (b.s - a.s));
    }
    return this.T;
  }

  endCues() {                    // release anything a timed cue is holding
    for (const c of this.open.keys()) c.end?.();
    this.open.clear();
  }
  resetCues() {
    this.endCues();
    const s = this.sAt(this.t);
    this.fired = new Set(this.cues.filter(c => s > c.s));
  }

  ui() {
    const bar = document.createElement('div');
    bar.className = 'tourbar mono';
    bar.innerHTML = `
      <button class="tb-play" type="button" aria-label="Pause"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-pause" d="M4 3h3v10H4zM9 3h3v10H9z"/><path class="i-play" d="M4.5 2.5 13 8l-8.5 5.5z"/></svg></button>
      <div class="tb-mid">
        <div class="tb-label"><span class="tb-ch">Overview</span><span class="tb-time">0:00</span></div>
        <div class="tb-track"><i class="tb-fill"></i>${this.chapters.map(([n, s]) => `<b style="left:${((this.tAt(s) / this.T) * 100).toFixed(2)}%" title="${n}"></b>`).join('')}</div>
      </div>
      <button class="tb-speed" type="button" title="Playback speed">${SPEEDS[0][0]}</button>
      <button class="tb-exit" type="button" aria-label="Exit tour"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
    document.body.appendChild(bar);
    this.bar = bar;
    this.el = { play: bar.querySelector('.tb-play'), ch: bar.querySelector('.tb-ch'), time: bar.querySelector('.tb-time'), fill: bar.querySelector('.tb-fill'), speed: bar.querySelector('.tb-speed'), track: bar.querySelector('.tb-track') };
    this.el.play.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.el.exit = bar.querySelector('.tb-exit');
    this.el.exit.addEventListener('click', () => this.exit());
    this.el.speed.addEventListener('click', () => {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.el.speed.textContent = SPEEDS[this.speedIdx][0];
    });
    // click / drag on the track to seek
    const seek = e => {
      const r = this.el.track.getBoundingClientRect();
      this.t = clamp((e.clientX - r.left) / r.width) * this.T;
      this.resetCues();
    };
    this.el.track.addEventListener('pointerdown', e => { seek(e); this.el.track.setPointerCapture(e.pointerId); this.el.track.onpointermove = seek; });
    this.el.track.addEventListener('pointerup', () => { this.el.track.onpointermove = null; });

    // user input pauses (but not input on the bar or the dash)
    const own = e => e.target.closest && e.target.closest('.tourbar, .dash');
    const interrupt = e => { if (this.playing && !own(e)) this.pause(); };
    addEventListener('wheel', interrupt, { passive: true });
    addEventListener('touchstart', interrupt, { passive: true });
    addEventListener('keydown', e => {
      if (!this.active) return;
      if (e.key === 'Escape') return this.exit();
      if (e.code === 'Space') {
        if (this.spaceFree()) return;                              // space floors the turbo there
        if (e.target.closest?.('button, a, input, select, textarea')) return;  // let the control handle it
        e.preventDefault();
        if (!e.repeat) this.playing ? this.pause() : this.play();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.code)) interrupt(e);
    });
  }

  start() {
    this.active = true;
    document.documentElement.classList.add('touring');
    this.bar.classList.add('show');
    const s = this.getS();
    this.t = s > this.K[this.K.length - 1].s - 0.05 ? 0 : this.tAt(s);   // replay from the top if at the end
    this.resetCues();
    this.play();
  }
  play() {
    if (!this.active) return this.start();
    if (this.t >= this.T) this.t = 0, this.resetCues();
    this.playing = true;
    this.bar.classList.remove('paused');
    this.el.play.setAttribute('aria-label', 'Pause');
    this.onPlay?.();
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.bar.classList.add('paused');
    this.el.play.setAttribute('aria-label', 'Play');
    this.endCues();
    this.onPause?.();
    this.t = this.tAt(this.getS());   // resume from wherever the user leaves it
  }
  exit() {
    this.playing = false;
    this.active = false;
    this.endCues();
    this.onPause?.();
    document.documentElement.classList.remove('touring');
    this.bar.classList.remove('show', 'paused');
  }

  // returns the s to scroll to, or null when not driving the page
  step(dt) {
    if (!this.active) return null;
    if (this.playing) {
      this.t = Math.min(this.T, this.t + dt * SPEEDS[this.speedIdx][1]);
      const s = this.sAt(this.t);
      for (const c of this.cues) if (s >= c.s && !this.fired.has(c)) {
        this.fired.add(c); c.fn();
        if (c.dur) this.open.set(c, this.t + c.dur);
      }
      for (const [c, end] of this.open) if (this.t >= end) { c.end?.(); this.open.delete(c); }
      if (this.t >= this.T) { this.playing = false; this.endCues(); this.bar.classList.add('paused', 'ended'); this.onEnd?.(); }
      else this.bar.classList.remove('ended');
    }
    this.render();
    return this.playing ? this.sAt(this.t) : null;
  }

  render() {
    const t = this.playing ? this.t : this.tAt(this.getS());
    this.el.fill.style.transform = `scaleX(${(t / this.T).toFixed(4)})`;
    const s = this.sAt(t);
    let ch = this.chapters[0][0];
    for (const [n, cs] of this.chapters) if (s >= cs - 0.05) ch = n;
    if (this.el.ch.textContent !== ch) this.el.ch.textContent = ch;
    const left = Math.max(0, (this.T - t) / SPEEDS[this.speedIdx][1]);
    const txt = `-${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    if (this.el.time.textContent !== txt) this.el.time.textContent = txt;
  }
}
