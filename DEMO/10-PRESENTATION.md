# Pixie presentation

Open http://macserver:3100/present or press **P** in the app.

The deck uses the Federato desk's dark surfaces, amber accent, IBM Plex Sans Condensed and IBM Plex Mono. Slides are short summaries of Ben's supplied pitch material, without equations, score graphics, cards, rehearsal notes or a separate Q&A section.

## Controls

- **P** switches between slides and the demo.
- **Left / Right arrow** moves through slides. Space advances.
- **Home / End** jumps to the first / last slide.
- **Esc** returns to the demo.

Opening slides inside the app uses a modal overlay. The underlying page remains mounted, so its inputs, scroll position and selected panels survive. The modal keeps keyboard focus inside the slides. Opening `/present` directly returns to the last recorded app page, or the scored queue if there is none. The slide position persists within the browser tab.

## Slide order

1. What single fact would change the answer?
2. Appetite and winnability, with hit ratio and high-appetite bound quotes.
3. A range tied to named missing facts.
4. Investigate what is missing.
5. The Challenger argues back.
6. The underwriter has the final say.
7. See the risk within the portfolio, including other lines and buyers.
8. A backtest that shows its own miss.
9. Why Pixie is different.

Use the existing [five-minute script](9-FEDERATO-FIVE-MINUTES.md) for the app sequence: Submissions, Rulebook, Case 138, Portfolio, Validation. Press P whenever a short explanation belongs on a slide instead of the demo screen.

Research links sit on the relevant slides. The critic study's figures are attributed to its authors, and the SMS workflow is described as proposed. The range is described as rule-based; comparative novelty is not asserted as an established market-wide fact. The customer examples belong to Federato.

Content: `web/src/app/present/slides.ts`.
