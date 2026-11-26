// one 160px tile of TV noise, shown at 2x; CSS does all the movement
const tile = document.createElement('canvas');
tile.width = tile.height = 160;
const ctx = tile.getContext('2d');
const noise = ctx.createImageData(160, 160);
for (let i = 0; i < noise.data.length; i += 4) {
  const v = Math.random() * 255;
  noise.data.set([v * .86, v * .8, v, 255], i);
}
ctx.putImageData(noise, 0, 0);
document.documentElement.style.setProperty('--static', 'url(' + tile.toDataURL() + ')');

const motionToggle = document.querySelector('.motion-toggle');
motionToggle.addEventListener('click', () => {
  const paused = document.documentElement.classList.toggle('paused');
  motionToggle.setAttribute('aria-pressed', String(paused));
});

// hero rotation: photo, name tag and 3D model change together.
// 3D viewer and models are fetched after the page has loaded, so they are ready before anyone reaches for the frame.
// bump ?v= when a model file changes, so browsers drop the cached one
const slides = [
  { name: 'Speaker', photo: '/assets/speaker.jpg', alt: 'STATIX Speaker: a clear cube speaker with a knurled top dial', model: '/assets/statix_cube.glb?v=3', modelAlt: '3D model of the STATIX Speaker cube. Drag to rotate.' },
  { name: 'Amp', photo: '/assets/amp.jpg', alt: 'STATIX Amp in a clear shell', model: '/assets/statix_amp.glb?v=1', modelAlt: '3D model of the STATIX Amp. Drag to rotate.' },
  { name: 'Stand', photo: '/assets/stand.jpg', alt: 'STATIX Stand in violet acrylic', model: '/assets/statix_stand.glb?v=1', modelAlt: '3D model of the STATIX Stand. Drag to rotate.', distance: '140%' } // tall: the camera sits back so it fits a short screen
];
const frame = document.querySelector('.frame-wrap');
const photo = frame.querySelector('.hero-photo');
const tag = frame.querySelector('.caption-sticker');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let current = 0, wanted = false, dragging = false;

function loadModels() {
  if (slides[0].viewer) return;
  const library = document.createElement('script');
  library.type = 'module';
  library.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  document.head.append(library);
  for (const slide of slides) {
    const viewer = slide.viewer = document.createElement('model-viewer');
    viewer.className = 'pop-model';
    viewer.classList.toggle('is-current', slide === slides[current]);
    const attrs = {
      alt: slide.modelAlt,
      'camera-controls': '', 'disable-zoom': '', 'disable-pan': '', 'touch-action': 'pan-y',
      loading: 'eager', 'interaction-prompt': 'none', 'environment-image': 'neutral', exposure: '1.4',
      'camera-orbit': '30deg 72deg ' + (slide.distance || 'auto'), 'max-camera-orbit': 'auto auto ' + (slide.distance || 'auto'), 'rotation-per-second': '40deg', 'auto-rotate-delay': '0'
    };
    for (const [name, value] of Object.entries(attrs)) viewer.setAttribute(name, value);
    viewer.addEventListener('load', () => { slide.ready = true; update(); });
    // if it cannot load (offline, or opened as a file://), the photo simply stays
    viewer.addEventListener('error', event => console.warn('3D ' + slide.name + ' did not load', event.detail));
    frame.append(viewer);
  }
}

const picks = [...document.querySelectorAll('.switcher button')];

function nextSlide() {
  // hold while someone is looking at it, when motion is paused or reduced, and in a background tab
  if (wanted || document.hidden || still() || frame.matches(':focus-visible') || picks.some(pick => pick.matches(':focus-visible'))) return;
  showSlide((current + 1) % slides.length);
}

function still() {
  return reduceMotion.matches || document.documentElement.classList.contains('paused');
}

function restartTurn() {
  clearInterval(turn);
  turn = setInterval(nextSlide, 6000);
}

function showSlide(index) {
  current = index;
  const slide = slides[current];
  picks.forEach((pick, i) => pick.setAttribute('aria-pressed', String(i === current)));
  frame.setAttribute('aria-label', 'STATIX ' + slide.name + '. Focus to view it in 3D; press Escape to close.');
  for (const other of slides) other.viewer?.classList.toggle('is-current', other === slide);
  if (wanted && slide.viewer) fetchModel(slide);
  throwCard(slide);
}

