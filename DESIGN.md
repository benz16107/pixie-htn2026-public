---
name: Pixie for Intact
description: A consumer insurance lifecycle that keeps facts, estimates, choices, and evidence legible.
colors:
  cool-paper: "#F4F7F6"
  pale-land: "#E1E9EA"
  soft-raise: "#DCE7E9"
  deep-teal-ink: "#17343A"
  muted-teal: "#586E73"
  rule: "#C1D0D2"
  strong-edge: "#8FA2A6"
  intact-red: "#C83B31"
  deep-red: "#A42D27"
  red-wash: "#F3D8D4"
  verified-green: "#14755F"
  verified-wash: "#CFE7DF"
typography:
  web-display:
    fontFamily: "IBM Plex Sans Condensed, system-ui, sans-serif"
    fontSize: "clamp(40px, 4.4vw, 64px)"
    fontWeight: 650
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  native-title:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.09
    letterSpacing: "-0.8px"
  native-body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.44
  data:
    fontFamily: "DM Mono, SF Mono, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2
  label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "1.1px"
rounded:
  web: "0px"
  source-mark: "4px"
  control: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  section: "32px"
  display: "40px"
components:
  native-button-primary:
    backgroundColor: "{colors.intact-red}"
    textColor: "{colors.cool-paper}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
    height: "52px"
  native-button-secondary:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.deep-teal-ink}"
    rounded: "{rounded.control}"
    padding: "13px 18px"
    height: "52px"
  native-panel:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.deep-teal-ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  web-primary-action:
    backgroundColor: "{colors.intact-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.web}"
    padding: "11px 15px"
    height: "51px"
  source-mark:
    backgroundColor: "transparent"
    textColor: "{colors.intact-red}"
    rounded: "{rounded.source-mark}"
    padding: "3px 6px"
---

# Design system: Pixie for Intact

## Overview

**Creative North Star: "The guided policy file"**

Pixie presents insurance as a sequence a customer can inspect: Quote, Decide, Protect, and Recover. The design is calm and factual. Deep teal carries structure, Intact red marks the next action, green confirms recorded or sourced information, and mono type identifies numbers and provenance.

The web experience is an editorial system diagram built for asynchronous review. It uses square panels, strong rules, visible connections, and linked proof for each stage. The Expo app is the working consumer product. It keeps the same hierarchy and palette, then follows native expectations with rounded controls, safe-area spacing, tab navigation, SwiftUI on iOS, and Jetpack Compose on Android.

Key characteristics:

- One dominant action and one proof per view.
- Sources and limits sit beside the result they qualify.
- Home and Auto share the lifecycle but keep their claims distinct.
- Color communicates state consistently across web and native.

## Colors

The palette uses cool blue-green neutrals, one controlled red accent, and green only for confirmed states.

- **Deep teal ink** (`#17343A`) is primary text, selected navigation, dark panels, and the web proof-stage background.
- **Cool paper** (`#F4F7F6` native, `#EDF2F3` web) is the main light surface. Use pale land and soft raise for adjacent layers.
- **Muted teal** (`#586E73` native, `#52696E` web) is secondary copy, hints, metadata, and disclosures.
- **Rule** (`#C1D0D2` native, `#C4D0D2` web) divides rows. **Strong edge** (`#8FA2A6`) outlines major web regions.
- **Intact red** (`#C83B31`) is the primary action, current progress, selected input, and attention state. Deep red is the hover and small-label variant.
- **Verified green** (`#14755F`) marks saved, live-service, completed, or lower-context states. Its wash (`#CFE7DF`) supports selected proof panels.
- **Red wash** (`#F3D8D4`) marks a selected hypothetical choice without presenting it as confirmed.

**The one-action rule.** Red identifies the action or selection that matters now. Do not spread it across decorative surfaces.

**The provenance rule.** Green means recorded or sourced. It never means that Pixie approved coverage or guaranteed an outcome.

## Typography

The web uses IBM Plex Sans Condensed for its presentation hierarchy and IBM Plex Mono for indices and data. The app uses Public Sans for interface copy and DM Mono for prices, scores, step numbers, and source labels.

- **Web display.** `40 to 64px`, weight 650, line-height 0.96, tracking `-0.035em`. Use for the lifecycle statement only.
- **Web stage title.** `32 to 48px`, weight 650, line-height 0.98. Keep it near 15 characters per line where possible.
- **Native title.** `34px/37px`, Public Sans SemiBold. Use one per screen after the phase label.
- **Body.** `16px/23px` in the app. Web detail text is `14px` with a 1.55 line-height and a maximum measure near 62 characters.
- **Data.** DM Mono or IBM Plex Mono with tabular numerals. Use for currency, ratios, scores, counters, and step indices.
- **Label.** `9 to 11px`, semibold, uppercase, with `0.7 to 1.1px` tracking. Labels name phases, sources, and evidence states. They do not carry full instructions.

Use sentence case for headings and actions. Keep short product labels such as HOME, AUTO, and BUNDLED DEMO uppercase.

