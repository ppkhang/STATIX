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

Reworked 26/11/2026: a heavy face for main text, the same face at regular weight for supporting text, and a handwritten face for asides. This replaces the earlier Doto and JetBrains Mono pairing. Tokens are in `globals.css`.

| Tier | Token | Family and weight | Used for |
|---|---|---|---|
| Main | `--font-main` | **Archivo 900** | Headings and title slabs, product names, panel numbers, tapes, countdown digits, stock line, prices, watermarks, buttons, menu cards, badges, swatch names |
| Sub | `--font-sub` | **Archivo 400** | Body, nav and footer links, form labels, inputs, help and error text, status messages, small labels, copyright |
| Additional | `--font-hand` | **Permanent Marker 400** | Asides only: "Soft signal." sticker, hero name tag, "No restocks", "pick one!", "MY PICK", head-start line, "One email. No spam." |
| Wordmark | `--font-logo` | **Tektur 900** | The STATIX logo only: sticky and nav logo, footer logo, hero cutout letters, footer wordmark. Chosen 26/11/2026 over Doto (dot-matrix lettering reads as Nothing's) for cut corners that match the slabs and hold up small |

- Only 400 and 900 of Archivo are loaded. A weight of 500 to 700 would show as 900 or 400, so set one of the two.
- The handwritten face never goes on controls, labels, errors, prices or status messages, and not below 15px for sentences.
- Changing numbers use `font-variant-numeric: tabular-nums`, because Archivo isn't monospaced.
- Prices need the ₫ sign: check any replacement face has it.

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
| 14px `#2A2540` | Product panels (accent on hover) |
| 16px accent | Signup card |
| 20px accent | Vote panel |

- **Skew:** buttons `skewX(-12deg)` (inner text counter-skewed `+12deg`). Title slabs `rotate(-2deg) skewX(-8deg)`. Swatches `skewX(-8deg)` (content `+8deg`). Countdown tiles `skewX(-6deg)` (content `+6deg`). Tagline `rotate(-3deg) skewX(-10deg)`.
- **Tilt:** nearly every block sits slightly off level. Lineup panels -0.8 / 0.7 / 0.9deg, vote panel -1deg, signup card 2deg, tapes ∓3deg (∓6deg at 700px and below), hero render -4deg, name tag 6deg, hero watermark -6deg. Alternate directions.

## 5. Components

- **Primary button:** accent fill, `#0B0A0F` text, min-height 56px, padding 0 32px, skewed, 6px ink shadow. Nav version is smaller (12px 26px, 5px shadow).
- **Secondary button:** background fill, 2px ink border, ink text, skewed, no shadow.
- **Submit (light card):** full width, 54px, `#0B0A0F` fill, accent text, +.08em, square, not skewed.
- **Input:** 52px, 2px `#0B0A0F` border, white, 16px text, visible label above.
- **Title slab:** ink fill, dark Doto text, tilted and skewed, 12px accent shadow.
- **Product panel (lineup):** manga-page layout, not equal cards (a three-card row was rejected). Amp is the wide lead panel, Speaker a shorter one under it, Stand a tall one beside both; they stack on narrow screens. The photo fills the panel; the Doto name sits in an ink block bottom left, a large accent `00X` top right. Black keyline, ink outline, 14px grey shadow.
- **Feature panel (vote):** card style at 56px padding with a 14px accent shadow; copy left, three swatches right.
- **Swatch:** gradient button, min-height 200px, label bottom-left. Selected: lifts 10px, 2px ink border, 8px accent shadow.
- **Countdown tile:** min-width 88px, card style, accent digits over a dim mono label.
- **Signup form:** inverted ink card, level, max 560px, no header strip. States: pending, error, joined.
- **Tapes:** two full-width bands at 104% width (accent, then ink), tilted opposite ways, scrolling opposite ways. Text is `/`-separated and repeated for a seamless `-50%` loop.
- **Nav / footer:** Doto wordmark plus uppercase muted links. Footer follows a giant wordmark filled with static.
- **Pause button:** only inside the right end of the open STATIX card, so only once the page is scrolled: an icon past a slanted divider. **None at the top** (a separate button there was removed by request), which leaves the moving tapes and hero rotation without a pause control on the first screen. Pauses all CSS motion and the hero rotation. Hidden under reduced motion.
- **Section break:** the vote band uses the panel colour (its panel uses the background colour). Vote and drop open with a straight 8px speckled accent strip over a 2px ink line. No zigzags or scalloped edges.

## 6. Texture and decoration

All decorative layers sit behind content.

- **Static:** one 160px random-pixel tile, drawn on a canvas, shown at 2x. Use it only for: page grain behind content (6%), the section strips and the footer wordmark. **Never a resting overlay on the hero or product photos** (tried; it was far too much).
- **Dot grid:** 1.6px accent dots on a 14px grid, 35% opacity, masked to fade leftward, right 55% of hero.
- **Diagonal wedge:** `polygon(0 0, 100% 0, 62% 100%, 0 100%)`, left 34% of hero.
- **Hero stack:** glow → spinning 24-point starburst → accent quad filled with halftone (lavender with 2.5px black dots on a 12px grid) → the tilted Speaker photo with a 6px black edge and 14px black hard shadow → name tag (an ink paper card with a black edge and Doto name, tilted 6deg (clockwise) over the frame's bottom-left corner, with a 6px hard grey `#46464E` shadow; no tape). The halftone keeps the mostly black photo from blending in.
- **Product art:** product photos, plus one comic-style illustration per product (violet burst, halftone, thick black outline) shown on lineup hover. The page uses `assets/*_art.webp`, cut out from the `*_2d.png` files, whose checkerboard is painted in rather than transparent.
- **Diamond:** not used on this page (it belonged to the removed hero status line).

### Manga / punk collage layer

Direction: bold cel shading, heavy black, sharp silhouettes, pop art, neo-noir, punk and graffiti, halftone and magazine cutouts. Where this conflicts with older lines above, this wins.

- **No gold or red.** Lavender is the only highlight colour (hero bar, last cutout letter, graffiti tag, ink tape shadow, hero frame backing). The hero bar runs along the edge of the black wedge, away from the frame (it clashed when beside it); hidden at 700px and below.
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

**Hero rotates through the Speaker, Amp and Stand** every 6s: photo, name tag and 3D model change together. It holds while the frame is hovered, tapped or keyboard-focused, when motion is paused, under reduced motion and in a background tab. **Speaker / Amp / Stand** buttons (skewed, mono, white with a grey shadow when selected) sit under the frame's right side and switch at once, restarting the 6s turn; when paused or under reduced motion they swap with no animation. The moving card ignores the pointer, so it cannot trigger the 3D model.

### 3D products

The current product's model (`assets/statix_cube.glb`, `assets/statix_amp.glb` or `assets/statix_stand.glb`) bursts out of the hero frame (far larger than it; the frame tips back and dims behind) while the pointer is over the frame (tap on touch, or keyboard focus on the frame). Drag rotates, zoom is off. Uses `<model-viewer>` 4.0.0 from Google's CDN; viewer and all three models preload once the page has loaded. Needs the page to be served over http(s); from `file://` the photo just stays.

### Lower-screen scale

Lineup, vote and drop use the same wide column as the hero (up to 1440px) and size type, panels, swatches, countdown and signup card from both width and height so each fills its screen. These sizes override the smaller values in sections 3 and 5.

### Section dressing

- Vote has one giant grey outline word behind content (`SHELL ?`). The lineup's was removed: its panels covered it.
- **No star stickers** (tried and removed).
- **Lineup:** panels carry no tape strips; the uneven layout is the decoration. **No info chips** beside the title or on the panels (tried and removed).
- **Vote:** marker "pick one!" arrow; a "MY PICK" stamp slams onto the selected swatch.
- **Drop stays calm:** two aligned columns, a level signup card with no header bar, and **no background decoration**. Outline word, rings, glow, halftone, barcode and a fake equalizer were all tried there and removed as messy.
- All of it is decorative and `aria-hidden`; none adds product claims. The doodle hides at 700px and below.

### Vote backdrop

The vote section's background follows the picked shell: Lavender `#B9A4FF` (default), Smoke `#44414F`, Bone `#E4E1EA`. The panel stays dark; its shadow, outline, doodle, outline lettering and halftone switch for contrast.

### Copy

**No descriptive paragraphs** under headings, on product cards or in the signup card (removed as clutter). Headings, names, numbers, labels and form messages carry the page. This overrides the descriptions mentioned elsewhere in this file.

In the vote section, the picked name takes the picked colour (Lavender `#B9A4FF`, Smoke `#8F8B9E` so it reads on the dark panel, Bone `#F4F2F8`). With Lavender picked, the panel shadow is grey `#5E5C66`.

### Hero to tapes

The tapes sit right below the first screen. The hero background (wedge, bar, halftone dots) extends down into them and is cut along the upper side of the tape X, so nothing shows beneath a tape. Hero content stays sized and centred for one screen.


### Tune in (current layout; overrides every older note on this screen, including countdown tiles and the signup card)

One centred stack, max 1200px:

1. **Head:** `TUNE IN.` slab on the left; `DROP 001 OPENS 20.12 / 20:00 GMT+7` on the right (20 December 2026, 20:00, +07:00 assumed).
2. **Console:** one box with a 2px ink border and 14px accent shadow, holding three rows.
   - Countdown: four equal cells split by hairlines, large Doto digits. No skewed tiles.
   - Stock: `500 UNITS / 500 LEFT` beside an LED dot-matrix bar. Hard-coded, not live data.
   - Signup on a light surface: `GET THE FIRST SIGNAL.` and the head-start line on the left; email and button side by side on the right, `One email. No spam.` below. 4px lavender focus border with a dark ring. On success the button reads `SIGNAL RECEIVED`.

No background decoration. The section is `100svh` minus footer and wordmark, so all three share the last desktop view. Footer sits above the wordmark, which is 30% opacity, still, and shown in full (cropping it was tried and looked broken).
Headings and product names are uppercase site-wide. The pause control sits inside the STATIX card of the sticky menu (pause icon, play icon when paused).

### Sticky logo

**Header links merge on scroll:** when the page leaves the top, LINEUP, VOTE, DROP and TUNE IN fly one after another into the corner chip (.46s each, 55ms apart), which bumps as they land; they fly back out on return, each real link taking over the instant its copy lands (revealing them all together read as a refresh). No flight on load, when paused or under reduced motion.

The wordmark is a fixed link back to the top. At rest it looks like plain nav text at the top, and a lone **S** chip in the corner once scrolled. Mouse hover, keyboard focus or a first tap opens the menu (on touch a second tap on the logo goes to the top; a tap elsewhere or Escape closes it):

- **STATIX is always the biggest card**: Doto up to 44px on a level right-slanted rectangle (skew -12deg, no tilt) with a 5px deep violet offset.
- **Cards** LINEUP, VOTE, DROP, WAITLIST **fan out only once the page is scrolled** (at the top nothing opens: the logo stays plain text and the page nav is on screen). They are **level** (tilts were tried and removed to match the level STATIX card), 10px apart below it against the left edge, left ends bowing gently out and back (6, 20, 26, 20px), and slide out from under the logo. 176x38px right-slanted rectangle (skew -12deg), 3px deep violet offset. Jagged cut-paper edges were tried on these and on the swatches, console and signup, and were removed as tiring, one label in the site nav font (JetBrains Mono 700, 15px, uppercase). **No icons and no subtitles** (both removed). A staircase and a wide circular arc were tried and replaced.
- **Content-aware colours:** each card, and the STATIX card, reads the surface behind it: off-white card with black text over dark areas, black card with off-white text over light or lavender areas. The deep violet offset stays on both.
- **Highlight** inverts the hovered or focused card only. No highlight for the section on screen (tried and removed).
- **No backing graphic** behind the cards (long spikes and a toothed ring were both tried and removed). No gradients.
- **Exceptions to the rules above, requested for this menu only:** deep violet `#8A6CFF` and the pause icon.

The resting chip reads the surface behind it: light chip with a lavender shadow over dark areas, dark chip with lavender letters over light or lavender areas. No transitions under reduced motion.

## 7. Motion

| Name | Spec |
|---|---|
| Card throw (hero rotation) | old photo flies off left in .28s; new one slams in from the right in .48s with an overshoot; the lavender backing jolts; the name tag stamps down last. Runs only when the rotation does, so never when paused or under reduced motion |
| `slam` (hero letters) | .55s `cubic-bezier(.2,1.5,.4,1)`, `both`; drops from -160px at 1.7x scale and 4x tilt; delays .05s then +.07s per letter |
| Tapes | `translateX(0 → -50%)`, linear infinite: 28s, and 22s reversed |
| `spin` (starburst) | 360deg, 60s linear infinite |
| `jitter` / `tune` (static) | .5s `steps(1)` infinite |
| Slab hover | `skewX(-12deg) translate(-3px,-3px)`, .15s |
| Panel hover / keyboard focus | straightens, rises 8px, shadow turns accent; a comic backdrop covers the photo (speed lines that snap in, halftone corners, a lavender and ink slash, a tilted ink tape strip behind the illustration repeating the name and number; giant lettering was tried and was unreadable) and the illustration slams in over it (.4s overshoot), registered to the photo: same size, position, crop and zoom, with the excess cut off at the frame edge (spilling past the frame and shrinking the art to fit inside were both rejected). Each `*_art.webp` is therefore drawn on a 1344x768 canvas like its photo; new art must be placed the same way; a plain fade under reduced motion |
| Swatch select | transform transition .15s |

Hero letters each get their own tilt (-8, 5, -4, 9, -6, 5deg), vertical nudge (0, 14, 0, -6, 12, 0px), and fill, in this order: ink, accent, outlined ink, ink, accent, outlined accent (outline = 5px inset shadow).

Under `prefers-reduced-motion` all keyframe animations stop. Hover transitions remain.

## 8. Layout and spacing

- Reference canvas: 1440px wide; 56px side padding.
- Content sits in a centred 1200px column; tapes and wordmark stay full width.
- Hero, lineup, vote and drop are each at least one screen tall (`100svh`) with content centred; they grow when content is taller.
- **No eyebrow labels** above headings (no section tags, no status line above the hero).
- Flexbox with `flex-wrap`, flex-basis and `clamp()`. **No grid and no media queries.** Two-column bases: 520/380 (hero), 360/420 (vote), 480/380 (drop); lineup panels 520/280.
- Common gaps: 4, 12, 16, 20, 24, 28, 32, 36, 40, 48, 64px.
- Sections clip overflow so tilted, oversized pieces don't cause sideways scroll.
- Page order: nav + hero → two tapes → lineup (3 panels) → vote → drop (countdown + form) → outline wordmark → footer.
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

**Don't:** use soft blurred drop shadows, rounded cards or pill buttons, chromatic aberration, extra accent hues (lavender is the only highlight), a font family beyond the four roles in section 3, or the wordmark face for anything but the wordmark.