// card throw: the old photo is flung off left, the new one slams in from the right, then the tag stamps down
async function throwCard(slide) {
  const card = photo.parentElement;
  // a click can arrive mid-throw: drop whatever is still running
  for (const running of [...card.getAnimations(), ...tag.getAnimations()]) running.cancel();
  const swap = () => {
    photo.src = slide.photo;
    photo.alt = slide.alt;
    tag.textContent = slide.name;
  };
  // paused or reduced motion: a hand-picked product swaps with no animation
  if (still()) { frame.classList.remove('throwing'); swap(); return; }
  frame.classList.add('throwing');
  const out = card.animate(
    // solid for most of the flight, so the backing does not show through
    [{ transform: 'rotate(-4deg)', opacity: 1 }, { opacity: 1, offset: .75 }, { transform: 'translateX(-85%) rotate(-30deg) scale(.7)', opacity: 0 }],
    { duration: 280, easing: 'cubic-bezier(.5, 0, 1, .6)', fill: 'forwards' });
  const tagOut = tag.animate({ opacity: [1, 0] }, { duration: 120, fill: 'forwards' });
  try { await out.finished; } catch { return; } // cancelled by a newer throw
  swap();
  await photo.decode().catch(() => {}); // a photo that fails to decode must not leave the card off screen
  if (slide !== slides[current]) return;
  out.cancel();
  const landing = card.animate([
    { transform: 'translateX(90%) rotate(24deg) scale(1.3)', opacity: 0 },
    { opacity: 1, offset: .15 },
    { transform: 'translateX(-5%) rotate(-9deg) scale(1.05)', offset: .65 },
    { transform: 'rotate(-4deg)' }
  ], { duration: 480, easing: 'ease-out' });
  landing.finished.then(() => frame.classList.remove('throwing'), () => {});
  // the lavender backing takes the hit
  document.querySelector('.quad').animate(
    { rotate: ['0deg', '-7deg', '4deg', '0deg'], scale: ['1', '1.08', '.97', '1'] },
    { duration: 380, delay: 280, easing: 'ease-out' });
  tagOut.cancel();
  // 'backwards' keeps the tag hidden until its turn to land
  tag.animate(
    [{ transform: 'rotate(28deg) scale(2.4)', opacity: 0 }, { transform: 'rotate(6deg) scale(1)', opacity: 1 }],
    { duration: 320, delay: 360, easing: 'cubic-bezier(.2, 1.5, .4, 1)', fill: 'backwards' });
}
let turn = setInterval(nextSlide, 6000);
picks.forEach((pick, i) => pick.addEventListener('click', () => {
  if (i === current) return;
  release();
  restartTurn(); // the picked product gets a full turn
  showSlide(i);
}));

// a drag may wander off the frame: stay open until the button is let go
frame.addEventListener('pointerdown', event => { if (event.target.classList.contains('pop-model')) dragging = true; });
function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  if (event.pointerType === 'mouse' && !frame.contains(document.elementFromPoint(event.clientX, event.clientY))) release();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function update() {
  const { ready, viewer } = slides[current];
  const show = Boolean(wanted && ready);
  if (show) viewer.toggleAttribute('auto-rotate', !reduceMotion.matches && !document.documentElement.classList.contains('paused'));
  frame.classList.toggle('popped', show);
}

// a model (up to 5 MB) is downloaded the first time someone reaches for it, not on page load
function fetchModel(slide) {
  if (!slide.viewer.hasAttribute('src')) slide.viewer.setAttribute('src', slide.model);
}

function reach() {
  loadModels();
  fetchModel(slides[current]);
  wanted = true;
  update();
}

function release() {
  // a full turn again after looking, so the product does not change the moment the pointer leaves
  if (wanted) restartTurn();
  wanted = false;
  slides[current].viewer?.removeAttribute('auto-rotate'); // no spinning while hidden
  frame.classList.remove('popped');
}

