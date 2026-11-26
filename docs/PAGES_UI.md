# STATIX: other pages and their interactables

Companion to `INTERACTABLES.md` (landing page). These pages are **planned, not built**. They come from the requirements package. "Reqs" points to:

- functional requirements (`FR-nnn`) in `STATIX 03 Functional Requirements`
- business rules (`BRU-nnn`) in the same note
- non-functional requirements (`NFR-nnn`) in `STATIX 05`
- flows (`PRC-nn`) in `STATIX 02`

`[ASSUMPTION]` marks a guess that's still open in `STATIX 09`.

Release tags: **R1** is the MVP store (Drop 001, all 4 products), **R2** comes next, and **R3** comes later. Build R1 first. Anything tagged R2 or R3 can stay a placeholder or be left out.

## Site map

| # | Page | Route | Release | Who can open it |
|---|---|---|---|---|
| 0 | Landing (built) | `/` | R0 | Anyone |
| 1 | Waitlist confirmed | `/waitlist/confirm/:token` | R1 | Link from the opt-in email |
| 2 | Shop | `/shop` | R1 | Anyone |
| 3 | Product | `/p/:slug` (`static-one`, `signal`, `stand`, `wire`) | R1 | Anyone |
| 4 | Desk system | `/system` | R1 (Should) | Anyone |
| 5 | Drop | `/drop/:number` (e.g. `/drop/001`) | R1 | Anyone; buying needs a verified account |
| 6 | Waiting room | `/drop/:number/queue` | R1 (Should) | Sent there automatically under load |
| 7 | Invite link | `/invite/:token` | R1 | Link from the early-access email |
| 8 | Sign in, register, verify, reset | `/login`, `/register`, `/verify`, `/reset` | R1 | Anyone |
| 9 | Cart | `/cart` | R1 | Anyone; checkout needs sign-in |
| 10 | Checkout | `/checkout` | R1 | Verified account with a live hold |
| 11 | Payment processing | `/checkout/processing/:orderId` | R1 | Return URL from VNPay or MoMo |
| 12 | Order confirmed | `/order/:orderId/confirmed` | R1 | Order owner |
| 13 | Account home | `/account` | R1 | Signed in |
| 14 | Orders and order detail | `/account/orders`, `/account/orders/:id` | R1 | Signed in |
| 15 | Return request | `/account/orders/:id/return` | R1 | Order owner, inside the window |
| 16 | Addresses | `/account/addresses` | R1 | Signed in |
| 17 | Waitlist and privacy | `/account/privacy`, `/preferences/:token` | R1 | Signed in, or a link from any email |
| 18 | Support | `/support` | R1 (Should) | Anyone |
| 19 | Policies | `/terms`, `/returns`, `/privacy-policy` | R1 | Anyone |
| 20 | Certificate | `/c/:edition/:number` | R2 | Anyone (public proof) |
| 21 | My collection | `/account/collection` | R2 | Signed in |
| 22 | Drop archive | `/drops` | R2 | Anyone |
| 23 | Vote | `/vote/:id` | R2 | Members |
| 24 | Trade-in | `/account/trade-in` | R3 | Owners of a unit |
| A1–A14 | Admin | `/admin/...` | R1 | Staff roles with MFA |

## Shared pieces (on every customer page)

