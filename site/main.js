const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const darkScheme = matchMedia('(prefers-color-scheme: dark)');

// ---- GitHub list ----------------------------------------------------------

const list = document.getElementById('repos');

function repoCard(repo) {
  const item = document.createElement('li');
  item.className = 'repo';

  const link = document.createElement('a');
  link.href = repo.url;

  const name = document.createElement('strong');
  name.textContent = repo.name;
  link.append(name);

  if (repo.description) {
    const description = document.createElement('p');
    description.textContent = repo.description;
    link.append(description);
  }

  const meta = document.createElement('small');
  const year = new Date(repo.pushedAt).getFullYear();
  meta.textContent = [repo.language, year].filter(Boolean).join(' · ');
  link.append(meta);

  item.append(link);
  return item;
}

// If the list can't load, the "All repositories" link below it still works.
fetch('repos.json')
  .then((res) => (res.ok ? res.json() : []))
  .then((repos) => {
    const items = repos.map(repoCard);
    list.append(...items);
    items.forEach(reveal);
  })
  .catch(() => {});

// ---- Scroll: progress bar, frosted header, active nav link -----------------

const progress = document.querySelector('.progress');
const header = document.querySelector('.top');
let scrollQueued = false;

function onScroll() {
  scrollQueued = false;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
  header.classList.toggle('scrolled', scrollY > 8);
}
addEventListener('scroll', () => {
  if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); }
}, { passive: true });
addEventListener('resize', onScroll);
onScroll();

const navLinks = new Map([...document.querySelectorAll('.top nav a')].map((a) => [a.hash.slice(1), a]));
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = navLinks.get(entry.target.id);
      if (link) link.classList.toggle('active', entry.isIntersecting);
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const id of navLinks.keys()) {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  }
}

// ---- Reveal on scroll, staggered per batch ----------------------------------

const canObserve = 'IntersectionObserver' in window && !reduceMotion;

const revealer = canObserve && new IntersectionObserver((entries) => {
  let n = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    if (el.classList.contains('section')) {
      el.classList.remove('pending');
    } else {
      el.style.setProperty('--d', `${n++ * 90}ms`);
      el.classList.replace('reveal-wait', 'reveal-in');
    }
    revealer.unobserve(el);
  }
}, { rootMargin: '0px 0px -8% 0px' });

function reveal(el) {
  if (!revealer) return;
  if (el.classList.contains('section')) el.classList.add('pending');
  else el.classList.add('reveal-wait');
  revealer.observe(el);
}

document.querySelectorAll('.section, .label, .intro, .game, .project').forEach(reveal);

// ---- Hero: words rise in, numbers count up ---------------------------------

function splitWords(node, counter) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE) { splitWords(child, counter); continue; }
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const parts = child.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const word = document.createElement('span');
      word.className = 'w';
      word.style.setProperty('--i', counter.i++);
      word.textContent = part;
      frag.append(word);
    }
    child.replaceWith(frag);
  }
}

if (!reduceMotion) {
  for (const el of document.querySelectorAll('.split')) splitWords(el, { i: 0 });

  const easeOut = (t) => 1 - (1 - t) ** 3;
  for (const el of document.querySelectorAll('[data-count]')) {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.from ?? 0);
    const start = performance.now() + 450;
    const frame = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1400));
      el.textContent = Math.round(from + (to - from) * easeOut(t));
      if (t < 1) requestAnimationFrame(frame);
    };
    el.textContent = from;
    requestAnimationFrame(frame);
  }
}

// ---- Cards: spotlight follows the pointer, gentle 3D tilt -------------------