// waits for load so the models do not slow the first paint; reach() below still covers an early hover
// Next.js runs this script after the window load event, so check readyState too.
if (document.readyState === 'complete') loadModels(); else addEventListener('load', loadModels);

frame.addEventListener('pointerenter',event => { if (event.pointerType === 'mouse') reach(); });
frame.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && !dragging) release(); });
frame.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse' && !wanted) reach(); });
document.addEventListener('pointerdown', event => { if (!frame.contains(event.target)) release(); });
frame.addEventListener('focus', () => { if (frame.matches(':focus-visible')) reach(); });
frame.addEventListener('blur', release);
frame.addEventListener('keydown', event => { if (event.key === 'Escape') release(); });

const tapes = document.querySelector('.tape-wrap');
new ResizeObserver(() => document.documentElement.style.setProperty('--tapes', tapes.offsetHeight + 'px')).observe(tapes);

const tailParts = [document.querySelector('.wordmark-wrap'), document.querySelector('.page > footer')];
const tailSize = new ResizeObserver(() => {
  document.documentElement.style.setProperty('--tail', tailParts.reduce((sum, part) => sum + part.offsetHeight, 0) + 'px');
});
tailParts.forEach(part => tailSize.observe(part));

// sticky menu: scrolling turns the logo into a chip, the surface underneath decides its colours
const dock = document.querySelector('.dock');
const dockbar = document.querySelector('.dockbar');
// open state is set from the pointer type: touch browsers leave :hover stuck on the last tap, so CSS :hover is not used
const noHover = matchMedia('(hover: none)');
const closeMenu = () => dockbar.classList.remove('is-open', 'is-hover');
dockbar.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') dockbar.classList.add('is-hover'); });
dockbar.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') dockbar.classList.remove('is-hover'); });
// touch: the first tap on the logo opens the menu, a second goes to the top, a tap elsewhere closes it
dock.addEventListener('click', event => {
  if (!noHover.matches || !dockbar.classList.contains('is-stuck') || dockbar.classList.contains('is-open')) { dockbar.classList.remove('is-open'); return; }
  event.preventDefault();
  dockbar.classList.add('is-open');
});
for (const link of dockbar.querySelectorAll('a.fan-item')) link.addEventListener('click', () => dockbar.classList.remove('is-open'));
document.addEventListener('pointerdown', event => { if (!dockbar.contains(event.target)) closeMenu(); });
dockbar.addEventListener('keydown', event => { if (event.key === 'Escape') { document.activeElement.blur(); closeMenu(); } });
// listed from back to front: the last match under the logo wins
const surfaces = [...document.querySelectorAll('.section.vote, .vote-panel, .tape-a, .tape-b, .slab, .panel h3, .console, .signup')];
let queued = false;

function toneAt(x, y) {
  let colour = null;
  for (const surface of surfaces) {
    const r = surface.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const rgba = getComputedStyle(surface).backgroundColor.match(/[\d.]+/g).map(Number);
    if (rgba[3] !== 0) colour = rgba;
  }
  return colour && (colour[0] * .299 + colour[1] * .587 + colour[2] * .114) > 130 ? 'light' : 'dark';
}

const cards = [...dockbar.querySelectorAll('a.fan-item')];
function paintTones() {
  const box = dock.getBoundingClientRect();
  dock.dataset.tone = toneAt(box.left + box.width / 2, box.top + box.height / 2);
  // worked out from each card's open position, so the colour is right before it has finished swinging out
  const root = dockbar.getBoundingClientRect();
  for (const card of cards) {
    const value = name => parseFloat(card.style.getPropertyValue(name));
    card.dataset.tone = toneAt(root.left + value('--x') + 70, root.top + value('--y'));
  }
}

const headerNav = document.querySelector('.nav-links');
const headerLinks = [...headerNav.children];
let merged = null, flights = [];

