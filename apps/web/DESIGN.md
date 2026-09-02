# DESIGN.md — AI Sales CRM

Recorded from the built world. Landing = **"Forge"** direction (db-derived via ui-ux-pro-max: luxury-dark ground + cyberpunk energy + Bold Statement pairing, fused away from every default cluster). App shell = established neutral shadcn system, untouched.

## Worlds

1. **Landing (`/`) — "Forge"** (Persuade/Experience): warm graphite ground `#17150F` with SVG film grain, panels `#1E1B14`/`#26221A`, hairline seams `#3A3427` (+dim `#2A2620`), bone type `#F2EAD8` (+dim `#B3A68E`). Two-accent semantics: **heat orange `#FF5C1F` = AI activity** (active nodes, traveling token, primary CTA, eyebrow), **quench teal `#2DD4BF` = human verdict / verified** (approval square, stamp, code chips, ticker dot), copper `#C08552` = chrome/done states, red `#F0554D` = reject. Sharp corners (2–4px), uppercase labels, brushed-steel panel texture, radial heat glows. Signature: live pipeline sim (forge run metaphor) + scroll rail.
2. **App (`/(app)`) — shadcn neutral** (Operate): standard tokens, Geist Mono for data.

## Typography

- Display: **Bebas Neue** (uppercase, line-height 0.95, +0.015em tracking) — landing h1/h2/h3, lead names, score digits via `--font-display`.
- Body: **Source Sans 3** — global `--font-sans`, `--font-body`.
- Labels: **Chakra Petch** (600, +0.09–0.22em tracking, uppercase) — buttons, eyebrows, station labels, stamps via `--font-label`.
- Data: **Geist Mono** — `.mono` utility, log lines, login footnotes.

## Motion grammar

Unchanged thesis — *the pipeline is alive* — recolored to the forge: token = molten dot (heat glow), active node = heat pulse, done nodes cool to copper, human gate pulses teal when active, stamp glows quench-teal. Walkthrough rail fill = heat→copper gradient. All loops offscreen-paused; `prefers-reduced-motion` collapses to opacity/color.

## Layout system

Landing max-width 76rem; hero 5fr/7fr → single column ≤960px; hairline-divided spec grid; walkthrough 2rem rail + 44vh steps; CTA heat-glow (overflow-clamped for mobile). Mobile ≤640px: only active station label visible.

## Voice

Forge register: short, physical, no hype. "Raw leads in. Signed deals out." / "Nothing ships until a human cools it." Buttons uppercase imperative ("Open the app"). Synthetic data labeled. Logins as mono footnotes.