if (finePointer) {
  for (const card of document.querySelectorAll('.game, .project')) {
    const wide = card.classList.contains('feature');
    const maxTilt = wide ? 1.6 : 4.5;
    let queued = null;

    card.addEventListener('pointermove', (e) => {
      queued = e;
      requestAnimationFrame(() => {
        if (!queued) return;
        const r = card.getBoundingClientRect();
        const px = (queued.clientX - r.left) / r.width;
        const py = (queued.clientY - r.top) / r.height;
        queued = null;
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (!reduceMotion) {
          const rx = ((0.5 - py) * maxTilt).toFixed(2);
          const ry = ((px - 0.5) * maxTilt).toFixed(2);
          card.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        }
      });
    });
    card.addEventListener('pointerleave', () => {
      queued = null;
      card.style.transform = '';
    });
  }
}

// ---- Lead game loop: only plays while on screen -----------------------------

const loop = document.querySelector('.stage video');
if (loop) {
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduceMotion || saveData) {
    loop.removeAttribute('autoplay');
    loop.pause();
  } else if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loop.play().catch(() => {});
      else loop.pause();
    }, { threshold: 0.25 }).observe(loop);
  }
}

// ---- Embers rising behind the top of the page --------------------------------

const canvas = document.querySelector('.embers');
if (canvas && !reduceMotion && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const colors = [[255, 90, 46], [255, 150, 50], [255, 190, 80], [150, 100, 230]];
  let sprites = [];
  let embers = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let visible = true;
  let last = 0;
  const pointer = { x: -1e4, y: -1e4 };

  function makeSprites() {
    const light = !darkScheme.matches;
    sprites = colors.map(([r, g, b]) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const s = c.getContext('2d');
      const grad = s.createRadialGradient(32, 32, 0, 32, 32, 32);
      if (light) {
        grad.addColorStop(0, `rgba(${r * 0.8 | 0},${g * 0.6 | 0},${b * 0.5 | 0},0.9)`);
        grad.addColorStop(0.25, `rgba(${r},${g},${b},0.35)`);
      } else {
        grad.addColorStop(0, 'rgba(255,245,220,1)');
        grad.addColorStop(0.18, `rgba(${r},${g},${b},0.9)`);
        grad.addColorStop(0.45, `rgba(${r},${g},${b},0.18)`);
      }
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      s.fillStyle = grad;
      s.fillRect(0, 0, 64, 64);
      return c;
    });
  }

  function spawn(anywhere) {
    const purple = Math.random() < 0.18;
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 20 + Math.random() * 60,
      size: 6 + Math.random() ** 2 * 26,
      vy: 12 + Math.random() * 38,
      vx: 0,
      sway: 6 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      freq: 0.4 + Math.random() * 1.2,
      flicker: 2 + Math.random() * 5,
      alpha: 0.35 + Math.random() * 0.55,
      sprite: purple ? 3 : Math.floor(Math.random() * 3),
    };
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.round(Math.min(90, Math.max(26, (width * height) / 13000)));
    while (embers.length < want) embers.push(spawn(true));
    embers.length = want;
  }

  function draw(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = darkScheme.matches ? 'lighter' : 'source-over';

    for (const e of embers) {
      // Drift away from the pointer a little.
      const dx = e.x - pointer.x;
      const dy = e.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) {
        const push = (1 - Math.sqrt(d2) / 140) * 160;
        e.vx += (dx / (Math.sqrt(d2) + 1)) * push * dt;
      }
      e.vx *= 0.94;
      e.y -= e.vy * dt;
      e.x += e.vx * dt + Math.sin(t * e.freq + e.phase) * e.sway * dt;
      if (e.y < -40 || e.x < -60 || e.x > width + 60) Object.assign(e, spawn(false));

      const fade = Math.min(1, e.y / (height * 0.25), (height + 40 - e.y) / 120);
      const a = e.alpha * fade * (0.7 + 0.3 * Math.sin(t * e.flicker + e.phase));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(sprites[e.sprite], e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  function update() {
    const should = visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(draw);
    } else if (!should) {
      running = false;
    }
  }

  makeSprites();
  resize();
  addEventListener('resize', resize);
  darkScheme.addEventListener?.('change', makeSprites);
  document.addEventListener('visibilitychange', update);
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY + scrollY;
  }, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(canvas);
  }
  update();
}
