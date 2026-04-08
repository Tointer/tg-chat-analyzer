# Project Guidelines

## Project Shape
- This is a SvelteKit + TypeScript + Tailwind v4 app.
- Telegram export input is read from `src/messages/result.json` on the server. Do not move that parsing to client code unless explicitly asked.
- Main UI lives in `src/routes/+page.svelte`; data is prepared in `src/routes/+page.server.ts`.
- Analysis logic lives in `src/lib/telegram-analysis.ts` and related analyzer files.
- Theme state and chart palettes live in `src/lib/themes.ts`.

## Build And Validation
- Use `bun run check` as the standard validation step
- Use `bun test` for the test suite 

## Svelte Conventions
- Use Svelte 5 runes and existing project patterns (`$state`, `$derived`, `$effect`, `$props`).
- Keep client components reactive instead of forcing remounts. If a chart or visual depends on theme or prop changes, update the existing instance rather than recreating architecture around it.

## Tailwind And Styling
- Prefer Tailwind utilities over component-scoped CSS where practical.
- Avoid arbitrary Tailwind values when a standard utility exists.
- Use semantic theme tokens from `src/routes/layout.css` instead of hardcoding page colors.

## Theme System
- When changing themes, update both `src/lib/themes.ts` and `src/routes/layout.css`.
- Do not hardcode chart colors in `+page.svelte` or `MiniAreaChart.svelte`; read them from the active theme.
- Keep the theme toggle behavior driven by the shared theme store (`activeThemeName`, `cycleTheme`, `initializeThemeStore`).

## Data And Chart Behavior
- Message charts intentionally drop the first and last aggregated buckets as incomplete edge periods. Preserve that behavior unless the task explicitly changes analytics semantics.
- The page supports `day` and `week` views through the `period` query parameter. Default remains `week` unless explicitly changed.

## Editing Guidelines
- Preserve the warm dark / dawn theme direction unless the task explicitly asks for a redesign.
