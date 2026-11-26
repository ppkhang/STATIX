// Click a product card with artwork: the art pops out of the card to the middle of the screen while the page
// dims. A comic backdrop, the product's name and a "tuning in" meter stay up while the product page loads, then
// the art flies into its illustration frame.
// Plain script, loaded in <head>, because the flight has to survive a full page load without a flash.
// Cards opt in with data-art-fly. The product page's frame is marked data-art-frame, and its root data-product.
// A card marked data-scroll-up (the ones further down a product page) changes product without a reload: the new
// page is put in place first, then glides up from where you were.
(() => {
  const KEY = 'statix-art-flight';
  const CSS_ESCAPE = (value) => window.CSS.escape(value); // `CSS` below is this script's own stylesheet
  const RATIO = 1344 / 768; // every *_art.webp is drawn on this canvas
  const ZOOM = 1.2; // how much the product frame enlarges the art (product.module.css, .comic img)
  // how long the middle of the flight stays up, in ms: before leaving, and at least this long after arriving
  const HOLD_OUT = 260;
  const HOLD_IN = 380;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // where the art sits in the middle of the screen: as large as comfortably fits
  const middle = () => {
    const width = Math.min(innerWidth * 0.72, innerHeight * 0.78 * RATIO, 1100);
    return { x: innerWidth / 2, y: innerHeight / 2, width, turn: 0 };
  };
  // a placement is a centre, a width and a tilt in degrees
  const place = ({ x, y, width, turn }) => ({
    left: x - width / 2 + 'px', top: y - width / RATIO / 2 + 'px',
    width: width + 'px', height: width / RATIO + 'px', transform: 'rotate(' + turn + 'deg)',
  });

  const CSS = `
    [data-art-layer] { position: fixed; inset: 0; z-index: 1000; overflow: hidden; }
    [data-art-layer] * { box-sizing: border-box; pointer-events: none; }
    [data-art-layer] > * { position: absolute; }
    .af-dim { inset: 0; background: rgba(7, 6, 11, .93); }
    .af-lines { left: 50%; top: 50%; width: 180vmax; height: 180vmax; margin: -90vmax 0 0 -90vmax; border-radius: 50%;
      background: repeating-conic-gradient(rgba(185, 164, 255, .2) 0 2deg, transparent 2deg 8deg, rgba(185, 164, 255, .09) 8deg 9deg, transparent 9deg 15deg);
      -webkit-mask-image: radial-gradient(circle, transparent 12%, #000 34%); mask-image: radial-gradient(circle, transparent 12%, #000 34%); }
    .af-burst { left: 50%; top: 50%; width: 92vmin; height: 92vmin; margin: -46vmin 0 0 -46vmin; fill: #35313f; }
    .af-dots { width: 40vw; height: 48vh; background: radial-gradient(circle, #B9A4FF 3px, transparent 3.5px) 0 0 / 12px 12px; opacity: .34; }
    .af-dots.a { left: 0; bottom: 0; -webkit-mask-image: linear-gradient(35deg, #000, transparent 62%); mask-image: linear-gradient(35deg, #000, transparent 62%); }
    .af-dots.b { right: 0; top: 0; -webkit-mask-image: linear-gradient(215deg, #000, transparent 62%); mask-image: linear-gradient(215deg, #000, transparent 62%); }
    .af-art { max-width: none; object-fit: contain; filter: drop-shadow(18px 18px 0 rgba(0, 0, 0, .85)); }
    .af-name { left: 5vw; top: 11vh; padding: 6px 24px 12px; background: #F4F2F8; color: #0B0A0F; border: 3px solid #000; box-shadow: 10px 10px 0 #B9A4FF;
      font: 900 clamp(34px, 4.8vw, 76px)/1 'Archivo', sans-serif; text-transform: uppercase; rotate: -5deg; }
    .af-shard { left: 50%; top: 50%; width: 18px; height: 54px; margin: -27px 0 0 -9px; background: #B9A4FF; clip-path: polygon(50% 0, 100% 100%, 0 78%); }
    .af-ring { border: 6px solid #B9A4FF; box-shadow: 0 0 0 3px #000; }
    .af-tune { left: 50%; bottom: 8vh; translate: -50% 0; white-space: nowrap; display: flex; align-items: flex-end; gap: 18px; color: #F4F2F8; text-shadow: 4px 4px 0 #000;
      font: 400 22px/1 'Permanent Marker', cursive; }
    .af-bars { display: flex; align-items: flex-end; gap: 4px; height: 24px; }
    .af-bars i { width: 5px; height: 100%; background: #B9A4FF; transform-origin: bottom; animation: af-level .5s ease-in-out infinite alternate; }
    @keyframes af-spin { to { rotate: 360deg; } }
    @keyframes af-float { 50% { translate: 0 -8px; } }
    @keyframes af-level { from { transform: scaleY(.18); } }
  `;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  // the landing's 24-point burst
  function burst() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'af-burst');
    const points = Array.from({ length: 48 }, (_, i) => {
      const angle = (i * Math.PI) / 24;
      const radius = i % 2 ? 76 : 96;
      return (100 + radius * Math.sin(angle)).toFixed(1) + ',' + (100 - radius * Math.cos(angle)).toFixed(1);
    }).join(' ');
    const shape = document.createElementNS(ns, 'polygon');
    shape.setAttribute('points', points);
    svg.append(shape);
    return svg;
  }

  /**
   * Builds the overlay. `since` is when the flight started, so the looping motion carries on from the same
   * point on the next page instead of jumping back.
   */
  function stage(src, name, at, since) {
    const layer = make('div', '');
    layer.setAttribute('data-art-layer', '');
    layer.setAttribute('aria-hidden', 'true');
    const sheet = make('style', '', CSS);
    const behind = (Date.now() - since) / 1000;
    const loop = (element, animation) => {
      element.style.animation = animation;
      element.style.animationDelay = -behind + 's';
      return element;
    };

    const dim = make('div', 'af-dim');
    const lines = loop(make('div', 'af-lines'), 'af-spin 40s linear infinite');
    const star = burst();
    loop(star, 'af-spin 60s linear infinite reverse');
    const dots = [make('div', 'af-dots a'), make('div', 'af-dots b')];
    const slab = make('div', 'af-name', name);
    const art = make('img', 'af-art');
    art.src = src;
    art.alt = '';
    Object.assign(art.style, place(at));
    const tune = make('div', 'af-tune', 'tuning in…');
    const bars = make('div', 'af-bars');
    for (let i = 0; i < 7; i++) {
      const bar = make('i', '');
      bar.style.animationDelay = -(behind + ((i * 137) % 500) / 1000) + 's';
      bars.append(bar);
    }
    tune.append(bars);

    layer.append(sheet, dim, lines, star, ...dots, art, slab, tune);
    root.append(layer); // outside <body>, which React owns
    return { layer, dim, lines, star, dots, art, slab, tune };
  }

  const float = (art, since) => {
    art.style.animation = 'af-float 2.4s ease-in-out infinite';
    art.style.animationDelay = -(Date.now() - since) / 1000 + 's';
  };

  // moves the art and leaves it there
  function fly(element, from, to, options) {
    Object.assign(element.style, place(to));
    return element.animate([place(from), place(to)], options).finished.catch(() => {});
  }

  const enter = (element, frames, duration, delay = 0) =>
    element.animate(frames, { duration, delay, easing: 'cubic-bezier(.2, 1.4, .35, 1)', fill: 'backwards' });
  const leave = (element, frames, duration = 300, delay = 0) =>
    element.animate(frames, { duration, delay, easing: 'cubic-bezier(.6, 0, .9, .4)', fill: 'forwards' });

  /** A few triangles thrown out from the middle. */
  function shards(layer) {
    for (let i = 0; i < 8; i++) {
      const shard = make('div', 'af-shard');
      if (i % 3 === 0) shard.style.background = '#F4F2F8';
      layer.append(shard);
      const turn = 45 * i + ((i * 47) % 23);
      const far = 36 + ((i * 31) % 16);
      shard.animate(
        [{ transform: 'rotate(' + turn + 'deg) translateY(-10vmin) scale(.4)', opacity: 1 },
          { transform: 'rotate(' + turn + 'deg) translateY(-' + far + 'vmax) scale(' + (1 + (i % 3) * 0.3) + ')', opacity: 0 }],
        { duration: 540, delay: 130, easing: 'cubic-bezier(.1, .8, .3, 1)', fill: 'both' },
      ).finished.then(() => shard.remove(), () => {});
    }
  }

  // how the card is showing its art right now: object-fit, object-position and any scale included
  function inCard(image) {
    const box = image.getBoundingClientRect();
    const css = getComputedStyle(image);
    const contain = css.objectFit === 'contain';
    const width = contain ? Math.min(box.width, box.height * RATIO) : Math.max(box.width, box.height * RATIO);
    const [px, py] = css.objectPosition.split(' ').map((value) => parseFloat(value) / 100);
    return {
      x: box.left + (box.width - width) * (px || 0.5) + width / 2,
      y: box.top + (box.height - width / RATIO) * (py || 0.5) + width / RATIO / 2,
      width, turn: 0,
    };
  }

  /** Scrolls to the top where it can be watched. Its own easing, so it takes the same short time in every browser. */
  function glideUp() {
    const from = scrollY;
    if (from < 2) return Promise.resolve();
    const length = Math.min(900, 420 + from * 0.14);
    return new Promise((resolve) => {
      let start;
      const step = (time) => {
        start ??= time;
        const t = Math.min(1, (time - start) / length);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        // 'instant' because the page's own smooth scrolling would fight a frame-by-frame scroll
        scrollTo({ top: from * (1 - eased), behavior: 'instant' });
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Takes a flight's overlay away: the backdrop clears and the art flies from the middle into the frame. */
  async function settle(parts, frame, centre) {
    const finish = () => { root.removeAttribute('data-art-landing'); parts.layer.remove(); };
    // where the art is right now, floating included, then stop the float
    const now = parts.art.getBoundingClientRect();
    parts.art.style.animation = 'none';
    const from = { x: now.left + now.width / 2, y: now.top + now.height / 2, width: centre.width, turn: 0 };

    // the backdrop clears
    leave(parts.slab, [{ translate: '0 0', rotate: '-5deg' }, { translate: '-60vw -6vh', rotate: '-22deg' }], 280);
    parts.dots.forEach((dot) => leave(dot, [{ opacity: 0.34 }, { opacity: 0 }], 260));
    leave(parts.tune, [{ opacity: 1 }, { opacity: 0 }], 180);
    leave(parts.star, [{ opacity: 1 }, { opacity: 0 }], 260);
    leave(parts.lines, [{ opacity: 1 }, { opacity: 0 }], 260);
    parts.dim.animate({ opacity: [1, 0] }, { duration: 380, delay: 120, fill: 'forwards' });

    // the frame must already be at rest behind the dim: jump its one-off entrances to their end
    (frame.parentElement || frame).getAnimations({ subtree: true })
      .filter((animation) => animation.effect.getComputedTiming().iterations !== Infinity)
      .forEach((animation) => animation.finish());
    // end on the same shadow the framed art has, so the hand-over can't be seen
    const framed = frame.querySelector('img');
    if (framed) parts.art.animate({ filter: [getComputedStyle(parts.art).filter, getComputedStyle(framed).filter] }, { duration: 560, fill: 'forwards' });
    // measured now, once the page has settled. The frame is tilted, so only its centre comes from the screen.
    const box = frame.getBoundingClientRect();
    const tilt = new DOMMatrix(getComputedStyle(frame).transform);
    const to = {
      x: box.left + box.width / 2, y: box.top + box.height / 2,
      width: Math.min(frame.clientWidth, frame.clientHeight * RATIO) * ZOOM,
      turn: Math.atan2(tilt.b, tilt.a) * 180 / Math.PI,
    };
    // a short pull back, then in
    const back = { ...from, width: from.width * 1.05, turn: 4 };
    parts.art.animate([place(from), { ...place(back), offset: 0.25 }, place(to)], { duration: 560, easing: 'cubic-bezier(.55, 0, .18, 1)', fill: 'forwards' });
    await wait(560);
    await framed?.decode().catch(() => {}); // don't take ours away before the framed copy can be drawn
    // show the framed art first, and remove the flying one a frame later, so there is never a gap
    root.removeAttribute('data-art-landing');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    finish();
    frame.animate({ scale: ['1', '1.05', '.985', '1'] }, { duration: 340, easing: 'ease-out' });
    ring(frame);
  }

  // ---- changing product on the product page ----
  /** Asks the app for the new product and waits until it is in the page. False if it doesn't turn up. */
  function putInPlace(url) {
    const slug = url.pathname.split('/').pop();
    const there = () => document.querySelector('[data-product="' + CSS_ESCAPE(slug) + '"]');
    // from here on, product pages arrive without their entrances: only the content changes. Never removed
    // while the page lives, because giving an element its animation back would replay it.
    root.setAttribute('data-switched', '');
    window.statixSwitch(url.pathname + url.search);
    return new Promise((resolve) => {
      const started = Date.now();
      const look = () => {
        if (there()) resolve(there());
        else if (Date.now() - started > 5000) resolve(null);
        else requestAnimationFrame(look);
      };
      look();
    });
  }

  // ---- leaving ----
  let leaving = false;
  async function takeOff(card, image) {
    const url = new URL(card.href);
    url.searchParams.set('view', 'art');
    const since = Date.now();
    const from = inCard(image);
    const name = card.querySelector('h3')?.textContent.trim() || 'STATIX';
    const parts = stage(image.currentSrc || image.src, name, from, since);
    image.style.visibility = 'hidden'; // it has left the card

    parts.dim.animate({ opacity: [0, 1] }, { duration: 280, fill: 'backwards' });
    enter(parts.lines, [{ opacity: 0, scale: '.7' }, { opacity: 1, scale: '1' }], 420, 80);
    enter(parts.star, [{ opacity: 0, scale: '.5' }, { opacity: 1, scale: '1' }], 420, 80);
    enter(parts.tune, [{ opacity: 0 }, { opacity: 1 }], 260, 260);
    parts.dots.forEach((dot) => enter(dot, [{ opacity: 0 }, { opacity: 0.34 }], 420, 160));
    enter(parts.slab, [{ translate: '-60vw 0', rotate: '-20deg', scale: '1.4' }, { translate: '0 0', rotate: '-5deg', scale: '1' }], 440, 220);
    card.animate({ scale: ['1', '.95', '1.02', '1'] }, { duration: 340, easing: 'ease-out' }); // the card takes the recoil
    shards(parts.layer);

    const inPlace = card.hasAttribute('data-scroll-up') && window.statixSwitch;
    // loading starts with the pop, so the new product is already there by the time the page moves
    const ready = inPlace ? (root.setAttribute('data-art-landing', ''), putInPlace(url)) : null;

    // past the mark by a little, then settle
    await fly(parts.art, { ...from, turn: -6 }, middle(), { duration: 480, easing: 'cubic-bezier(.3, 1.5, .35, 1)' });
    float(parts.art, since);
    if (inPlace) {
      const page = await ready;
      if (!page) { location.assign(url); return; } // took too long: load it the ordinary way
      await glideUp(); // the new product rides up behind the overlay
      const frame = page.querySelector('[data-art-frame]');
      if (frame) await settle(parts, frame, middle());
      else { root.removeAttribute('data-art-landing'); parts.layer.remove(); }
      leaving = false;
      return;
    }
    await wait(HOLD_OUT);
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ src: parts.art.src, name, path: url.pathname, since, left: Date.now() }));
    } catch { /* storage blocked: the next page just opens normally */ }
    location.assign(url);
  }

  addEventListener('click', (event) => {
    const card = event.target.closest?.('a[data-art-fly], a[data-scroll-up]');
    if (!card || calm() || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const image = card.hasAttribute('data-art-fly') ? card.querySelector('.panel-art') : null;
    event.preventDefault(); // also stops Next's link, so every marked card takes this path
    if (leaving) return;
    leaving = true;
    if (image) takeOff(card, image);
    else { // no artwork: put the new product in place, then ride up
      const url = new URL(card.href);
      if (window.statixSwitch) putInPlace(url).then((page) => (page ? glideUp() : location.assign(url))).then(() => { leaving = false; });
      else glideUp().then(() => location.assign(url));
    }
  }, true);

  // coming back with the Back button can restore the page as it was left, overlay and all
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    leaving = false;
    document.querySelectorAll('[data-art-layer]').forEach((layer) => layer.remove());
    document.querySelectorAll('.panel-art').forEach((image) => { image.style.visibility = ''; });
  });

  // ---- arriving ----
  let flight = null;
  try {
    flight = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch { /* nothing to land */ }
  if (!flight || flight.path !== location.pathname || Date.now() - flight.left > 8000 || calm()) return;

  const arrived = Date.now();
  root.setAttribute('data-art-landing', ''); // the page keeps its own art hidden until ours arrives
  const centre = middle();
  const parts = stage(flight.src, flight.name, centre, flight.since);
  float(parts.art, flight.since);
  const finish = () => { root.removeAttribute('data-art-landing'); parts.layer.remove(); };
  const failsafe = setTimeout(finish, 6000);

  /** One ring bursting off the frame as the art hits it. */
  function ring(frame) {
    const box = frame.getBoundingClientRect();
    const layer = make('div', ''); // it outlives the overlay, so it gets its own layer
    layer.setAttribute('data-art-layer', '');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.pointerEvents = 'none';
    const line = make('div', 'af-ring');
    Object.assign(line.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
    layer.append(make('style', '', CSS), line);
    root.append(layer);
    const done = () => layer.remove();
    line.animate([{ scale: '1', opacity: 1, rotate: '-3deg' }, { scale: '1.18', opacity: 0, rotate: '-5deg' }], { duration: 440, easing: 'cubic-bezier(.1, .8, .3, 1)', fill: 'forwards' }).finished.then(done, done);
  }

  async function land() {
    // always start at the top, so the frame is where the art is about to go
    scrollTo({ top: 0, behavior: 'instant' });
    const frame = document.querySelector('[data-art-frame]');
    if (!frame) return finish();
    await Promise.all([parts.art.decode().catch(() => {}), document.fonts.ready]);
    await wait(Math.max(0, HOLD_IN - (Date.now() - arrived)));

    await settle(parts, frame, centre);
    clearTimeout(failsafe);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', land);
  else land();
})();