## Layout

The web lifecycle has a maximum width of 1480px. Its header uses a wide story column and a compact Home/Auto selector. A four-column stage rail sits above a two-column panel, with explanation on the left and working proof on the right. At 1050px the panel becomes a single column. At 760px the stage rail becomes two columns, proof layouts stack, and the action metadata aligns left. At 520px the route selector and stage rail become one column. Mobile padding is 16px.

The Expo app uses one centered scroll column capped at 660px with 20px horizontal padding. Persistent actions live in a solid footer above the home indicator, and the scroll container reserves the measured footer height. The lifecycle is always four tabs. Supporting screens open in the root stack so the customer can return to the same stage.

Use the implemented 4, 8, 12, 16, 20, 24, 32, and 40px rhythm. A screen starts with the product switch, then 24px of phase spacing, then its primary proof or choice. Dense facts belong in rows or compact stats, not extra cards.

## Elevation & Depth

Native screens are flat. Borders, ink panels, and tonal fills create hierarchy. Do not add shadows to ordinary app panels or actions.

The web uses one structural shadow, `20px 22px 44px rgba(5, 20, 24, 0.24)`, under the proof artifact inside the dark stage. It makes the working example read as an object presented on a desk. The lifecycle shell, navigation, and copy panel remain flat.

Motion is limited to a 420ms stage reveal with `cubic-bezier(0.22, 1, 0.36, 1)` and a 120ms native press scale to 0.97. Remove the stage reveal when the user prefers reduced motion.

## Shapes

Web presentation panels and primary actions use square corners. One-pixel rules define their structure. The phone capture is the exception, with a 34px top radius that represents the device.

Native controls use a restrained soft geometry: 14px buttons and choices, 16px panels, 11 to 15px segmented controls, and 7px checkboxes. Source marks use a tight 4px radius. Reserve full pills for short statuses and circular route markers.

## Components

### Product switch and lifecycle navigation

Home and Auto are a two-option radio group. The selected product uses deep teal with light text. The web stage rail is a keyboard-operable tab list with numbered phases. The app uses Expo Router tabs with matching `01` through `04` mono icons and explicit "step N of 4" accessibility labels.

### Buttons and actions

The primary button is Intact red, at least 52px high in native and 51px on web. Native buttons use a 14px radius and a 0.97 pressed scale. Web actions stay square and darken to deep red on hover. Secondary native buttons use a one-pixel teal border on paper. Text links keep a 44px target and underline.

The drive-context action uses `@expo/ui` platform components. iOS renders a large, prominent SwiftUI button. Android renders the corresponding Jetpack Compose button. Keep its red tint and 52px host height aligned with the shared control.

### Panels, action rows, and choices

Panels have a one-pixel rule and 16px padding. Plain panels use paper, warm panels use the red wash, and ink panels invert to deep teal. Action rows rely on a top rule and a red arrow. Selected rows gain a restrained wash rather than a shadow.

Radio choices expose checked state. Checklists expose checkbox state. A selected hypothetical uses red; a completed record uses green. Do not use either state color without a text or accessibility-state signal.

### Proof artifacts and data

The web proof stage contains one artifact: a quote preview, what-if comparison, prevention checklist, route context view, inventory handoff, or reviewed recovery bundle. Each artifact has a heading, a compact body, and a disclosure close to the result.

Currency, ownership totals, context scores, and progress counts use mono type and tabular numerals. A source mark says `SHARED SERVICE` or `BUNDLED DEMO`. It never implies that an estimate is an Intact price.

### Widgets and Live Activities

The iOS drive widget uses 14px padding, a red 12px label, a 19px zone title, 13px context copy, and an 11px factor line. The Live Activity repeats the current zone and factor in native system layouts. These surfaces report opt-in coaching context. They do not display a premium change or retain route coordinates.

## Do's and Don'ts

### Do

- **Do** keep one main decision and one visible proof on each screen.
- **Do** place the source, model status, and material limit beside every estimate or score.
- **Do** label the Home price as tenant insurance and Auto prices as illustrative Pixie estimates.
- **Do** preserve safe areas, 44px minimum link targets, semantic roles, visible selected states, and reduced-motion behavior.
- **Do** distinguish confirmed facts from what-if inputs. A scenario must never overwrite a confirmed value until the customer chooses it.
- **Do** state that drive context is opt-in coaching and cannot change a quote or premium in this prototype.

### Don't

- **Don't** present a homeowner tariff. The working Home price is for renter or tenant insurance.
- **Don't** present synthetic vehicle listings, bundled room items, route zones, or model outputs as observed customer facts.
- **Don't** use green to suggest approval, red to imply fault, or a score to judge a neighbourhood or identity.
- **Don't** hide disclosures in an About screen when they qualify a visible result.
- **Don't** add decorative gradients, glow effects, glass panels, or shadows to routine controls.
- **Don't** use witness footage, incident evidence, or raw route coordinates as underwriting or pricing inputs.