function mergeNav(stuck) {
  if (stuck === merged) return;
  const first = merged === null;
  merged = stuck;
  flights.forEach(ghost => ghost.remove());
  flights = [];
  const show = visible => headerLinks.forEach(link => { link.style.visibility = visible ? '' : 'hidden'; });
  // no flight on page load, with motion paused or reduced, or when the links are already out of view
  if (first || still() || headerNav.getBoundingClientRect().bottom + (stuck ? 0 : scrollY) <= 0) {
    show(!stuck);
    return;
  }
  show(false);
  headerLinks.forEach((link, i) => {
    const box = link.getBoundingClientRect();
    const top = box.top + scrollY; // its place with the page at the top, so the whole flight is on screen
    const { offsetWidth: width, offsetHeight: height } = link; // unskewed size: the measured box of a slanted button is wider than the button
    const ghost = link.cloneNode(true);
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    // leaving: fixed to the window, so scrolling on cannot drag a copy off course. Coming back: placed on the page itself,
    // so it lands exactly on the real link even if the scroll has not quite reached the top
    const pageY = stuck ? 0 : scrollY;
    Object.assign(ghost.style, { position: stuck ? 'fixed' : 'absolute', left: box.left + (box.width - width) / 2 + 'px', top: top + (box.height - height) / 2 + 'px', width: width + 'px', height: height + 'px', margin: 0, zIndex: 31, whiteSpace: 'nowrap', visibility: 'visible', pointerEvents: 'none', transition: 'none', font: getComputedStyle(link).font });
    document.body.append(ghost);
    flights.push(ghost);
    const rest = getComputedStyle(link).transform === 'none' ? '' : getComputedStyle(link).transform;
    // 34,34 is the middle of the "S" chip
    const inLogo = { transform: `translate(${34 - box.left - box.width / 2}px, ${34 + pageY - top - box.height / 2}px) ${rest} scale(.15)`, opacity: 0 };
    const frames = [{ transform: rest || 'none', opacity: 1 }, { opacity: 1, offset: .75 }, inLogo];
    const flight = ghost.animate(stuck ? frames : [inLogo, { opacity: 1, offset: .25 }, frames[0]],
      { duration: 460, delay: (stuck ? i : headerLinks.length - 1 - i) * 55, easing: 'cubic-bezier(.5, 0, .25, 1)', fill: 'both' });
    flight.onfinish = () => {
      if (!stuck) link.style.visibility = ''; // same frame as the copy leaves, so nothing blinks
      ghost.remove();
      flights = flights.filter(other => other !== ghost);
    };
  });
  // the chip gives a bump as the last one lands
  if (stuck) dock.animate({ scale: ['1', '1.22', '1'] }, { duration: 260, delay: 460 + (headerLinks.length - 1) * 55 - 90, easing: 'ease-out' });
}

function updateDock() {
  queued = false;
  const stuck = window.scrollY > 24;
  dock.classList.toggle('is-stuck', stuck);
  dockbar.classList.toggle('is-stuck', stuck);
  mergeNav(stuck);
  paintTones();
}

function queueDock() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(updateDock);
}

addEventListener('scroll', queueDock, { passive: true });
addEventListener('resize', queueDock);
// the vote backdrop and the logo's own move change what is underneath without a scroll
document.addEventListener('transitionend', event => {
  if (event.target === dock || event.target === dockbar || event.target.classList.contains('vote')) paintTones();
});
updateDock();

// the opening time and the server clock come from the API below; these are the fallback until it answers
let target = Date.parse('2026-12-20T20:00:00+07:00');
let clockOffset = 0;

function timeParts(ms) {
  const t = Math.max(0, ms);
  const total = Math.floor(t / 1000);
  const pad = n => String(n).padStart(2, '0');
  return [
    pad(Math.floor(total / 86400)),
    pad(Math.floor(total / 3600) % 24),
    pad(Math.floor(total / 60) % 60),
    pad(total % 60)
  ];
}

console.assert(
  JSON.stringify(timeParts(-5)) === '["00","00","00","00"]' && JSON.stringify(timeParts(90061000)) === '["01","01","01","01"]',
  'timeParts self-check'
);

const dDays = document.getElementById('d-days');
const dHours = document.getElementById('d-hours');
const dMin = document.getElementById('d-min');
const dSec = document.getElementById('d-sec');

function renderCountdown() {
  const parts = timeParts(target - (Date.now() + clockOffset));
  dDays.textContent = parts[0];
  dHours.textContent = parts[1];
  dMin.textContent = parts[2];
  dSec.textContent = parts[3];
}

