# STATIX landing page: interactables

Source: `index.html`, in page order. Worked out from the code, not tried in a browser. Line numbers will drift as the file changes.

## Sticky menu (appears after 24px of scroll)

| Element | How you use it | What happens | Code |
|---|---|---|---|
| **Logo** (`STATIX`, then an "S" chip) | Click, tap or focus | Goes to the top. Once scrolled, mouse hover or keyboard focus opens the menu. On touch, the first tap opens it and the second goes to the top. Its colours change with the background. | [947](index.html#L947), [1334-1346](index.html#L1334-L1346) |
| **Menu links**: Lineup, Vote, Drop, Waitlist | Click, tap or Tab | Jumps to the section. Waitlist goes to `#signup-form`, not `#drop`. Escape or an outside tap closes the menu. | [949-954](index.html#L949-L954), [1347-1349](index.html#L1347-L1349) |
| **Pause/play motion** (`aria-pressed`) | Open the menu, then click | Pauses CSS animations, hero rotation, model spin, and animated swaps and nav flights. It's hidden at the top of the page and when reduced motion is on. | [948](index.html#L948), [1164-1168](index.html#L1164-L1168) |

## Hero

| Element | How you use it | What happens | Code |
|---|---|---|---|
| **Header links**: Lineup, Vote, Drop | Click | Jumps to the section. On scroll, copies of the header links and button fly into the logo chip, then fly back at the top. | [962-967](index.html#L962-L967), [1381-1421](index.html#L1381-L1421) |
| **Tune in** (header and hero) | Click | Jumps to `#drop`. | [966](index.html#L966), [989](index.html#L989) |
| **See the lineup** | Click | Jumps to `#lineup`. | [990](index.html#L990) |
| **Product frame** (focusable) | Mouse hover, tap or keyboard focus | Shows the 3D model. Leaving with the mouse, tapping outside, moving focus away or pressing Escape closes it. | [1000](index.html#L1000), [1316-1322](index.html#L1316-L1322) |
| **3D model** | Drag | Rotates it, with zoom and pan off. It also spins on its own unless motion is paused or reduced. A drag can leave the frame without closing it. | [1184-1206](index.html#L1184-L1206), [1282-1297](index.html#L1282-L1297) |
| **Switcher**: Speaker, Amp, Stand | Click | Changes the photo, name tag and model with a card-throw animation, and restarts the 6s timer. | [1006-1010](index.html#L1006-L1010), [1225-1280](index.html#L1225-L1280) |

The hero changes product every 6s. It holds while the model is being viewed, the frame or switcher has keyboard focus, the tab is hidden, or motion is paused or reduced.

## Lineup

| Element | How you use it | What happens | Code |
|---|---|---|---|
| **Amp, Speaker and Stand panels** (focusable) | Hover or keyboard focus; tap relies on the browser's touch hover | The panel straightens and lifts, a comic backdrop and illustration appear, and the product number gets a black block. Clicking does nothing more. | [1057-1069](index.html#L1057-L1069), [CSS 435-463](index.html#L435-L463) |

## Vote

| Element | How you use it | What happens | Code |
|---|---|---|---|
| **Swatches**: Lavender, Smoke, Bone | Click; one choice at a time, Lavender by default | Updates "Your pick" (announced to screen readers), recolours the section and stamps "MY PICK". | [1081-1090](index.html#L1081-L1090), [1481-1489](index.html#L1481-L1489) |

## Drop

| Element | How you use it | What happens | Code |
|---|---|---|---|
| **Email field** | Type | Typing clears any error. | [1124](index.html#L1124), [1510](index.html#L1510) |
| **Send my signal** | Click or Enter | Checks for an empty or badly formed address. A valid one shows "Tuning in…" for 1.2s, then a success message that receives focus. Repeat submits are blocked. | [1125](index.html#L1125), [1512-1547](index.html#L1512-L1547) |

## Footer

**Lineup, Vote and Drop** links jump to their sections ([1141-1145](index.html#L1141-L1145)). The footer logo isn't a link.

## Visual only or display only

- **Hover effects:** buttons and switcher buttons shift, nav and footer links change colour, and the "Lineup" and "Tune in." headings skew. Those two headings aren't clickable.
- **Countdown:** it updates every second, even when motion is paused, and stops at zero.
- **Stock bar:** it's fixed at "500 units / 500 left".
- **Tape banners:** they scroll but ignore the pointer.

## Worth knowing

- **Signup is simulated:** nothing is sent or stored, yet it says "Watch your inbox on 20 December" ([1536](index.html#L1536)). Connect a real endpoint, with error handling, before launch.
- **Votes aren't saved:** the choice isn't sent anywhere and resets on reload.
- **No pause button at the top:** the hero and tapes are already moving, but you have to scroll to find the button. The code says this was requested ([909](index.html#L909)), but it may be an accessibility problem under WCAG 2.2.2 (Pause, Stop, Hide).
- **Panels can be focused but not activated:** keyboard users can reveal the artwork, but Enter does nothing.
