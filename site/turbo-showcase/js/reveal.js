const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const active = new WeakMap();
const timers = new WeakMap();

function cancelAnim(el) {
  const stop = timers.get(el);
  if (stop) {
    stop();
    timers.delete(el);
  }
}

function splitHeading(el, baseDelay) {
  if (REDUCED || el.dataset.rvSplit || !el.textContent.trim()) return;
  el.dataset.rvSplit = '1';
  el.classList.add('rv-split');
  let idx = 0;
  for (const node of [...el.childNodes]) {
    if (node.nodeType !== 3) continue;
    const frag = document.createDocumentFragment();
    for (const part of node.nodeValue.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        const outer = document.createElement('span');
        outer.className = 'rw';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--wd', `${baseDelay + idx++ * 45}ms`);
        outer.appendChild(inner);
        frag.appendChild(outer);
      }
    }
    node.replaceWith(frag);
  }
}

function prepContainer(box) {
  if (!box || box.dataset.rvReady) return;
  box.classList.add('rv-box');
  // done once every heading has text to split (main.js fills the copy after load)
  if ([...box.querySelectorAll(':scope > h1, :scope > h2')].every(h => h.textContent.trim())) box.dataset.rvReady = '1';
  [...box.children].forEach((child, i) => {
    const d = i * 60;
    child.style.setProperty('--d', `${d}ms`);
    if (child.matches('h1, h2')) splitHeading(child, d);
    if (child.matches('.dl, .spec-table')) {
      [...child.children].forEach((row, r) => {
        row.style.setProperty('--rd', `${d + r * 40}ms`);
      });
    }
  });
}

function scrambleEyebrow(box, on) {
  const span = box.querySelector('.eyebrow > span:first-child');
  if (!span) return;
  if (span.dataset.rvText == null) {
    if (!span.textContent.trim()) return;
    span.dataset.rvText = span.textContent;
  }
  const orig = span.dataset.rvText;
  cancelAnim(span);
  if (!on || REDUCED || !/\d/.test(orig)) {
    span.textContent = orig;
    return;
  }
  const dur = 350;
  const t0 = performance.now();
  let lastTick = 0;
  let id = 0;
  const step = now => {
    if (now - t0 >= dur) {
      span.textContent = orig;
      timers.delete(span);
      return;
    }
    if (now - lastTick >= 35) {
      lastTick = now;
      span.textContent = orig.replace(/\d/g, () => String(Math.floor(Math.random() * 10)));
    }
    id = requestAnimationFrame(step);
  };
  timers.set(span, () => { cancelAnimationFrame(id); span.textContent = orig; });
  id = requestAnimationFrame(step);
}

function countStats(box, on) {
  for (const b of box.querySelectorAll('#heroStats b')) {
    const node = b.firstChild;
    if (!node || node.nodeType !== 3) continue;
    if (b.dataset.rvVal == null) b.dataset.rvVal = node.nodeValue;
    const orig = b.dataset.rvVal;
    cancelAnim(b);
    if (!on || REDUCED) {
      node.nodeValue = orig;
      continue;
    }
    const m = orig.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!m) continue;
    const target = parseFloat(m[1]);
    const dec = (m[1].split('.')[1] || '').length;
    const suffix = m[2];
    const dur = 750;
    const t0 = performance.now();
    let id = 0;
    node.nodeValue = (0).toFixed(dec) + suffix;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) {
        node.nodeValue = orig;
        timers.delete(b);
        return;
      }
      const v = target * (1 - (1 - p) ** 3);
      node.nodeValue = (dec ? v.toFixed(dec) : Math.round(v)) + suffix;
      id = requestAnimationFrame(step);
    };
    timers.set(b, () => { cancelAnimationFrame(id); node.nodeValue = orig; });
    id = requestAnimationFrame(step);
  }
}

function setState(box, on) {
  if (!box) return;
  const wasReady = !!box.dataset.rvReady;
  prepContainer(box);
  const prev = active.get(box);
  // run again once the copy arrives (reveal.js can start before main.js fills the text)
  if (prev === on && (wasReady || !box.dataset.rvReady)) return;
  active.set(box, on);
  if (on && prev === undefined) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (active.get(box)) box.classList.add('rv-on');
    }));
  } else {
    box.classList.toggle('rv-on', on);
  }
  scrambleEyebrow(box, on);
  countStats(box, on);
}

function syncSection(sec) {
  const box = sec.querySelector('.hero-inner, .card, .specs-inner');
  const on = sec.classList.contains('on') || (sec.id === 'top' && scrollY < 50);
  setState(box, on);
}

function init() {
  const main = document.querySelector('main');
  if (main) {
    main.querySelectorAll('section.scene').forEach(syncSection);
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.target.matches?.('section.scene')) {
          syncSection(m.target);
        } else if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.matches('section.scene')) syncSection(n);
            else n.querySelectorAll('section.scene').forEach(syncSection);
          }
        }
      }
    }).observe(main, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });

    const hero = document.getElementById('top');
    if (hero) addEventListener('scroll', () => syncSection(hero), { passive: true });
  }

  const cta = document.querySelector('footer.cta');
  const ctaBox = cta?.querySelector('.cta-inner');
  if (cta && ctaBox) {
    prepContainer(ctaBox);
    new IntersectionObserver(
      entries => entries.forEach(e => setState(ctaBox, e.isIntersecting)),
      { threshold: 0.15 }
    ).observe(cta);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
