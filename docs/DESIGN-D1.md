# D1 — Blotter: the trading desk

## The idea in three sentences

An underwriting desk is a book you read in one glance, not a page you scroll, so every screen
is one full-height grid that fits without scrolling and every number keeps its place in a
monospaced column. Nothing is decorative: the only non-data marks on screen are hairlines, a
cursor, and the keycap printed next to each control that drives it. An underwriter works this
desk the way a trader works a blotter, `j` and `k` down the book, `Enter` into a case, `w` and
`s` between the two ways of reading it, `u` back out, and the mouse stays where it is.

## What changed, screen by screen

**`/queue` is now a blotter.** Ten columns at 25px a row, a stat strip across the top, a search
line under it, and a preview pane on the right that follows the cursor. `j`/`k` move the cursor,
`Enter` opens, `/` filters, `gg`/`G` jump to the ends, `o`/`A` switch between the open book and
everything. The preview is built from the queue row's own fields, so moving the cursor costs no
request. The book-teaches panel (Elastic `significant_terms`) sits under the preview, each term
bar-scaled by its own score.

**`/cases/[id]` is now a case terminal.** Four bands in one viewport: an identity strip, then
three columns (the score readout with its band ruler, the waterfall or the decision space, and
the what-if slider on the left; **the book** in the middle; the Challenger and the precedent on
the right), then the call and a three-panel deck, then a status line. Nothing is folded away.

The middle column is the change I care about most. The old page had a Facts fold and a separate
Factor-bands fold; the fact ids and the factor keys are the same eight strings, so the two are
now one table. One row per fact carries its value, its provenance badge, its source sentence, and
three cells showing which guideline bands that fact still allows. The `· the guideline reads this
as …` suffix appears only when the guideline's reading differs from the displayed value, which is
why TIV is silent and loss history says `0.0` against a displayed `$0`.

**`/guideline` is the appetite as a terminal.** The document on the left in a monospaced table
(thresholds with a three-zone ruler, then one row per factor and one row per band with every number
editable in place), the five scenarios and the diff on the right. `1`–`5` load a scenario, `a`
applies, `d` discards, `r` restores the filed guideline, and each key is printed on its control. The
diff lands in the same place every time, so the eye already knows where to look when the book
re-ranks: `1 case changed decision · 1 decline became open · $26.3M into the queue · 158 re-scored in
57.6 ms`, then the named cases, then the queue-order moves. A refused edit prints the API's own
sentence in ember and applies nothing.

**The bounded override** sits on the case page under the readout line. The engine's interval keeps
its label and its amber; the human's sits beside it in plain `ink`, which is this feature's colour
everywhere it appears: the adjustment strip, the `UW+4` flag in the blotter, the `UNDERWRITER` field
in the preview, and the final ink bar on the waterfall behind a dashed divider tagged `HUMAN`. The
engine owns amber, jade and ember; the human owns ink, so on any screen you can tell whose number
you are looking at without reading a word. `o` focuses the reason field.

**`/live` keeps its layout** — it was already a console — and gains the night palette, amber for
every active state, a keycap on every demo beat, and a real status bar carrying the key legend
and the settled count, replacing a floating note that used to sit on top of the agent lanes.

**`/map`, `/ask` and `/backtest`** inherit the language through the tokens. The MapLibre basemap
is repainted layer by layer into the night palette rather than swapped for a different style, so
it degrades the same way it always did when tiles fail.

## Colour

Named `night desk`. Three signal hues, one job each, on a five-step cold neutral ramp.

| Token | Value | Job |
| --- | --- | --- |
| `paper` | `#0a0d10` | the page. Near-black with a blue-green cast, never `#000` |
| `land` / `raise` | `#12181d` / `#1a2128` | a panel or hovered row; the selected row or active tab |
| `rule` / `edge` | `#232c34` / `#313d47` | the hairline that does most of the dividing; a real border |
| `ink` / `dim` / `faint` | `#cfd7dd` / `#8a97a3` / `#5d6a75` | primary, read-on-demand, available-but-quiet |
| `ochre` (amber) | `#f0a437` | estimated, refer, the cursor, every active state, the live value |
| `moss` (jade) | `#35b88a` | known, accept, verified, reconciled, Elastic answered |
| `rust` (ember) | `#e2594a` | missing, decline, a risk, a threshold |

Why these. Ben's checklist warns off purple-and-black and rainbow colouring, so the palette is
one cold neutral ramp plus exactly three hues, and each hue means one thing everywhere it appears:
amber is *live or unsettled*, jade is *settled and checked*, ember is *bad or a boundary*. That
rule is what lets the score readout, the band ruler behind it, the interval bar in every blotter
row and the what-if verdict all take their colour from the same function. Amber rather than a
cool accent because a trading desk's one inherited convention worth keeping is phosphor amber, and
because it is the only hue that reads as neither good nor bad, which is what an open case is.

Contrast against `#0a0d10`: `ink` 13.2:1, `dim` 6.3:1, `ochre` 9.9:1, `moss` 7.5:1, `rust` 4.7:1.
Every one clears AA for body text. Shape backs colour up everywhere it carries meaning: the
decision chip is filled when decided, outlined when open and dashed when routed, so it survives
greyscale.

## Type

