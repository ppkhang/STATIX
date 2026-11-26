// Click a product card with artwork: the art pops out of the card to the middle of the screen while the page
// dims. A comic backdrop, the product's name and a "tuning in" meter stay up until the 3D model on the product
// page is ready to be seen. Then the art slots in: brackets mark the model's place, the art slams into them, and a
// slanted blade cuts across, turning the drawing into the model.
// Plain script, loaded in <head>, because the flight has to survive a full page load without a flash.
// Cards opt in with data-art-fly. The product page's frame is marked data-art-frame, and its root data-product.
// A card marked data-switch (the other products, on a product page) changes product without a reload: everything
// slides off to the left, a slanted cover passes behind it, and the next product follows it in.
// The header's home link (data-home), on every page that has it, gets its own: the cover brings a big white STATIX,
// and on the landing it shrinks into the logo in the top left corner.
// The landing's links to the drop and to log in (wide windows) send the logo to the middle of a header that draws
// itself left to right, then fade TV static in under it while the page loads. The next page picks both up and lets its own header take over.
// Elsewhere, the header's own links to the drop, log in and the account fade the same static in and out, without a
// reload: the header stays, and only what is under it changes (window.statixGo, from the app).
// Entering or reloading the landing plays the same arrival over plain black (the intro); window.statixIntro resolves
// when it is over, and landing.js then shows off the 3D model.
(() => {
  const KEY = 'statix-art-flight';
  const CSS_ESCAPE = (value) => window.CSS.escape(value); // `CSS` below is this script's own stylesheet
  const RATIO = 1344 / 768; // every *_art.webp is drawn on this canvas
  // where the product itself sits on each art canvas (1344 x 768), without the splashes behind it: left, top, right, bottom
  const SUBJECTS = { speaker_art: [495, 198, 882, 604], amp_art: [385, 300, 952, 572], stand_art: [510, 96, 880, 688] };
  const MODEL_WAIT = 30000; // a slow connection keeps the art up; only after this long does it stop waiting
  const LEAN = 0.404; // tan(22deg): the lean of the site's slanted cuts
  // how long the middle of the flight stays up, in ms: before leaving, and at least this long after arriving
  const HOLD_OUT = 260;
  const HOLD_IN = 380;
  const SOLID = 'rgb(7, 6, 11)';
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
    .af-art { max-width: none; object-fit: contain; will-change: transform, opacity; filter: drop-shadow(18px 18px 0 rgba(0, 0, 0, .85)); }
    .af-name { left: 5vw; top: 11vh; padding: 6px 24px 12px; background: #F4F2F8; color: #0B0A0F; border: 3px solid #000; box-shadow: 10px 10px 0 #B9A4FF;
      font: 900 clamp(34px, 4.8vw, 76px)/1 'Archivo', sans-serif; text-transform: uppercase; rotate: -5deg; }
    .af-shard { left: 50%; top: 50%; width: 18px; height: 54px; margin: -27px 0 0 -9px; background: #B9A4FF; clip-path: polygon(50% 0, 100% 100%, 0 78%); }
    .af-ring { border: 6px solid #B9A4FF; box-shadow: 0 0 0 3px #000; }
    .af-corner { width: 46px; height: 46px; border: solid #F4F2F8; border-width: 7px 0 0 7px; filter: drop-shadow(4px 4px 0 #000); }
    .af-blade { width: 16px; background: #B9A4FF; border-right: 5px solid #F4F2F8; box-shadow: -8px 0 0 #000, 0 0 34px 6px rgba(185, 164, 255, .8); transform: skewX(-22deg); }
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

  // how to show, with transform alone, art that is laid out at `base` as if it were at `at`
  const shift = (base, at) =>
    'translate(' + (at.x - base.x) + 'px, ' + (at.y - base.y) + 'px) rotate(' + at.turn + 'deg) scale(' + at.width / base.width + ')';

  // moves the art and leaves it there
  function fly(element, from, to, options) {
    Object.assign(element.style, place(to));
    return element.animate([{ transform: shift(to, from) }, { transform: 'rotate(' + to.turn + 'deg)' }], options).finished.catch(() => {});
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

  const frames = (count) => new Promise((resolve) => { const next = () => (count-- > 0 ? requestAnimationFrame(next) : resolve()); next(); });

  /** The 3D model once it can be seen, or null if this page has none (or it never turns up). */
  async function readyModel(frame) {
    const until = Date.now() + MODEL_WAIT;
    while (Date.now() < until) {
      const model = frame.querySelector('model-viewer');
      if (!model && frame.querySelector('img, [role="img"]')) return null; // no model here, or it failed
      if (model?.loaded) {
        await model.updateComplete;
        await wait(360); // the viewer's own fade-in
        await frames(3);
        return model;
      }
      await wait(60);
    }
    return null;
  }

  /** Where the art has to go for its product to sit on the model: same middle, same size. */
  async function onModel(model, art) {
    const shot = new Image();
    shot.src = model.toDataURL();
    await shot.decode();
    const sheet = document.createElement('canvas');
    sheet.width = 420;
    sheet.height = Math.round(420 * shot.height / shot.width);
    const pen = sheet.getContext('2d', { willReadFrequently: true });
    pen.drawImage(shot, 0, 0, sheet.width, sheet.height);
    const pixels = pen.getImageData(0, 0, sheet.width, sheet.height).data;
    let left = sheet.width, top = sheet.height, right = 0, bottom = 0;
    for (let y = 0; y < sheet.height; y++) {
      for (let x = 0; x < sheet.width; x++) {
        if (pixels[(y * sheet.width + x) * 4 + 3] > 200) { // solid parts only: the soft shadow doesn't count
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
    }
    if (right <= left || bottom <= top) return null;
    const box = model.getBoundingClientRect();
    const per = box.width / sheet.width;
    const name = new URL(art.src).pathname.split('/').pop().replace(/\.\w+$/, '');
    const [sl, st, sr, sb] = SUBJECTS[name] || [336, 192, 1008, 576];
    // screen pixels per art pixel: matched on area, since the drawing and the model aren't quite the same shape
    const scale = Math.sqrt(((right - left) * (bottom - top) * per * per) / ((sr - sl) * (sb - st)));
    return {
      slot: { left: box.left + left * per, top: box.top + top * per, width: (right - left) * per, height: (bottom - top) * per },
      x: box.left + ((left + right) / 2) * per - ((sl + sr) / 2 - 672) * scale,
      y: box.top + ((top + bottom) / 2) * per - ((st + sb) / 2 - 384) * scale,
      width: 1344 * scale, turn: 0,
    };
  }

  /** Four corner marks that close in on the model's place and lock. */
  function brackets(layer, slot) {
    const pad = 18;
    return [[0, 0, 0], [1, 0, 90], [1, 1, 180], [0, 1, 270]].map(([right, low, turn]) => {
      const mark = make('div', 'af-corner');
      Object.assign(mark.style, {
        left: slot.left + (right ? slot.width + pad - 46 : -pad) + 'px', top: slot.top + (low ? slot.height + pad - 46 : -pad) + 'px', rotate: turn + 'deg',
      });
      layer.append(mark);
      const out = (right ? 1 : -1) * 90 + 'px ' + (low ? 1 : -1) * 90 + 'px';
      mark.animate([{ translate: out, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2, 1.6, .35, 1)', fill: 'both' });
      return { mark, out };
    });
  }

  /** The hit: a ring and shards burst off the slot, the marks fly apart, the stage jolts. */
  function impact(layer, frame, slot, marks) {
    const ring = make('div', 'af-ring');
    Object.assign(ring.style, { left: slot.left + 'px', top: slot.top + 'px', width: slot.width + 'px', height: slot.height + 'px' });
    layer.append(ring);
    ring.animate([{ scale: '.9', opacity: 1 }, { scale: '1.5', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.1, .8, .3, 1)', fill: 'both' });
    shards(layer);
    marks.forEach(({ mark, out }) => mark.animate([{ translate: '0 0', opacity: 1 }, { translate: out, opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }));
    frame.closest('section')?.animate(
      [{ translate: '0 0' }, { translate: '-6px 9px' }, { translate: '5px -6px' }, { translate: '-3px 3px' }, { translate: '0 0' }],
      { duration: 260, easing: 'ease-out' },
    );
  }

  /** A slanted blade sweeps the screen under the top bar, in from off the left and out off the right: model behind
   *  it, drawing ahead of it. Its ends are never in view: one stays behind the bar's edge, one below the screen. */
  function cut(parts, model) {
    const art = parts.art.getBoundingClientRect();
    const middleY = innerHeight / 2;
    const across = (y, at) => at + (middleY - y) * LEAN; // where the blade is at height y
    const spare = innerHeight * LEAN * 0.5 + 90; // the lean's overhang, plus the blade and its glow
    const start = -spare, end = innerWidth + spare;
    const timing = { duration: 720, easing: 'cubic-bezier(.5, .1, .4, .95)', fill: 'both' };
    // a clip is measured in the element's own, unscaled box
    const clip = (element, rect, at, keepLeft) => {
      const scale = rect.width / element.offsetWidth;
      const top = (across(rect.top, at) - rect.left) / scale + 'px';
      const low = (across(rect.bottom, at) - rect.left) / scale + 'px';
      return keepLeft
        ? 'polygon(-100% 0, ' + top + ' 0, ' + low + ' 100%, -100% 100%)'
        : 'polygon(' + top + ' 0, 200% 0, 200% 100%, ' + low + ' 100%)';
    };
    const box = model.getBoundingClientRect();
    const reveal = model.animate([{ clipPath: clip(model, box, start, true) }, { clipPath: clip(model, box, end, true) }], timing);
    root.removeAttribute('data-art-landing'); // the model is now there, clipped to the side the blade has passed
    const hide = parts.art.animate([{ clipPath: clip(parts.art, art, start, false) }, { clipPath: clip(parts.art, art, end, false) }], timing);
    const blade = make('div', 'af-blade');
    // a window that starts at the foot of the top bar; the blade is only seen through it
    const under = Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom ?? 0);
    const view = make('div', '');
    Object.assign(view.style, { left: '0', right: '0', top: under + 'px', bottom: '0', overflow: 'hidden' });
    // taller than the screen and centred on it, so the lean pivots where the clip is measured
    Object.assign(blade.style, { position: 'absolute', left: '-8px', top: -40 - under + 'px', height: innerHeight + 80 + 'px' });
    view.append(blade);
    parts.layer.append(view);
    blade.animate([{ translate: start + 'px 0' }, { translate: end + 'px 0' }], timing);
    return Promise.all([reveal.finished, hide.finished]).catch(() => {}).then(() => { reveal.cancel(); });
  }

  /** Takes a flight's overlay away: once the model is ready, the backdrop clears and the art slots into its place. */
  async function settle(parts, frame, centre) {
    const model = await readyModel(frame);
    // the page must already be at rest behind the dim: jump its one-off entrances to their end
    (frame.parentElement || frame).getAnimations({ subtree: true })
      .filter((animation) => animation.effect.getComputedTiming().iterations !== Infinity)
      .forEach((animation) => animation.finish());
    const aim = model ? await onModel(model, parts.art).catch(() => null) : null;
    if (aim) await frames(2); // let the reading's cost pass before anything moves

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

    if (!aim) { // nothing to slot into: clear out gently
      await wait(300);
      root.removeAttribute('data-art-landing');
      await parts.art.animate({ opacity: [1, 0] }, { duration: 320, fill: 'forwards' }).finished.catch(() => {});
      parts.layer.remove();
      return;
    }

    const marks = brackets(parts.layer, aim.slot);
    // up over the slot, cocked and a size bigger, and a beat there
    const poised = { x: aim.x + 18, y: aim.y - Math.min(70, aim.slot.height * 0.14), width: aim.width * 1.2, turn: -8 };
    await parts.art.animate([{ transform: shift(centre, from) }, { transform: shift(centre, poised) }],
      { duration: 430, easing: 'cubic-bezier(.3, 1.25, .4, 1)', fill: 'forwards' }).finished.catch(() => {});
    await wait(90);
    // and down: slow to start, fastest at the moment it hits
    const pressed = { ...aim, width: aim.width * 0.95 };
    await parts.art.animate([{ transform: shift(centre, poised) }, { transform: shift(centre, pressed) }],
      { duration: 150, easing: 'cubic-bezier(.6, 0, 1, .6)', fill: 'forwards' }).finished.catch(() => {});
    impact(parts.layer, frame, aim.slot, marks);
    // it rebounds into its exact size and sits there for a blink before the blade comes
    await parts.art.animate([{ transform: shift(centre, pressed) }, { transform: shift(centre, { ...aim, width: aim.width * 1.035 }) }, { transform: shift(centre, aim) }],
      { duration: 240, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
    await cut(parts, model);
    parts.art.style.visibility = 'hidden';
    frame.animate({ scale: ['1', '1.05', '.985', '1'] }, { duration: 320, easing: 'ease-out' });
    await wait(240); // the ring and shards finish
    parts.layer.remove();
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

  // ---- changing product: the wipe ----
  const SLANT = 22; // vw: how far the cover's top edge sits right of its bottom edge, so it leans like a "/"
  const stageOf = (page) => page?.querySelector(':scope > section');
  const ride = (element, from, to, duration, easing) =>
    element.animate([{ translate: from }, { translate: to }], { duration, easing, fill: 'both' });

  const WIPE_CSS = `
    html[data-wipe] { overflow-x: clip; }
    html[data-wipe="away"] [data-product] > section { translate: 110vw 0; }
    html[data-wipe="home"] .dock { visibility: hidden; }
    [data-wipe-word] { position: fixed; left: 50%; top: 50%; translate: -50% -50%; z-index: 1001; pointer-events: none; white-space: nowrap; color: #F4F2F8;
      font: 900 clamp(72px, 15vw, 240px)/1 'Tektur', sans-serif; letter-spacing: .08em; }
    [data-wipe-cover] * { position: absolute; box-sizing: border-box; }
    html[data-wipe="up"] .dockbar, html[data-wipe="up"] .nav-logo { visibility: hidden !important; }
    [data-wipe-bar] { position: fixed; left: 0; top: 0; width: 100%; height: 93px; z-index: 1001; pointer-events: none; background: #0B0A0F; border-bottom: 1px solid var(--rule, #26252B);
      font: 400 14px/1 'Archivo', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #A6A5AD); }
    [data-wipe-bar] span { position: absolute; top: 24px; height: 44px; display: flex; align-items: center; white-space: nowrap; }
    [data-wipe-bar] span[data-here] { color: #B9A4FF; font-weight: 900; }
    [data-wipe-edge] { position: fixed; left: 0; top: 0; width: 18px; height: 93px; z-index: 1002; pointer-events: none; background: #B9A4FF; border-right: 4px solid #F4F2F8; transform: skewX(-22deg); }
    .as-noise { inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
    .as-lines { inset: 0; background: repeating-linear-gradient(rgba(0, 0, 0, .42) 0 2px, transparent 2px 4px); }
    .as-bar { left: 0; right: 0; top: 0; animation: as-roll linear infinite; }
    .as-bar.dark { background: linear-gradient(transparent, rgba(4, 3, 8, .82) 28%, rgba(4, 3, 8, .82) 72%, transparent); }
    .as-bar.lit { background: linear-gradient(transparent, rgba(185, 164, 255, .26) 55%, rgba(244, 242, 248, .34) 62%, transparent 70%); mix-blend-mode: screen; }
    @keyframes as-roll { from { transform: translateY(-100%); } to { transform: translateY(100vh); } }
    [data-wipe-logo] { position: fixed; left: 0; top: 0; z-index: 1003; pointer-events: none; white-space: nowrap; color: #F4F2F8; transform-origin: 0 50%;
      font: 900 36px/1 'Tektur', sans-serif; letter-spacing: .08em; }
    .aw-streak { top: 0; bottom: 0; left: 0; background: #B9A4FF; animation: aw-run linear infinite; }
    .aw-edge { top: 0; bottom: 0; background: #B9A4FF; }
    .aw-dots { inset: -30%; rotate: 22deg; background: radial-gradient(circle, rgba(185, 164, 255, .22) 2.5px, transparent 3px) 0 0 / 14px 14px; animation: aw-drift .45s linear infinite; }
    .aw-name { left: 50%; top: 44%; translate: -50% -50%; rotate: -5deg; white-space: nowrap; padding: 8px 30px 16px; background: #F4F2F8; color: #0B0A0F;
      border: 3px solid #000; box-shadow: 12px 12px 0 #B9A4FF; font: 900 clamp(40px, 6vw, 104px)/1 'Archivo', sans-serif; text-transform: uppercase; animation: aw-bob 1.1s ease-in-out infinite; }
    .aw-tune { left: 50%; top: 63%; translate: -50% 0; display: flex; align-items: flex-end; gap: 18px; white-space: nowrap; color: #F4F2F8; text-shadow: 4px 4px 0 #000;
      font: 400 22px/1 'Permanent Marker', cursive; }
    .aw-bars { position: static; display: flex; align-items: flex-end; gap: 4px; height: 24px; }
    .aw-bars i { position: static; width: 5px; height: 100%; background: #B9A4FF; transform-origin: bottom; animation: aw-level .4s ease-in-out infinite alternate; }
    @keyframes aw-run { from { translate: 150vw 0; } to { translate: -30vw 0; } }
    @keyframes aw-drift { to { background-position: -28px 14px; } }
    @keyframes aw-bob { 50% { scale: 1.035; } }
    @keyframes aw-level { from { transform: scaleY(.18); } }
  `;

  /** The slanted cover: mostly black, with lavender bands that keep running while the next product loads. */
  function makeCover(top, name) {
    const cover = make('div', '');
    cover.setAttribute('data-wipe-cover', '');
    cover.setAttribute('aria-hidden', 'true');
    // behind the page's own content (z-index -1), under the header: it shows wherever the products aren't
    Object.assign(cover.style, {
      position: 'fixed', zIndex: '-1', pointerEvents: 'none', left: '0', top: top + 'px', bottom: '0', overflow: 'hidden',
      width: 100 + SLANT * 2 + 'vw', background: '#0B0A0F',
      clipPath: 'polygon(' + SLANT + 'vw 0, 100% 0, calc(100% - ' + SLANT + 'vw) 100%, 0 100%)',
    });
    // the bands lean exactly as much as the cover's edges do
    const lean = -Math.atan((innerWidth * SLANT / 100) / (innerHeight - top)) * 180 / Math.PI;
    const band = (className, style) => {
      const element = make('div', className);
      Object.assign(element.style, { transform: 'skewX(' + lean + 'deg)' }, style);
      return element;
    };
    cover.append(make('div', 'aw-dots'));
    // width in vw, seconds per crossing, how far into its run it starts, opacity
    [[7, 1.5, 0.1, 0.9], [1.2, 0.9, 0.5, 1], [3, 1.2, 0.85, 0.5], [0.5, 0.7, 0.3, 0.9], [12, 2.1, 1.4, 0.14], [1.8, 1.05, 0.75, 0.7]].forEach(([width, time, start, opacity]) => {
      cover.append(band('aw-streak', { width: width + 'vw', opacity, animationDuration: time + 's', animationDelay: -start + 's' }));
    });
    // a solid highlight down each slanted edge
    cover.append(band('aw-edge', { left: SLANT / 2 + 'vw', width: '2.4vw' }), band('aw-edge', { left: SLANT / 2 + 3.4 + 'vw', width: '.5vw' }),
      band('aw-edge', { right: SLANT / 2 + 'vw', width: '2.4vw' }), band('aw-edge', { right: SLANT / 2 + 3.4 + 'vw', width: '.5vw' }));
    if (!name) return cover;
    const tune = make('div', 'aw-tune', 'tuning in…');
    const bars = make('div', 'aw-bars');
    for (let i = 0; i < 7; i++) {
      const bar = make('i', '');
      bar.style.animationDelay = -((i * 137) % 400) / 1000 + 's';
      bars.append(bar);
    }
    tune.append(bars);
    cover.append(make('div', 'aw-name', name), tune);
    return cover;
  }

  async function wipe(url, name) {
    const old = stageOf(document.querySelector('[data-product]'));
    if (!old) return location.assign(url);
    const sheet = make('style', '', WIPE_CSS);
    const cover = makeCover(Math.max(0, old.getBoundingClientRect().top), name);
    root.setAttribute('data-wipe', 'out');
    root.append(sheet);
    document.body.append(cover);
    const clear = () => { cover.remove(); sheet.remove(); root.removeAttribute('data-wipe'); };

    const gone = ride(old, '0 0', '-110vw 0', 240, 'cubic-bezier(.45, 0, .75, .55)').finished.catch(() => {});
    const across = ride(cover, '100vw 0', -SLANT + 'vw 0', 340, 'cubic-bezier(.5, 0, .2, 1)').finished.catch(() => {});
    await gone;
    root.setAttribute('data-wipe', 'away'); // whatever arrives next waits off to the right
    const page = await putInPlace(url);
    if (!page) return location.assign(url); // took too long: load it the ordinary way
    scrollTo({ top: 0, behavior: 'instant' });
    // while the cover is up, give the new model a moment to be drawable
    const started = Date.now();
    const model = () => page.querySelector('model-viewer');
    while (Date.now() - started < 900 && model() && !model().loaded) await wait(40);
    await across;

    const next = stageOf(page);
    const arriving = ride(next, '110vw 0', '0 0', 560, 'cubic-bezier(.22, .9, .25, 1)');
    root.setAttribute('data-wipe', 'in');
    const passed = ride(cover, -SLANT + 'vw 0', -(100 + SLANT * 2) + 'vw 0', 460, 'cubic-bezier(.55, 0, .6, 1)');
    await Promise.all([arriving.finished, passed.finished]).catch(() => {});
    arriving.cancel(); // hand the element back untouched
    clear();
  }

  // ---- from any page to home: the wordmark takes over, then settles into the landing's logo ----
  const HOME_KEY = 'statix-wipe-home';
  let ridden = []; // what the outgoing page has moved, to put back if the Back button restores it

  const wordmark = () => {
    const word = make('div', '', 'STATIX');
    word.setAttribute('data-wipe-word', '');
    word.setAttribute('aria-hidden', 'true');
    return word;
  };
  // where the letters themselves are, whatever box they sit in
  const lettersOf = (element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getBoundingClientRect();
  };

  const SLAM = [{ opacity: 0, scale: '2.2' }, { opacity: 1, scale: '.94', offset: 0.7 }, { opacity: 1, scale: '1' }];
  const SLAM_EASE = 'cubic-bezier(.3, .7, .3, 1)';

  async function wipeHome(url) {
    const sheet = make('style', '', WIPE_CSS);
    const cover = makeCover(0); // the landing has no header, so the whole window is covered
    const word = wordmark();
    root.setAttribute('data-wipe', 'out');
    root.append(sheet);
    document.body.append(cover);
    // the page's bar, content and foot all leave together
    const old = [...document.querySelectorAll('header, main, footer')];
    const gone = old.map((element) => ride(element, '0 0', '-110vw 0', 240, 'cubic-bezier(.45, 0, .75, .55)'));
    const across = ride(cover, '100vw 0', -SLANT + 'vw 0', 340, 'cubic-bezier(.5, 0, .2, 1)');
    ridden = [...gone, across];
    root.append(word);
    // it slams down out of a bigger size once the cover is nearly across
    const slam = word.animate(SLAM, { duration: 380, delay: 200, easing: SLAM_EASE, fill: 'both' });
    await Promise.all([across.finished, slam.finished]).catch(() => {});
    try { sessionStorage.setItem(HOME_KEY, String(Date.now())); } catch { /* storage blocked: home just opens */ }
    location.assign(url);
  }

  /** On the landing: cover and wordmark are up from the first paint; the cover leaves and the word shrinks home.
   *  As the intro, the cover is plain black and the word has to slam in here, having no page to come from. */
  function arriveHome(intro) {
    let arrived = Date.now();
    const sheet = make('style', '', WIPE_CSS);
    const cover = makeCover(0);
    const word = wordmark();
    let over = () => {};
    if (intro) {
      cover.replaceChildren();
      word.style.opacity = '0'; // unseen until its font is in
      window.statixIntro = new Promise((resolve) => { over = resolve; });
      history.scrollRestoration = 'manual'; // a reload would otherwise jump back down under the cover
      // fetched now, so the model is ready to leap out as the cover goes. Same addresses as in landing.js
      for (const [rel, href] of [['modulepreload', 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js'], ['preload', '/assets/statix_cube.glb?v=3']]) {
        const link = make('link', '');
        Object.assign(link, { rel, crossOrigin: 'anonymous' });
        if (rel === 'preload') link.as = 'fetch';
        link.href = href;
        document.head.append(link);
      }
    }
    // over the page this time: it is still being built underneath
    Object.assign(cover.style, { zIndex: '1000', translate: -SLANT + 'vw 0' });
    root.setAttribute('data-wipe', 'home'); // keeps the page's own logo hidden until ours has landed on it
    root.append(sheet, cover, word); // outside <body>, which doesn't exist yet
    const clear = () => { cover.remove(); word.remove(); sheet.remove(); root.removeAttribute('data-wipe'); history.scrollRestoration = 'auto'; over(); };
    const failsafe = setTimeout(clear, 6000);
    const settleWord = async () => {
      const loaded = new Promise((resolve) => (document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true })));
      await Promise.race([loaded.then(() => document.fonts.load('900 100px Tektur')).then(() => document.fonts.ready), wait(2000)]);
      if (intro) {
        await word.animate(SLAM, { duration: 380, easing: SLAM_EASE, fill: 'both' }).finished.catch(() => {});
        word.style.opacity = '';
        arrived = Date.now();
      }
      await wait(Math.max(0, 420 - (Date.now() - arrived))); // long enough to be seen at full size
      scrollTo({ top: 0, behavior: 'instant' });
      const logo = document.querySelector('.dock');
      if (!logo) { clearTimeout(failsafe); return clear(); }
      // the logo must be where it will stay before it is measured
      (logo.parentElement || logo).getAnimations({ subtree: true })
        .filter((animation) => animation.effect.getComputedTiming().iterations !== Infinity)
        .forEach((animation) => animation.finish());
      const from = lettersOf(word);
      const to = lettersOf(logo);
      const x = to.left + to.width / 2 - (from.left + from.width / 2);
      const y = to.top + to.height / 2 - (from.top + from.height / 2);
      const passed = ride(cover, -SLANT + 'vw 0', -(100 + SLANT * 2) + 'vw 0', 520, 'cubic-bezier(.7, 0, .3, 1)');
      // a breath in, then it travels to the corner as it shrinks
      const shrink = word.animate(
        [{ translate: '-50% -50%', scale: '1' }, { translate: '-50% -50%', scale: '1.08', offset: 0.2 },
          { translate: 'calc(-50% + ' + x + 'px) calc(-50% + ' + y + 'px)', scale: String(to.width / from.width) }],
        { duration: 760, easing: 'cubic-bezier(.65, 0, .2, 1)', fill: 'forwards' },
      );
      await Promise.all([shrink.finished, passed.finished]).catch(() => {});
      clearTimeout(failsafe);
      clear(); // the page's logo appears exactly where ours was
      logo.animate({ scale: ['1', '1.12', '.97', '1'] }, { duration: 320, easing: 'ease-out' });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settleWord);
    else settleWord();
  }

  // ---- from the landing to a page with the header: the logo goes to the middle and the header forms along it ----
  const UP_KEY = 'statix-wipe-up';
  const PAGES = { '/drop/001': 'Drop 001', '/login': 'Log in' };
  const WIDE = '(min-width: 900px)'; // where shell.module.css centres the logo; narrower headers are laid out otherwise
  const HEADER = 93; // that header's height

  /** The next page's header, as shell.module.css lays it out, for a visitor who is not signed in. */
  function headerBar(path) {
    const bar = make('div', '');
    bar.setAttribute('data-wipe-bar', '');
    bar.setAttribute('aria-hidden', 'true');
    const side = 'max(clamp(20px, 4vw, 56px), calc(50vw - 720px))';
    for (const [href, at] of [['/drop/001', 'left'], ['/login', 'right']]) {
      const link = make('span', '', PAGES[href]);
      // measured from the window, as the real one is, so a scrollbar nudges nothing
      link.style.left = at === 'left' ? side : 'auto';
      if (at === 'right') link.style.right = 'calc(' + side + ' - (100vw - 100%))';
      if (href === path) link.setAttribute('data-here', '');
      bar.append(link);
    }
    return bar;
  }

  const headerLogo = () => {
    const logo = make('div', '', 'STATIX');
    logo.setAttribute('data-wipe-logo', '');
    logo.setAttribute('aria-hidden', 'true');
    return logo;
  };
  // the transform that centres the logo in the header
  const centred = (logo) => 'translate(' + (innerWidth - logo.offsetWidth) / 2 + 'px, ' + (46 - logo.offsetHeight / 2) + 'px) scale(1)';

  // dim lavender grey, darkest to lightest, as the canvas wants them (ABGR)
  const SHADES = [10, 22, 34, 48, 64, 84, 108, 140].map((v) => (255 << 24) | (Math.min(255, v * 1.12) << 16) | ((v * 0.94) << 8) | v);
  const SNOW = { width: 192, height: 108 };
  let snow; // the one noise canvas, shared by every transition

  /** The noise canvas, redrawn about 30 times a second for as long as it is on the page, and not a frame longer. */
  function liveNoise() {
    if (!snow) {
      snow = make('canvas', 'as-noise');
      Object.assign(snow, SNOW);
    }
    const canvas = snow;
    const pen = canvas.getContext('2d');
    const picture = pen.createImageData(SNOW.width, SNOW.height);
    const pixels = new Uint32Array(picture.data.buffer);
    const paint = () => {
      for (let y = 0, i = 0; y < SNOW.height; y++) {
        // some rows run brighter or darker than others, as a weak signal does
        const row = Math.random() < 0.07 ? (Math.random() < 0.5 ? 3 : -3) : 0;
        for (let x = 0; x < SNOW.width; x++, i++) pixels[i] = SHADES[Math.max(0, Math.min(7, ((Math.random() * 7) | 0) + row))];
      }
      pen.putImageData(picture, 0, 0);
    };
    paint();
    if (!canvas.running) {
      canvas.running = true;
      let last = 0, wasOn = false;
      const tick = (now) => {
        wasOn = wasOn || canvas.isConnected;
        if (wasOn && !canvas.isConnected) { canvas.running = false; return; }
        if (now - last > 32) { last = now; paint(); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    return canvas;
  }

  // the rolling bars: [kind, height in vh, seconds per pass, how far into its pass it starts]
  const BARS = [['dark', 30, 1.3, 0.2], ['dark', 12, 0.85, 0.65], ['dark', 5, 2.1, 0.45], ['lit', 22, 1.05, 0.35]];

  /** TV static over everything under the header: snow, scanlines and bars rolling down it. It only fades in and out,
   *  and the snow is dim, so the screen as a whole never flashes. */
  function staticCover(top = HEADER) {
    const cover = make('div', '');
    cover.setAttribute('data-wipe-cover', '');
    cover.setAttribute('aria-hidden', 'true');
    Object.assign(cover.style, { position: 'fixed', zIndex: '1000', pointerEvents: 'none', left: '0', right: '0', top: top + 'px', bottom: '0', overflow: 'hidden', background: '#0B0A0F' });
    const bars = BARS.map(([kind, height, seconds, into]) => {
      const bar = make('div', 'as-bar ' + kind);
      // timed by the clock, so the bars carry on from where they were when the next page draws them again
      Object.assign(bar.style, { height: height + 'vh', animationDuration: seconds + 's', animationDelay: -((Date.now() / 1000 + into * seconds) % seconds) + 's' });
      return bar;
    });
    cover.append(liveNoise(), ...bars, make('div', 'as-lines'));
    return {
      element: cover,
      arrive: () => cover.animate({ opacity: [0, 1] }, { duration: 260, easing: 'ease-in', fill: 'both' }),
      leave: () => cover.animate({ opacity: [1, 0] }, { duration: 340, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {}),
    };
  }

  async function wipeUp(url) {
    const sheet = make('style', '', WIPE_CSS);
    // the logo sets off from wherever the landing is showing its own: the corner chip once scrolled, else the top left
    const home = document.querySelector('.dock');
    const spot = home.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(home).fontSize);
    const padding = parseFloat(getComputedStyle(home).paddingLeft);
    root.append(sheet);
    const bar = headerBar(url.pathname);
    const edge = make('div', '');
    edge.setAttribute('data-wipe-edge', '');
    const logo = headerLogo();
    root.append(bar, edge, logo);
    root.setAttribute('data-wipe', 'up');

    const timing = { duration: 720, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'both' };
    const from = 'translate(' + (spot.left + padding) + 'px, ' + (spot.top + spot.height / 2 - logo.offsetHeight / 2) + 'px) scale(' + size / 36 + ')';
    // the bar is drawn from the left, a lavender blade on its leading edge, as the logo travels along it
    const drawn = bar.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], timing);
    const blade = edge.animate([{ translate: '-40px 0' }, { translate: innerWidth + 40 + 'px 0' }], timing);
    const moved = logo.animate([{ transform: from }, { transform: centred(logo) }], timing);
    ridden = [drawn, blade, moved];
    await Promise.all([drawn.finished, moved.finished]).catch(() => {});
    edge.remove();

    // then the loading is covered, under the header only
    const cover = staticCover();
    root.append(cover.element);
    const faded = cover.arrive();
    ridden.push(faded);
    await faded.finished.catch(() => {});
    await wait(HOLD_OUT);
    try { sessionStorage.setItem(UP_KEY, JSON.stringify({ path: url.pathname, left: Date.now() })); } catch { /* storage blocked: the page just opens */ }
    location.assign(url);
  }

  /** On the next page: header and cover are up from the first paint; once it is ready its own header takes over. */
  function arriveUp(path) {
    const arrived = Date.now();
    const sheet = make('style', '', WIPE_CSS);
    const bar = headerBar(path);
    const logo = headerLogo();
    const cover = staticCover();
    root.append(sheet, cover.element, bar, logo); // outside <body>, which doesn't exist yet
    // centred by the stylesheet's own means: its font is not in yet, so a width measured now would put it off centre
    Object.assign(logo.style, { left: '50vw', top: '46px', translate: '-50% -50%', transformOrigin: '50% 50%' });
    const clear = () => { cover.element.remove(); bar.remove(); logo.remove(); sheet.remove(); };
    const failsafe = setTimeout(clear, 6000);
    const reveal = async () => {
      const loaded = new Promise((resolve) => (document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true })));
      await Promise.race([loaded.then(() => document.fonts.ready), wait(2500)]);
      await wait(Math.max(0, HOLD_IN - (Date.now() - arrived)));
      // the page's own header is under ours, laid out the same
      bar.remove();
      logo.remove();
      await cover.leave();
      clearTimeout(failsafe);
      clear();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
    else reveal();
  }

  // ---- between the other pages, by the header's links: the header stays and static fades over what is under it ----
  async function fadeTo(url) {
    const header = () => document.querySelector('header');
    const under = () => Math.max(0, header()?.getBoundingClientRect().bottom ?? 0);
    const sheet = make('style', '', WIPE_CSS);
    const cover = staticCover(under());
    root.append(sheet, cover.element);
    await cover.arrive().finished.catch(() => {});
    const from = location.pathname;
    window.statixGo(url.pathname + url.search);
    // the address changes once the new page is in; it may not be the one asked for (signed in, /login goes elsewhere)
    const started = Date.now();
    while (location.pathname === from && Date.now() - started < 8000) await wait(40);
    if (location.pathname === from) return location.assign(url); // took too long: load it the ordinary way
    await Promise.race([document.fonts.ready, wait(1000)]);
    await frames(3);
    await wait(Math.max(0, HOLD_OUT - (Date.now() - started)));
    cover.element.style.top = under() + 'px';
    await cover.leave();
    cover.element.remove();
    sheet.remove();
  }

  // ---- leaving ----
  let leaving = false;
  async function takeOff(card, image) {
    const url = new URL(card.href);
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

    // past the mark by a little, then settle
    await fly(parts.art, { ...from, turn: -6 }, middle(), { duration: 480, easing: 'cubic-bezier(.3, 1.5, .35, 1)' });
    float(parts.art, since);
    parts.dim.animate({ backgroundColor: SOLID }, { duration: HOLD_OUT, fill: 'forwards' });
    await wait(HOLD_OUT);
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ src: parts.art.src, name, path: url.pathname, since, left: Date.now() }));
    } catch { /* storage blocked: the next page just opens normally */ }
    location.assign(url);
  }

  addEventListener('click', (event) => {
    // the landing's own links to the drop and to log in, in its header, menu and footer
    const onward = location.pathname === '/' && matchMedia(WIDE).matches ? event.target.closest?.('a[href="/drop/001"], a[href="/login"]') : null;
    const top = location.pathname !== '/' && window.statixGo
      ? event.target.closest?.('header nav a[href="/drop/001"], header nav a[href="/login"], header nav a[href="/account"]') : null;
    const across = top && top.pathname !== location.pathname ? top : null;
    const card = onward || across || event.target.closest?.('a[data-art-fly], a[data-switch], a[data-home]');
    if (!card || calm() || root.classList.contains('paused') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (onward) {
      event.preventDefault();
      if (!leaving) { leaving = true; wipeUp(new URL(onward.href)); }
      return;
    }
    if (across) {
      event.preventDefault(); // also stops Next's link: the page changes once the static is up
      if (!leaving) { leaving = true; fadeTo(new URL(across.href)).finally(() => { leaving = false; }); }
      return;
    }
    if (card.hasAttribute('data-home')) {
      event.preventDefault();
      if (!leaving) { leaving = true; wipeHome(new URL(card.href)); }
      return;
    }
    const switching = card.hasAttribute('data-switch') && window.statixSwitch;
    const image = card.hasAttribute('data-art-fly') ? card.querySelector('.panel-art') : null;
    if (!switching && !image) return;
    event.preventDefault(); // also stops Next's link, so every marked card takes this path
    if (leaving) return;
    leaving = true;
    if (switching) wipe(new URL(card.href), card.dataset.name || card.querySelector('h3')?.textContent.trim() || 'STATIX').finally(() => { leaving = false; });
    else takeOff(card, image);
  }, true);

  // coming back with the Back button can restore the page as it was left, overlay and all
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    leaving = false;
    ridden.forEach((animation) => animation.cancel());
    ridden = [];
    document.querySelectorAll('[data-art-layer], [data-wipe-cover], [data-wipe-word], [data-wipe-bar], [data-wipe-edge], [data-wipe-logo]').forEach((layer) => layer.remove());
    root.removeAttribute('data-wipe');
    document.querySelectorAll('.panel-art').forEach((image) => { image.style.visibility = ''; });
  });

  // ---- arriving ----
  let homeward = 0;
  try {
    homeward = Number(sessionStorage.getItem(HOME_KEY));
    sessionStorage.removeItem(HOME_KEY);
  } catch { /* nothing to finish */ }
  if (homeward && location.pathname === '/' && Date.now() - homeward < 8000 && !calm()) return arriveHome();
  // entering or reloading the landing; not Back/Forward, nor a link into one of its sections
  if (location.pathname === '/' && !location.hash && !calm() && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') return arriveHome(true);

  let up = null;
  try {
    up = JSON.parse(sessionStorage.getItem(UP_KEY));
    sessionStorage.removeItem(UP_KEY);
  } catch { /* nothing to finish */ }
  if (up && up.path === location.pathname && Date.now() - up.left < 8000 && !calm() && matchMedia(WIDE).matches) return arriveUp(up.path);

  let flight = null;
  try {
    flight = JSON.parse(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
  } catch { /* nothing to land */ }
  if (!flight || flight.path !== location.pathname || Date.now() - flight.left > 8000 || calm()) return;

  const arrived = Date.now();
  root.setAttribute('data-art-landing', ''); // the page keeps its own art hidden until ours arrives
  const centre = middle();
  root.setAttribute('data-switched', ''); // no entrances: the page is revealed finished
  const parts = stage(flight.src, flight.name, centre, flight.since);
  parts.dim.style.background = SOLID;
  float(parts.art, flight.since);
  const finish = () => { root.removeAttribute('data-art-landing'); parts.layer.remove(); };
  const failsafe = setTimeout(finish, MODEL_WAIT + 4000);

  async function land() {
    // always start at the top, so the frame is where the art is about to go
    scrollTo({ top: 0, behavior: 'instant' });
    const frame = document.querySelector('[data-art-frame]');
    if (!frame) return finish();
    // wait for pictures, styles and fonts, but never more than 2 s on a slow connection
    const loaded = new Promise((resolve) => (document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true })));
    const drawn = loaded.then(() => Promise.all([...document.images].filter((image) => image.loading !== 'lazy').map((image) => image.decode().catch(() => {}))));
    await Promise.race([Promise.all([parts.art.decode().catch(() => {}), drawn.then(() => document.fonts.ready)]), wait(2000)]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); // let it paint under the cover
    await wait(Math.max(0, HOLD_IN - (Date.now() - arrived)));

    await settle(parts, frame, centre);
    clearTimeout(failsafe);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', land);
  else land();
})();
