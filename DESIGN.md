# Design language: "Static Landing"

Source: `Static Landing.html` (reference file; brand in it is **STATIC**, tagline "Soft signal."). **This site's brand is STATIX**; use that name. Values below are read from its unpacked template.

## 1. Overview

A loud, aggressive, dark zine / collectible-drop look with a soft lavender accent: heavy dot-matrix type, skewed slabs, hard offset shadows, scrolling tapes and TV static used sparingly. The copy stays quiet and terse while the layout is noisy.

## 2. Colors

### Core

| Role | Hex |
|---|---|
| Background; text on accent and on light | `#0B0A0F` |
| Ink; light blocks | `#F4F2F8` |
| Accent (lavender) | `#B9A4FF` |
| Muted text | `#C9C6D3` |
| Dim text (countdown labels, copyright) | `#8B8896` |

### Surfaces and lines

| Role | Hex |
|---|---|
| Card / panel, hero diagonal wedge | `#16141D` |
| Product image well | `#0F0E14` |
| Device body inside renders | `#1C1A26` |
| Card border (1px) | `#2F2B3E` |
| Footer top rule | `#1F1C28` |
| Deep violet: card shadows, tape shadow, starburst, outline watermarks | `#2A2540` |

### Light card only

| Role | Hex |
|---|---|
| Body text | `#3A3647` |
| Success label | `#5B3FD1` |
| Error text | `#B3261E` |
| Input background | `#FFFFFF` |

### Effects

- Glow: radial `rgba(138,108,255, .45 hero / .28 drop section)` fading to 0 at 65%.
- Translucent shell: `#E4DAFF` at 60% → `#8A6CFF` at 22%, diagonal.
- Swatches (160deg): Lavender `#C9B8FF → #8268EC` (dark text), Smoke `#4A4756 → #17151E` (light text), Bone `#F4F2F8 → #B9B5C4` (dark text).

### Accent behaviour

The accent is a variable. Default `#B9A4FF`; alternate `#8A6CFF`. **In the reference, link hover, focus ring, text selection and the product SVG strokes and fills hardcode `#B9A4FF`,** so switching the accent leaves them lavender. Use one CSS variable if you rebuild it.

## 3. Typography

**Two families only. Do not add a third.**

| Family | Weights loaded | Used for |
|---|---|---|
| **Doto** (dot-matrix; fallback JetBrains Mono, monospace) | 900 | Everything loud: logo, headlines, tapes, countdown digits, card and swatch titles, watermarks, "Soft signal." sticker, graffiti notes (uppercase) |
| **JetBrains Mono** | 400, 500, 700 | Everything quiet: body, nav, buttons, form, tags, captions, labels |

| Element | Spec |
|---|---|
| Hero letters | Doto `clamp(56px, min(11.6vw, 18.5svh), 184px)`, line-height 1; tagline up to 60px, lede up to 24px, hero buttons up to 72px tall; hero column up to 1440px |
| Watermarks | Doto `clamp(120px, 22vw, 320px)` hero; `clamp(120px, 26vw, 380px)` footer; line-height .8; transparent fill, 2px `#2A2540` stroke |
| Section titles | Doto up to 112px (drop), 144px (lineup), 68px (vote) |
| Countdown digits | Doto 48px / 1 |
| Product name / logo | Doto 32px / 30px nav, 22px footer |
| Tapes | Doto up to 38px (+.12em) and 32px (+.14em) |
| Swatch name | Doto 24px |
| Sticker tagline | Doto 900, `clamp(28px, 3.4vw, 42px)` |
| Light card heading | JetBrains Mono 700, 26px / 1.2 |
| Body | JetBrains Mono 18px hero, 16px section, 15px card; line-height 1.6; `#C9C6D3` on dark; max width 380–460px |
| Buttons | JetBrains Mono 700, 16px, uppercase |
| Nav | JetBrains Mono 600, 14px, +.08em, uppercase |
| Form label / error / swatch sub / copyright | JetBrains Mono 13–14px, weight 400–600 |
| Mono labels | JetBrains Mono 11–13px, uppercase (mostly), +.10 to .18em |

Doto tracking: .04em for headings, .08em for the logo, .02em for the footer watermark.

## 4. Shape and depth

- **Corners are square.** Rounding appears only inside product renders and on circular glows.
- **Shadows are hard offsets with zero blur**, always down-right (tapes: straight down). Colour is ink, accent or `#2A2540`.

