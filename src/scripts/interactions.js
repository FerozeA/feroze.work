// Small interactions layered on top of a page that already works without JavaScript.
const canHover = matchMedia('(hover: hover)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// Stagger entrance: each [data-enter] block gets its position in the page.
document.querySelectorAll('[data-enter]').forEach((el, i) => el.style.setProperty('--i', String(i)));

// Images fade in from their blurred placeholder.
document.querySelectorAll('.blur img').forEach((img) => {
  const done = () => img.classList.add('is-loaded');
  if (img.complete && img.naturalWidth) done();
  else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
});

// Tile videos: play on hover with a mouse, play while in view on touch screens.
const hoverVideos = [...document.querySelectorAll('video[data-hoverplay]')];
const play = (v) => v.play().catch(() => {});
if (canHover && !reduceMotion) {
  hoverVideos.forEach((v) => {
    const host = v.closest('a') ?? v;
    host.addEventListener('pointerenter', () => play(v));
    host.addEventListener('pointerleave', () => v.pause());
    host.addEventListener('focus', () => play(v));
    host.addEventListener('blur', () => v.pause());
  });
} else if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? play(e.target) : e.target.pause()));
  }, { threshold: 0.6 });
  hoverVideos.forEach((v) => io.observe(v));
}
// Show a real first frame instead of a black box.
hoverVideos.forEach((v) => v.addEventListener('loadedmetadata', () => { if (v.paused && v.currentTime === 0) v.currentTime = 0.05; }, { once: true }));

// Shared hover pill: one highlight that glides between rows instead of each row lighting up.
document.querySelectorAll('[data-hover-list]').forEach((list) => {
  const pill = list.querySelector('.rows-pill');
  let visible = false;
  const moveTo = (row) => {
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    pill.classList.toggle('no-slide', !visible);
    pill.style.transform = `translateY(${top}px)`;
    pill.style.height = `${row.offsetHeight}px`;
    pill.style.opacity = '1';
    visible = true;
  };
  const hide = () => { pill.style.opacity = '0'; visible = false; };
  list.querySelectorAll('.row').forEach((row) => {
    row.addEventListener('pointerenter', () => moveTo(row));
    row.addEventListener('focus', () => moveTo(row));
    row.addEventListener('blur', hide);
  });
  list.addEventListener('pointerleave', hide);
});

// Cursor-following preview for list rows (eased so it trails the pointer slightly).
const peek = document.querySelector('[data-peek-card]');
if (peek && canHover) {
  const img = peek.querySelector('img');
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false;
  const tick = () => {
    x += (tx - x) * (reduceMotion ? 1 : 0.18);
    y += (ty - y) * (reduceMotion ? 1 : 0.18);
    peek.style.transform = `translate(${x}px, ${y}px)`;
    raf = on || Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
  };
  const target = (e) => { tx = e.clientX + 20; ty = e.clientY - peek.offsetHeight / 2; };
  document.querySelectorAll('[data-peek]').forEach((row) => {
    const src = row.dataset.peek;
    row.addEventListener('pointerenter', (e) => {
      if (!src) return;
      if (!on) { target(e); x = tx; y = ty; }
      img.src = src;
      on = true;
      peek.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(tick);
    });
    row.addEventListener('pointermove', target);
    row.addEventListener('pointerleave', () => { on = false; peek.classList.remove('is-on'); });
  });
}

// Grid / list switch with a sliding indicator; the choice is remembered.
const seg = document.querySelector('[data-seg]');
const views = document.querySelector('[data-views]');
if (seg && views) {
  const pill = seg.querySelector('.seg-pill');
  const buttons = [...seg.querySelectorAll('button')];
  const place = (btn) => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  };
  const select = (view, animate) => {
    const btn = buttons.find((b) => b.dataset.view === view) ?? buttons[0];
    buttons.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    place(btn);
    if (views.dataset.view === btn.dataset.view) return;
    store.set('work-view', btn.dataset.view);
    if (!animate || reduceMotion) { views.dataset.view = btn.dataset.view; return; }
    views.classList.add('is-switching');
    setTimeout(() => {
      views.dataset.view = btn.dataset.view;
      requestAnimationFrame(() => views.classList.remove('is-switching'));
    }, 140);
  };
  pill.style.transition = 'none';
  select(store.get('work-view') || 'grid', false);
  requestAnimationFrame(() => { pill.style.transition = ''; });
  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.view, true)));
  seg.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    select(next.dataset.view, true);
    next.focus();
  });
  document.fonts?.ready.then(() => place(buttons.find((b) => b.getAttribute('aria-checked') === 'true')));
}

// Click an image to zoom: it flies from its place to the centre, and back on close.
const dialog = document.querySelector('[data-zoom-dialog]');
if (dialog && typeof dialog.showModal === 'function') {
  let source = null, clone = null;
  const fit = (w, h) => {
    const pad = innerWidth < 640 ? 16 : 48;
    const s = Math.min((innerWidth - pad * 2) / w, (innerHeight - pad * 2) / h, 2.5);
    return { w: w * s, h: h * s, x: (innerWidth - w * s) / 2, y: (innerHeight - h * s) / 2 };
  };
  const ease = 'cubic-bezier(.165, .84, .44, 1)';
  const open = (img) => {
    source = img;
    const r = img.getBoundingClientRect();
    const end = fit(img.naturalWidth || r.width, img.naturalHeight || r.height);
    clone = new Image();
    clone.src = img.currentSrc || img.src;
    clone.alt = img.alt;
    Object.assign(clone.style, { width: `${end.w}px`, height: `${end.h}px`, transform: `translate(${end.x}px, ${end.y}px)` });
    dialog.replaceChildren(clone);
    dialog.showModal();
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    img.style.visibility = 'hidden';
    if (!reduceMotion) {
      clone.animate([
        { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / end.w}, ${r.height / end.h})` },
        { transform: `translate(${end.x}px, ${end.y}px) scale(1)` },
      ], { duration: 380, easing: ease });
    }
  };
  const close = () => {
    if (!clone || !source) return;
    const r = source.getBoundingClientRect();
    const end = clone.getBoundingClientRect();
    dialog.classList.remove('is-open');
    const finish = () => { source.style.visibility = ''; dialog.close(); clone = null; source = null; };
    if (reduceMotion) return finish();
    clone.animate([
      { transform: `translate(${end.left}px, ${end.top}px) scale(1)` },
      { transform: `translate(${r.left}px, ${r.top}px) scale(${r.width / end.width}, ${r.height / end.height})` },
    ], { duration: 300, easing: ease, fill: 'forwards' }).finished.then(finish);
  };
  document.querySelectorAll('img[data-zoom]').forEach((img) => img.addEventListener('click', () => open(img)));
  dialog.addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  addEventListener('scroll', () => { if (dialog.open) close(); }, { passive: true });
}

// Live clock in the footer.
const clock = document.querySelector('[data-clock]');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const update = () => { clock.textContent = `${fmt.format(new Date())} in New York`; };
  update();
  setInterval(update, 15_000);
}