`IBM Plex Mono` 400/500/600 and `IBM Plex Sans Condensed` 400/500/600. One superfamily, two
widths, so they share a skeleton and read as one system. Mono is the *body* face, set on `<body>`
— this is a terminal, and every column in it is a number that has to line up. The condensed
grotesk carries the few places the desk writes sentences (the call, the Challenger's argument,
insured names), because condensed fits about 15% more words per line at the same size, which is
the entire point of this direction. Neither is Inter, Geist or Space Grotesk.

Nine steps, documented at the top of `globals.css` and used nowhere else:
9 micro · 10 meta · 11 data · **12 body** · 13 prose · 17 title · 20 sub · 24 read · 32 head.
The audit that produced this found 22 distinct sizes; the consolidation pass cut it to nine.

The three small steps sit about 1.1x apart, under the 1.25x a normal type scale wants. That is
deliberate and it is the one rule this direction breaks on purpose: at 11px versus 10px, case,
tracking and colour separate the roles instead of size. A dense desk cannot spend a 1.25x ratio
nine times and still fit the book on one screen. Everything above 13px keeps proper ratios
(13→17→20→24→32).

Measure is capped at 72ch on the call and the argument. `tabular-nums` is on globally, so no
column twitches when a what-if re-scores.

## Motion

Three transitions, all 150–220ms, all on `transform` or `opacity` or `color`: the interval bar
narrowing when evidence lands, lane cards arriving with `@starting-style`, and the help sheet rising
from the status bar it belongs to.
`prefers-reduced-motion: reduce` removes all of them; a check under emulated reduce found zero
running animations.

## Honesty signals, all kept

Provenance badge on every fact · the `✓ every number checked against the facts` mark beside the
call and again in the status line · `✓ the steps reconcile with the score` on the readout line ·
the `[elastic]` / `[memory]` backend badge on the percentile line, the precedent panel, the book
panel and the case status bar · the score interval as an interval, never a point · the Challenger's
`grounded` tag per risk and its `✓ verified` · the `desk` marker wherever the desk went against
the rules · `not scored` said in words on every row no guideline covers.

## Accessibility

Verified in the browser, not by reading the code: every control keeps a visible amber focus ring;
Shift-Tab from the cursor row reaches the sort buttons, the filter, the view toggle and the whole
chrome nav in order; the blotter uses a roving `tabindex` over real `<tr>`s inside a real `<table>`
with a `<caption>`, so screen-reader table navigation still works; the help sheet is a real
`role="dialog"` closed by `Esc`; every band cell, every provenance badge and every issue tag
carries a label or a `title`. Colour never carries meaning alone.

## What I would do next

1. **Promote the nine sizes to `@theme` tokens** (`--text-data`, `--text-prose`, …) and replace
   the remaining `text-[11px]` arbitrary values. The scale is consolidated and documented but
   still written as raw values in about 200 places.
2. **Persist a guideline edit past a restart.** It lives in the API process only, which is right for
   a demo and wrong for a carrier; `docs/GUIDELINE.md` lists that plus versioning, approval and
   permissions as the four things a real Control Tower needs and this does not have.
3. **Make the right rail on the case page a sticky two-section split** so the precedent panel and
   its `[elastic]` badge are visible without scrolling past the Challenger's third risk.
4. **A command palette on `:`** — the `g`-leader already exists and the key bus already routes it,
   so `:138` to jump to a case and `:open` to filter is a small addition and the most trading-desk
   feature still missing.
5. **Density toggle.** 25px rows suit 900px; on a real 1440p desk the same grid could show 40 rows
   at 22px. One token, one key.

## One bug the guideline editor exposed

`IntervalBar` hardcoded the two thresholds at 45 and 70, and so did the `decline <45 · refer 45–70 ·
accept ≥70` scale under it. That was fine while the guideline was a file read once at startup. It is
not fine now that `/guideline` can move those numbers: move the accept line to 60 and every band
ruler on the desk quietly disagrees with the waterfall beside it. `bits.tsx` now takes the
thresholds as a prop, `/queue` reads them from `GET /guideline` alongside the rows it already
fetches, and the case page takes them from the guideline that scored the case
(`explain.thresholds`). Verified by moving the thresholds to 25/60 and reading the scale back off
the blotter and the case page.

## Files

Design system: `web/src/app/globals.css`, `web/src/components/bits.tsx`.
Shell and keys: `web/src/components/desk/{Chrome.tsx,keys.ts,Kbd.tsx,Blotter.tsx}`.
Screens: `web/src/app/queue/page.tsx`, `web/src/app/cases/[id]/page.tsx`,
`web/src/components/QueueTable.tsx`, `web/src/components/case/*`.

Screenshots at 1512x900 in `web/screenshots/`: `d1-queue.png`, `d1-case.png`,
`d1-case-decision-space.png`, `d1-case-whatif.png`, `d1-case-tenant.png`, `d1-live.png`,
`d1-keys.png`, `d1-map.png`, `d1-backtest.png`, `d1-ask.png`.

The guideline and the override: `d1-guideline-document.png`, `d1-guideline-pending.png`,
`d1-guideline-diff.png`, `d1-guideline-refused.png`, `d1-guideline-scenario3.png`,
`d1-guideline-rescored-queue.png`, `d1-override.png`, `d1-override-queue-row.png`,
`d1-override-typed.png`, `d1-override-empty.png`.

`d1-case-whatif.png` is the one to look at second: it was taken by pressing `f` then the right
arrow 45 times, which walks the premium past $50,000 and flips the case to `83 ACCEPT` against
the live API, with the focus ring on the slider the whole time.