| Offset | Use |
|---|---|
| 5px ink | Nav button |
| 9px ink | Primary button |
| 6px ink | Tagline sticker |
| 6px accent | Countdown tiles |
| 12px accent | Title slabs |
| 8px accent | Selected swatch, ink tape (`0 8px`; the lower tape's is lavender) |
| 10px `#2A2540` | Hero letters (`drop-shadow` filter) |
| 8px `#2A2540` | Accent tape (`0 8px`) |
| 14px `#2A2540` | Product cards (accent on hover) |
| 16px accent | Signup card |
| 20px accent | Vote panel |

- **Skew:** buttons and numbered tags `skewX(-12deg)` (inner button text counter-skewed `+12deg`; tag text is not). Title slabs `rotate(-2deg) skewX(-8deg)`. Swatches `skewX(-8deg)` (content `+8deg`). Countdown tiles `skewX(-6deg)` (content `+6deg`). Tagline `rotate(-3deg) skewX(-10deg)`.
- **Tilt:** nearly every block sits slightly off level. Cards -1 / 1 / -0.6 / 1deg, vote panel -1deg, signup card 2deg, tapes ∓3deg (∓6deg at 700px and below), hero render -4deg, caption sticker -3deg, hero watermark -6deg. Alternate directions.

## 5. Components

- **Primary button:** accent fill, `#0B0A0F` text, min-height 56px, padding 0 32px, skewed, 6px ink shadow. Nav version is smaller (12px 26px, 5px shadow).
- **Secondary button:** background fill, 2px ink border, ink text, skewed, no shadow.
- **Submit (light card):** full width, 54px, `#0B0A0F` fill, accent text, +.08em, square, not skewed.
- **Input:** 52px, 2px `#0B0A0F` border, white, 16px text, visible label above.
- **Tag:** mono 500 12px, +.14em, padding 4px 14px, skewed; accent or ink fill.
- **Title slab:** ink fill, dark Doto text, tilted and skewed, 12px accent shadow.
- **Product card:** `#16141D`, 1px `#2F2B3E`, 28px padding, 20px gap, 10px shadow. Order: 16:9 image well → Doto name with `NO. 00X` tag beside it → one-line description.
- **Feature panel (vote):** card style at 56px padding with a 14px accent shadow; copy left, three swatches right.
- **Swatch:** gradient button, min-height 200px, label bottom-left. Selected: lifts 10px, 2px ink border, 8px accent shadow.
- **Countdown tile:** min-width 88px, card style, accent digits over a dim mono label.
- **Signup form:** inverted ink card, level, max 560px, no header strip. States: pending, error, joined.
- **Tapes:** two full-width bands at 104% width (accent, then ink), tilted opposite ways, scrolling opposite ways. Text is `/`-separated and repeated for a seamless `-50%` loop.
- **Nav / footer:** Doto wordmark plus uppercase muted links. Footer follows a giant wordmark filled with static.
- **Pause button:** fixed bottom right; pauses all CSS motion. Hidden under reduced motion.
- **Section break:** the vote band uses the panel colour (its panel uses the background colour). Vote and drop open with a straight 8px speckled accent strip over a 2px ink line. No zigzags or scalloped edges.

## 6. Texture and decoration

All decorative layers sit behind content.

- **Static:** one 160px random-pixel tile, drawn on a canvas, shown at 2x. Use it only for: page grain behind content (6%), the hero photo burst at slide cuts, the section strips and the footer wordmark. **Never a resting overlay on the hero or product photos** (tried; it was far too much).
- **Dot grid:** 1.6px accent dots on a 14px grid, 35% opacity, masked to fade leftward, right 55% of hero.
- **Diagonal wedge:** `polygon(0 0, 100% 0, 62% 100%, 0 100%)`, left 34% of hero.
- **Hero stack:** glow → spinning 24-point starburst (`#2A2540`) → accent quad `polygon(14% 0, 100% 6%, 86% 100%, 0 94%)` → same quad inset 6px in background colour → product → caption sticker.
- **Product art:** flat SVG line renders, lavender strokes, dot-pattern grilles, translucent gradient shells. No photography.
- **Diamond:** not used on this page (it belonged to the removed hero status line).

### Manga / punk collage layer

Direction: bold cel shading, heavy black, sharp silhouettes, pop art, neo-noir, punk and graffiti, halftone and magazine cutouts. Where this conflicts with older lines above, this wins.

- **No gold or red.** Lavender is the only highlight colour (hero slash, last cutout letter, graffiti tag, ink tape shadow).
- **No chromatic aberration** anywhere: no red/cyan splits on type, edges or hovers.
- **Cutout letters:** solid fills (ink, accent, black, grey, ink, accent) with uneven `clip-path` edges. No outlined letters.
- **Cel keyline:** black border or outline, then the hard colour shadow. Product photos get `contrast(1.18) saturate(1.25)`.
- **Halftone:** 3px accent dots on a 12px grid, masked to corners, never under body copy.
- **Graffiti:** one tilted Doto tag beside the Lineup title, hidden at 700px and below.
- **Character art:** wanted (expressive anime / manga, fashion-forward, dynamic pose); no artwork exists yet.

### Greys

**Lavender stays the highlight** (buttons, tags, title and panel shadows, links, focus). Greys are for surfaces and support, and replace the deep violet and the older panel, border and dim values above.

| Role | Hex |
|---|---|
| Card / panel | `#222226` |
| Vote band | `#303036` |
| Card border | `#3D3D44` |
| Grey shadows, starburst, watermark outline | `#46464E` |
| Fourth logo tile, lower halftone, dim text | `#A6A5AD` |

### 3D speaker

`assets/statix_cube.glb` bursts out of the hero frame (far larger than it; the frame tips back and dims behind) while the pointer is over the Speaker slide (tap on touch, or keyboard focus on the frame). The slideshow holds while it is open; drag rotates, zoom is off. Uses `<model-viewer>` 4.0.0 from Google's CDN, loaded on first use. Needs the page to be served over http(s); from `file://` the photo just stays.

### Lower-screen scale

Lineup, vote and drop use the same wide column as the hero (up to 1440px) and size type, cards, swatches, countdown and signup card from both width and height so each fills its screen. These sizes override the smaller values in sections 3 and 5.

### Section dressing

- Lineup and vote each have one giant grey outline word behind content (`RUN 001`, `SHELL ?`).
- **No star stickers** (tried and removed).
- **Lineup:** a torn tape strip holds each card.
- **Vote:** marker "pick one!" arrow; a "MY PICK" stamp slams onto the selected swatch.
- **Drop stays calm:** two aligned columns, a level signup card with no header bar, and one decoration, the equalizer, in its own band at the bottom. No outline word, rings, glow, halftone or barcode there (tried; too messy).
- All of it is decorative and `aria-hidden`; none adds product claims. The doodle hides at 700px and below.

### Vote backdrop

The vote section's background follows the picked shell: Lavender `#B9A4FF` (default), Smoke `#44414F`, Bone `#E4E1EA`. The panel stays dark; its shadow, outline, doodle, outline lettering and halftone switch for contrast.

## 7. Motion

| Name | Spec |
|---|---|
| `slam` (hero letters) | .55s `cubic-bezier(.2,1.5,.4,1)`, `both`; drops from -160px at 1.7x scale and 4x tilt; delays .05s then +.07s per letter |
| Tapes | `translateX(0 → -50%)`, linear infinite: 28s, and 22s reversed |
| `spin` (starburst) | 360deg, 60s linear infinite |
| `jitter` / `tune` (static) | .5s `steps(1)` infinite |
| `burst` (hero photo) | static flashes to 35% at each 5s slide cut, otherwise 0 |
| Slab hover | `skewX(-12deg) translate(-3px,-3px)`, .15s |
| Card hover | straightens to 0deg, rises 8px, shadow turns accent, .15s |
| Swatch select | transform transition .15s |

Hero letters each get their own tilt (-8, 5, -4, 9, -6, 5deg), vertical nudge (0, 14, 0, -6, 12, 0px), and fill, in this order: ink, accent, outlined ink, ink, accent, outlined accent (outline = 5px inset shadow).

Under `prefers-reduced-motion` all keyframe animations stop. Hover transitions remain.

## 8. Layout and spacing

- Reference canvas: 1440px wide; 56px side padding.
- Content sits in a centred 1200px column; tapes and wordmark stay full width.
- Hero, lineup, vote and drop are each at least one screen tall (`100svh`) with content centred; they grow when content is taller.
- **No eyebrow labels** above headings (no section tags, no status line above the hero).
- Flexbox with `flex-wrap`, flex-basis and `clamp()`. **No grid and no media queries.** Two-column bases: 520/380 (hero), 360/420 (vote), 480/380 (drop); cards 260.
- Common gaps: 4, 12, 16, 20, 24, 28, 32, 36, 40, 48, 64px.
- Sections clip overflow so tilted, oversized pieces don't cause sideways scroll.
- Page order: nav + hero → two tapes → lineup (4 cards) → vote → drop (countdown + form) → outline wordmark → footer.
- Narrow screens were not tested. Fixed 56px padding and 84–104px titles will likely need smaller values on phones.

## 9. Voice

- Short, declarative sentences: "Four products. One system."
- Radio / signal metaphors: *Soft signal, Tune in, Signal received.*
- Scarcity: numbered runs, `NO. 001`, `DROP 001`, "no restocks".
- Labels and buttons uppercase; headings are uppercase one-worders or sentence case.
- `/` separates items in tapes and captions.

## 10. Accessibility in the reference

- Focus ring: 2px `#B9A4FF`, 3px offset; `#0B0A0F` inside the light card.
- Selection: `#B9A4FF` background, dark text.
- Many decorative layers use `aria-hidden` (not the grain wrapper, hero glow or tapes, though the grain SVG is hidden). Repeated tape text is exposed to screen readers; hide the duplicates if you rebuild it.
- Split-letter h1 has `aria-label`; letter spans are hidden. Product SVGs have `role="img"` and labels. Swatches use `aria-pressed`.
- The error message has no `role="alert"`; add one. Contrast was not measured.

## 11. Do and don't

**Do:** keep corners square, shadows hard, tilts small and alternating; counter-skew button text; put one accent colour on a near-black and off-white base; keep body copy level, calm and narrow.

**Don't:** use soft blurred drop shadows, rounded cards or pill buttons, chromatic aberration, extra accent hues (lavender is the only highlight), a third font family, or Doto for paragraphs.