> **Changed 2026-11-26:** off the landing the menu is just Drop 001, then Log in or Account. The landing's menu is
> Lineup, Vote, Tune in (its own sections), then Drop 001 and Log in. The current page is highlighted; product pages count as Drop 001.
> **Join the waitlist** on the product and Drop pages opens a signup panel in place (simulated until M3, like the
> landing's form).
> **Cart** and **Support** are hidden until those pages exist. Footer: Drop 001 and the three policies.

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Sticky menu** | Same as the landing page | Adds **Shop**, plus **Account** or **Sign in**, and a **Cart** count. | FR-001 |
| **Drop status strip** | Read only; click goes to the drop | Shows the live state of the current drop (Scheduled, Early access, Public, Sold out) and its countdown. Hidden when no drop is scheduled. | FR-009, FR-016 |
| **Cookie and analytics consent** | Accept or Decline | Analytics loads only after Accept. Decline is as easy as Accept. | NFR-019 |
| **Footer** | Click | Shop, Drop, Support and the three policies. | FR-053, FR-078 |

Formats everywhere: prices as `5.190.000 ₫` with VAT included, dates `dd/MM/yyyy`, times in Vietnam time (NFR-024, NFR-025).

---

## 0. Landing: what to connect

The landing page exists (see `INTERACTABLES.md`). Its "Worth knowing" section matches these requirements:

| Landing piece | Today | Change it to | Reqs |
|---|---|---|---|
| **Send my signal** (email) | Simulated | Real waitlist join: email required; phone or Zalo and product interests optional; consent box; double opt-in email; source (UTM) saved. Success copy says "Check your inbox to confirm", not a launch date. | FR-021–FR-024 |
| **Stock bar** "500 / 500 left" | Fixed | Live remaining count from the server, at most 5 s old. | FR-014, NFR-004 |
| **Countdown** | Client clock | Synced to the server clock. When it ends, the page switches state without a reload. | FR-016 |
| **Vote swatches** | Not saved | Keep as a "preview". The real vote is R2 (page 23). Label it "Preview: voting opens for members". | FR-038–FR-041 |
| **Lineup / switcher** | Speaker, Amp, Stand | Add **Wire**: Drop 001 has 4 products. | FR-001 |
| **Pause button** | Only after scrolling | Also show it at the top. | NFR-020 |

---

## 1. Waitlist confirmed

> **Built 2026-11-26** at `/waitlist/confirm/:token`. The page confirms by submitting a form once it has loaded, so a mail
> scanner opening the link confirms nothing. For US-022, a repeat signup gets the same on-screen answer as a new one; the
> "already on the list" message goes by email, so the form can't be used to find out who is listed. Links last 7 days;
> there is no reminder or lapse job yet (PRC-02). The optional phone/Zalo and product picks are on this page.

Reached from the double opt-in email. Flow: PRC-02.

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Status card** | Read only | Valid token: "You're on the Drop 001 waitlist" and the next step (invite email at early access). Expired or used token: an explanation and **Send a new link**. | FR-021, FR-024 |
| **Send a new link** | Click (expired state only) | Emails a fresh opt-in link and shows "Sent". Rate limited. | FR-021, NFR-013 |
| **Pick products** (chips: Static One, Signal, Stand, Wire) | Toggle | Saves interests on the entry. Optional. | FR-021 |
| **Create an account** | Click | Goes to `/register` with the email filled in. | FR-031 |
| **Manage my data** | Link | Goes to `/preferences/:token` (page 17). | FR-026 |

## 2. Shop

> **Changed 2026-11-26:** merged into the Drop page while there is only one drop. `/shop` redirects to the current drop and
> **Shop** is out of the menu and footer. Bring it back when there is more to browse than Drop 001 (another drop, or
> the desk system page).

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Product cards** ×4 | Click or Enter | Opens the product page. Each card shows: photo, name, price, edition size and a **status badge** (Coming, Early access, Live, Sold out, Archived). | FR-001, FR-002 |
| **Card model preview** | Hover or focus | Swaps the photo for the 3D model (same behaviour as the landing frame). Off when motion is reduced. | NFR-020 |
| **Desk system banner** | Click | Goes to `/system`. | FR-005 |

## 3. Product page (one template, four products)

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Gallery and 3D viewer** | Swipe or click thumbnails; drag the model | Photos plus the `.glb` model, which you drag to rotate. A fallback photo shows if WebGL fails. | FR-002 |
| **Colour picker** (variant) | Click one swatch | Each colour is its own edition, so the price, edition size, remaining count and status all change with the choice. Sold-out colours stay visible but are crossed out. | FR-003 |
| **Edition line** | Read only | "Edition of 500 · 312 left", live to within 5 s. | FR-002, FR-014 |
| **Price** | Read only | VND, VAT included. A note says VAT is itemised on the invoice. | FR-004, BRU-006 |
| **Main button**: depends on drop state | Click | **Join the waitlist** (Scheduled) · **Enter with invite** (Early access, not yet invited) · **Buy now** (Early access with a valid invite, or Public) · **Notify me for the next drop** (Sold out or Closed). | FR-009, FR-010, FR-017 |
| **Buy now** | Click | Not signed in: goes to `/login`, then back. Signed in: starts checkout, which creates the hold (page 10). Blocked with a message if you've hit your cap. | FR-011, FR-015, FR-045 |
| **Add to cart** | Click | Adds the item without a hold. You can't mix drops in one cart. | FR-043 |
| **Pre-order note** | Read only | Shown whenever stock isn't in the warehouse: "Ships around dd/MM". | FR-069, BRU-007 |
| **Specs** (accordion) | Click to open | Specs, what's in the box, warranty (12 months `[ASSUMPTION]`). | FR-002 |
| **Pairs with** | Click a card | Links to the other three products, then to `/system`. | FR-005 |

## 4. Desk system (R1, Should)

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Desk scene** | Click a hotspot on each product | Highlights that product and shows a short "how it connects" note: Signal to Static One by Wire; Stand beside it. | FR-005 |
| **Product links** | Click | Go to each product page. | FR-005 |
| **Desk Set bundle** | Hidden in R1 | One price for all four products. R3. | FR-006 |

## 5. Drop page

The heart of the store. Flow: PRC-01 and PRC-03.

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **State banner** | Read only | One of: Scheduled → Early access → Public → Sold out → Closed. The server decides the state, and the page updates itself. | FR-009, FR-016 |
| **Countdown** | Read only | Counts down to the next state change, synced to the server clock. | FR-016 |
| **Edition rows** (one per product and colour) | Read only, then **Buy** per row | Each row: name, colour, `No. range 001–500`, live "left" bar and its own **Buy** button. The row greys out at zero. | FR-008, FR-014 |
| **Early-access gate** | Shown during Early access | Signed-in members whose tier is eligible see **Buy**. Everyone else sees "Members get 30 minutes first", the time until public open, and **Join the waitlist**. | FR-010, FR-032, BRU-004 |
| **Your cap** | Read only when signed in | "You can buy 1 of each" `[ASSUMPTION]`. A row shows "Bought" once you've used your cap for it. | FR-015, BRU-003 |
| **Bot check** | Automatic at open | A Turnstile check runs before the first hold. | FR-054 |
| **Reserve a slot** (deposit) | Click, before the drop | Pays a refundable deposit of 500.000 ₫ `[ASSUMPTION]` through VNPay or MoMo, then shows "Slot reserved". | FR-029 |
| **Sold out panel** | Read only, plus a button | "All 500 found a desk." and **Get the next drop** (waitlist). | FR-017 |

## 6. Waiting room (R1, Should)

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Queue card** | Read only | Shows your place, a rough wait and "Don't refresh, you'll keep your place." It updates live. | FR-018 |
| **Auto-forward** | None | When your turn comes, you go back to the drop page with a short-lived pass. | FR-018 |
| **Live left count** | Read only | Same counter as the drop page, so you can see if it sells out while you wait. | FR-014 |

## 7. Invite link

> **Built 2026-11-26** at `/invite/:token`. Until the admin pages (M6), invites are released with
> `npm run invites:release -- --drop 1`. A link lasts until the public opening, works once, and only for the account
> with the invited, verified address; accepting it makes the account a Member. Blocking early purchases for everyone
> else is part of buying (M4).

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Token check** | Automatic | Valid: sign in or register, then open the drop page in Early access. Used or expired: an explanation and **Send me a new link**. | FR-025 |
| **Send me a new link** | Click | Asks Support or the system for a fresh invite, if the window is still open. Rate limited. | FR-025, NFR-013 |

## 8. Sign in, register, verify, reset

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Email + password** | Type and submit | Signs in, or creates an account (password rules shown live). Errors are shown inline, next to the field they're about. | FR-031 |
| **Continue with Google** | Click | Signs in with Google. A new account is marked verified if Google has already verified the email. | FR-031 |
| **Verify email** (`/verify`) | Click the link from the email | Marks the account verified and moves it from Visitor to the Waitlist or Member tier. Includes **Resend**. | FR-031, FR-032 |
| **Phone check** | Enter phone, then the 6-digit OTP | Needed before the first drop purchase and for COD. One phone per account counts toward the cap. | FR-015, FR-049 |
| **Forgot password** | Email, then a link | Sends a reset link. It always says "If that email exists, we sent a link" so nobody can tell which emails are registered. | NFR-011 |

All rate limited and kept out of search results (NFR-013, NFR-022).

## 9. Cart

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Line items** | Remove (×); there's no quantity box | Each line is 1 unit (cap rule). The cart can't hold items from two drops. | FR-043, BRU-003 |
| **Cap warning** | Read only | Shows when an item would go over your cap, and blocks checkout until it's removed. | FR-043 |
| **Check out** | Click | Starts the holds for every line at once. If one fails ("sold out" or "cap"), it's flagged and the rest go through. | FR-011, FR-012 |

## 10. Checkout (one page)

> **Built 2026-11-26 up to payment** at `/checkout`: held units with server-timed countdowns, extend and let go, contact,
> one delivery address, and a summary. Shipping is a placeholder fallback table (no GHN account). Payment is off: no
> order or payment row is ever made. There is no cart yet (page 9): with one drop and one of each, "Buy now" holds
> straight away and every running hold shows here.

> **Holds built 2026-11-26** (`src/lib/holds.ts`, proof: `npm run check:holds`). Working assumptions: the number is picked
> when the hold is made, one per person per edition, 10 minutes with one 10 minute extension. Early access is decided by
> an accepted invite for the drop (founders excepted), **not** by tier: verifying an email already makes anyone a
> Member, so the tier gate described for page 5 would let everyone in. US-032 AC2 also says Member comes from joining a
> drop's member list, so the tier given at verification wants revisiting.

Everything is on one screen. Flow: PRC-03.

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Hold timer** | Read only | "Your No. 042 / 500 is held for 9:41". At 0 the hold is released and the page offers **Try again** if units are left. | FR-011, FR-013, BRU-005 |
| **Contact** | Prefilled, editable | Email (locked to the account) and phone (must be verified). | FR-044, FR-045 |
| **Address** | Pick a saved one or add a new one | Vietnam two-level address: province or city, then ward or commune, then street. Autocomplete comes in R2. | FR-034, FR-058 |
| **Shipping** | Auto, then a choice if there's more than one | Gets a GHN quote for the address. If the API fails, it uses the fallback table and says "Estimated". Shows the ETA. | FR-046, FR-069 |
| **Payment method** | Choose one | **VNPay** (bank app, QR, card) · **MoMo** · **COD**. COD only appears under the order-value limit and needs a phone OTP. **Stripe** (international cards) comes in R2. | FR-047–FR-049, FR-056 |
| **Company e-invoice** | Toggle | Opens fields for company name, tax code, address and invoice email. | FR-055 |
| **Store credit** | Hidden in R1 | Apply trade-in credit (R3). | FR-057, FR-084 |
| **Summary** | Read only | Items with unit numbers, subtotal, shipping, VAT line, total. | FR-004 |
| **Agree box** | Required check | Terms, return policy and pre-order notice, each linked. Pay stays disabled until it's ticked. | FR-053, BRU-007 |
| **Pay** | Click | Creates the payment with a one-time key, then goes to the VNPay or MoMo hosted page. For COD it asks for the OTP, then confirms the order. Double clicks are ignored. | FR-050, NFR-016 |

States to design for: hold expired · item sold out while you were checking out · cap reached · payment provider down (the hold gets extended once by 10 min, with a notice) · shipping quote failed. All come from FR-051, NFR-009 and BRU-005.

## 11. Payment processing

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Processing card** | Read only | Shows "Confirming your payment…" until the server receives VNPay or MoMo's payment notification, then forwards to page 12. | FR-050 |
| **Failed or cancelled** | **Try again** or **Choose another method** | Goes back to checkout. The hold is kept if there's still time on it. | FR-051 |
| **Late confirmation** | Read only | If the hold expired and the unit was taken: "We've refunded you automatically" plus the refund timeline. | INT-01/02 failure handling |

## 12. Order confirmed

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Order card** | Read only | Order number, items, and each unit number in big type ("No. 042 / 500"), plus payment method and ship ETA. | FR-052, FR-062 |
| **Add to calendar** | Click | Downloads an `.ics` file for the ETA (optional). | FR-069 |
| **View order** | Click | Goes to page 14. | FR-061 |
| **Certificate** | Link, R2 | Goes to page 20 once it's live. | FR-019 |

A confirmation email with the same content is sent too (FR-052, FR-098).

## 13. Account home

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Tier badge** | Read only; click opens the benefits | Visitor, Waitlist, Member or Founder, and what each one gets (early access, caps). | FR-032, FR-033 |
| **Tiles** | Click | Orders · Addresses · Waitlist and privacy · Collection (R2) · Trade-in (R3). | FR-034, FR-035 |
| **Next drop** | Read only | Countdown, and whether you're in the early-access group. | FR-010 |

## 14. Orders and order detail

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Orders list** | Click a row | Date, order number, items, status chip, total. | FR-061 |
| **Status timeline** | Read only | Pending → Paid (or Confirmed for COD) → Packing → Shipped → Delivered → Completed, with a timestamp at each step. | FR-061 |
| **Tracking** | Click the tracking number | Opens the GHN tracking page. Status also updates by itself. | FR-065 |
| **Cancel order** | Click, then confirm in a dialog | Only before it ships. Refunds to the original method; for COD orders it just cancels. | FR-066 |
| **Invoice** | Download | Receipt or e-invoice PDF. | FR-068 |
| **Request a return** | Click | Only inside the window (7 days `[ASSUMPTION]`). Goes to page 15. | FR-073 |

## 15. Return request

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Pick item** | Choose a unit | Shows the unit number. | FR-073 |
| **Reason** | Choose one, plus a text box | Changed mind · Faulty · Damaged in transit · Other. | FR-073 |
| **Photos** | Upload up to 5 | Required for "Faulty" and "Damaged". | FR-073 |
| **Refund details** (COD orders only) | Type | Bank name, account holder and account number for a bank-transfer refund. | FR-075 |
| **Submit** | Click | Creates the request and shows its status: Submitted → Approved (with RMA number and shipping steps) or Rejected (with the reason). | FR-074 |

## 16. Addresses

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Address cards** | Edit, Delete, **Set as default** | Changes the saved addresses. | FR-034 |
| **Add address** | Form | Province or city picker, then ward or commune (two-level), then street and the recipient's phone. | FR-034, INT-14 |

## 17. Waitlist and privacy (also opened from email links)

> **Built 2026-11-26** at `/preferences/:token`, linked from every waitlist email, the confirm page and, for a verified
> account on a list, from `/account`. The token is the entry id signed with `AUTH_SECRET`; deleting ends it. "Delete my
> data" covers waitlist data only: deleting an account arrives with the account area (M5). Position (FR-028) and
> "Download my data" (FR-037) are R2.

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **Waitlist status** | Read only | Which drops you're waiting for. Your position is shown from R2. | FR-028 |
| **Leave the waitlist** | Click, then confirm | Removes you from the list. | FR-026 |
| **Marketing emails** | Toggle | Separate from order emails, which always send. | FR-099 |
| **Download my data** | Click | Emails you a file. R2. | FR-037 |
| **Delete my data** | Click, type DELETE, then confirm | Deletes the data, keeping only what accounting law requires, and says what's kept. | FR-026, NFR-018 |

## 18. Support (R1, Should)

| Element | How you use it | What happens | Reqs |
|---|---|---|---|
| **FAQ** (search and accordion) | Type or click | Drops, numbering, shipping, returns, COD. Search ignores Vietnamese accents. | FR-078, NFR-023 |
| **Contact form** | Topic, order number (optional), message, send | Creates a ticket and shows its reference number. | FR-078 |

## 19. Policies

Static pages: terms, returns and warranty, privacy. They're linked from checkout's agree box and from the footer. Each shows a "Last updated" date (FR-053).

---

## Later pages (R2, R3)

| Page | Main interactables | Reqs |
|---|---|---|
| **20 Certificate** `/c/:edition/:number` (R2) | Big unit number, product, colour, drop and date sold. **Copy link** and **Share**. The owner's name is hidden by default. | FR-019 |
| **21 My collection** (R2) | A grid of units you own, each opening its certificate. Shows the Founder badge when you have it. | FR-035, FR-036 |
| **22 Drop archive** (R2) | One card per past drop, with the final count ("500 / 500 sold") and its editions. | FR-020 |
| **23 Vote** (R2) | The landing swatches become real: one vote, final once cast, with **Confirm vote**. Results are hidden or live depending on the setting. The winner is linked to the next edition. | FR-038–FR-041 |
| **24 Trade-in** (R3) | Pick an owned unit · condition questions · photos · provisional quote valid 7 days · shipping label · final quote with **Accept** or **Decline** · credit balance. | FR-079–FR-084 |

---

## Admin (`/admin`, R1)

All staff pages need sign-in with MFA, show only what the user's role allows, and write sensitive changes to the audit log (FR-087, FR-088). The roles are Owner, Ops, Fulfilment, Support and Community.

| # | Page | Main interactables | Roles | Reqs |
|---|---|---|---|---|
| A1 | **Sign in + MFA** | Email, password, 6-digit authenticator code | All | FR-087 |
| A2 | **Dashboard** | Tiles: waitlist size, live counter for each edition, open holds, paid orders, funnel (visit → hold → paid), revenue. Drop-day view refreshes on its own. | Owner, Ops | FR-089 |
| A3 | **Drops** | A list with a state chip. **New drop**: number, name, early-access and public times. **Schedule** checks the editions are valid. | Owner, Ops | FR-007, FR-009 |
| A4 | **Edition editor** | Per variant: size, number range, price, cap. Once Public, size and price lock, with a note explaining why. | Owner, Ops | FR-008, FR-097 |
| A5 | **Drop console** (live) | Counter per edition, holds expiring, payment success rate, a **Release invites** batch slider, waiting room on or off, **Close drop** with confirm. | Owner, Ops | FR-018, FR-025, FR-089 |
| A6 | **Counter adjustment** | Choose an edition, enter the change and a reason (required). It's sent to a **second approver**, and nothing changes until they approve. | Owner, Ops | FR-090 |
| A7 | **Waitlist** | A table grouped by day, source and product, with filters and **Export CSV**. | Community, Owner | FR-027 |
| A8 | **Orders** | Search by order, email, phone or unit number, with filters by status and drop. The detail view shows: <ul><li>the timeline</li><li>a **Scan serial** field that links the serial to the unit number</li><li>a QC check (Pass or Fail)</li><li>**Create shipment** (GHN, GHTK), **Print label**, and manual tracking if the API fails</li><li>**Cancel and refund**</li></ul> | Ops, Fulfilment | FR-061–FR-070 |
| A9 | **Returns** | A queue of requests with photos. **Approve** issues an RMA number; **Reject** needs a reason. On receipt: inspect, choose an outcome (Pre-loved or Scrap), and **Refund**. The unit number is retired automatically. | Support, Ops | FR-074–FR-076 |
| A10 | **Customers** | Search, then a profile with tier, orders timeline, holds, tickets and the consent log. | Support | FR-092 |
| A11 | **Content** | Product pages and drop copy in VI and EN, side by side, with **Preview** and **Publish**. | Owner | FR-091 |
| A12 | **Stock and reconcile** | Units on hand vs edition allocation, the daily reconcile result and any drift alerts. Fixes go through A6. | Ops | FR-067, NFR-007 |
| A13 | **Settings** | Hold time, caps, early-access minutes, COD limit, staff users and roles. | Owner | FR-087, FR-094 |
| A14 | **Audit log** | A read-only list you can filter by who, what, when, and before and after values. | Owner | FR-088 |

---

## Decisions that change these screens

These are still open in `STATIX 09`. Settle them before building the related page:

- **When the unit number is picked** (when the checkout hold starts, or at payment): this decides whether checkout shows "No. 042 is held for you" or just "1 unit held".
- **Cap per person** (1 per product per drop `[ASSUMPTION]`): this decides whether the cart and product page have a quantity box at all.
- **COD for numbered drops** (allowed, limited, or off): this decides whether page 10 shows COD and the phone OTP step.
- **Deposit** (FR-029): if it's dropped, remove **Reserve a slot** from page 5.
- **Product names** (Static One vs Statix One): this affects every label and URL slug.