renderCountdown();
setInterval(renderCountdown, 1000);

// live drop state and stock (FR-014, FR-016). If the server can't be reached, the page keeps what it shows.
const countLabel = document.querySelector('.count-label');
const scheduledLabel = countLabel.innerHTML;
const stockText = document.getElementById('stock-text');
const stockFill = document.querySelector('.stock-bar span');
const liveLabels = { early_access: 'Drop 001 early access is on. Public opening soon', public: 'Drop 001 is live', sold_out: 'Drop 001 is sold out', closed: 'Drop 001 is closed' };
let shownState = 'scheduled';

async function pollDrop() {
  try {
    const response = await fetch('/api/drops/1', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(response.status);
    const drop = await response.json();
    clockOffset = Date.parse(drop.serverNow) - Date.now();
    if (drop.publicAt) target = Date.parse(drop.publicAt);
    renderCountdown();
    // the whole drop: every edition added together
    const size = drop.editions.reduce((sum, edition) => sum + edition.size, 0);
    const left = drop.editions.reduce((sum, edition) => sum + edition.left, 0);
    const text = size + ' units / ' + left + ' left';
    if (stockText.textContent !== text) stockText.textContent = text;
    stockFill.style.width = (size ? left / size * 100 : 0) + '%';
    if (drop.state !== shownState) { // only on a change, so screen readers are left alone otherwise
      shownState = drop.state;
      if (liveLabels[shownState]) countLabel.textContent = liveLabels[shownState];
      else countLabel.innerHTML = scheduledLabel;
    }
  } catch (error) {
    console.warn('Live drop data unavailable', error);
  }
  setTimeout(pollDrop, 3000);
}
pollDrop();

/** Uncovers the word from left to right, like a marker writing it. Skipped when motion should be still. */
function writeIn(word) {
  word.getAnimations().forEach(animation => animation.cancel());
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('paused')) return;
  const letters = word.textContent.length;
  // the spare room above, below and to the sides keeps the marker's tails from being shaved off
  word.animate(
    [{ clipPath: 'inset(-30% 100% -40% -8%)' }, { clipPath: 'inset(-30% -8% -40% -8%)' }],
    // one small hitch per letter, so it reads as strokes rather than a wipe
    { duration: 130 * letters, easing: 'steps(' + letters * 4 + ', end)' },
  );
}

const swatches = Array.from(document.querySelectorAll('.swatch'));
const pickName = document.querySelector('.pick-name');
swatches.forEach(button => {
  button.addEventListener('click', () => {
    swatches.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    pickName.textContent = button.dataset.name;
    button.closest('.vote').dataset.pick = button.dataset.name;
    writeIn(pickName);
  });
});

const form = document.getElementById('signup-form');
const email = document.getElementById('email');
const formError = document.getElementById('form-error');
const submit = document.getElementById('submit-signal');
const success = document.getElementById('signup-success');
const formStatus = document.getElementById('form-status');
const fine = document.getElementById('signup-fine');
let busy = false;
let joined = false;

function setError(message) {
  formError.textContent = message;
  if (message) {
    email.setAttribute('aria-invalid', 'true');
  } else {
    email.removeAttribute('aria-invalid');
  }
}

email.addEventListener('input', () => setError(''));

form.addEventListener('submit', event => {
  event.preventDefault();
  if (busy || joined) return;

  const value = email.value.trim();
  if (!value) {
    setError('Enter your email to tune in.');
    email.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    setError("That address doesn't look right. Check it.");
    email.focus();
    return;
  }

  setError('');
  busy = true;
  submit.disabled = true;
  email.readOnly = true;
  submit.textContent = 'Tuning in…';
  form.setAttribute('aria-busy', 'true');
  formStatus.textContent = 'Tuning in…';

  // shortcut: simulated signup, nothing is sent or stored; wire a real endpoint (with an error path) before launch
  setTimeout(() => {
    busy = false;
    joined = true;
    submit.textContent = 'Signal received';
    form.removeAttribute('aria-busy');
    fine.hidden = true;
    success.hidden = false;
    success.focus();
    formStatus.textContent = 'Signal received.';
  }, 1200);
});
