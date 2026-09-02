# DESIGN.md — AI Sales CRM

Recorded from the built world (landing = "Live Wire" direction; app shell = established neutral shadcn system).

## Worlds

Two surfaces, one brand bridge:

1. **Landing (`/`) — "Live Wire"** (Persuade/Experience): deep ink-blue terminal ground `#0B1220`, panel blue `#0E1730`, wire hairlines `#2A3A55` (+ dim `#1C2942`), paper text `#F2F5FA` (+ dim `#C7D1E2`), signal amber `#FFB224` reserved for the human gate/CTA, status green `#4ADE80`, reject red `#F87171`. Grid-paper backdrop inside sim panels (44px, 35% opacity). Agents are circles; the human approval station is the only square. Signature: live looping pipeline simulation with counting score, tier pill, rotated rubber-stamp APPROVED/REJECTED, CRM-update card with follow-up chips; secondary: agent log ticker, scroll-driven 10-step rail walkthrough (amber fill, sticky node).
2. **App (`/(app)`) — shadcn neutral** (Operate): standard tokens in `globals.css` (`--background`, `--primary`, success badge pair), Geist Mono for data. Untouched by the landing work.

## Typography

- Display: **Bricolage Grotesque** (800, tight tracking, `-0.03em`) — landing h1–h3 via `--font-display`.
- Body: **Figtree** — global `--font-sans` chain, `--font-body` var.
- Data/labels: **Geist Mono** — `.mono` utility on landing (0.72rem, +0.08em tracking), badges/code chips.

## Motion grammar

One material idea: *the pipeline is alive*. Token travels the track (850ms, `cubic-bezier(0.16,1,0.3,1)`), active node pulses (1.4s), stamp lands with overshoot (420ms `cubic-bezier(0.34,1.56,0.64,1)`), ticker lines slide in, walkthrough opacity/fill follow scroll position. All loops stop offscreen (IntersectionObserver) and collapse under `prefers-reduced-motion` (opacity/color only, 1ms durations). Feedback transitions elsewhere: 150ms ease.

## Layout system

Landing max-width 72rem; hero 5fr/7fr split → single column ≤960px; hairline-divided feature grid (auto-fill 15.5rem); walkthrough 2rem rail + 42vh steps; mono footer with service ports. Mobile ≤640px: only the active station label shows.

## Voice

Plain, specific, no hype. Buttons say what they do ("Open the app"). Copy names the mechanism ("You sign the sends"). Synthetic data is labeled ("synthetic data" pill). Demo logins shown as mono footnotes.
