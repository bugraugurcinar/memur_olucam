# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KPSS Coğrafya Atlas — interactive map-based learning platform for the geography section of Turkey's KPSS exam. Built with React 19 + TypeScript + Vite, using Leaflet for the map. All user-facing copy is in Turkish.

## Commands

```bash
npm run dev      # Vite dev server on 127.0.0.1 (default port 5173)
npm run build    # type-check (tsc --noEmit) then build to dist/
npm run preview  # serve the production build

# Rebuild marker datasets (writes into public/geojson/)
node scripts/buildPhysicalFeatures.mjs
node scripts/buildEconomicFeatures.mjs
```

There is no test suite, linter, or formatter configured. `npm run build` is the only verification step — it runs `tsc --noEmit` under `strict: true`, so type errors fail the build.

### Environment / Supabase

Cloud accounts + gamification use Supabase. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored; see `.env.example`). If they are missing, `src/lib/supabase.ts` exports a `null` client and the app runs fully **anonymously** — the map/quiz work, only cloud progress/leaderboard are disabled. The DB schema (two tables + RLS + a `handle_new_user` trigger) lives in `supabase/schema.sql`; run it once in the Supabase SQL editor and turn off "Confirm email" in Auth settings.

## Architecture

The app is a single-page React app whose state lives almost entirely in `src/App.tsx`. Three orthogonal concerns are composed there:

1. **Map canvas** (`src/maps/TurkeyMap.tsx`) — imperative Leaflet renderer. It takes GeoJSON layers + topic/category filters + quiz state as props and reconciles a Leaflet map via refs. Quiz/Plus overlays (guess points, target markers, drag-and-drop tokens) are drawn here. New map behavior almost always means new props through this component.
2. **Quiz engine** (`src/quiz/questionEngine.ts`) — the "classic" quiz. Six `QuestionKind`s (`mapLocate`, `mapMatch`, `oddOneOut`, `nearby`, `regionPick`, `orderLine`), three difficulties, free vs. timed rounds (`TIMED_ROUND_SECONDS`, `TIMED_ROUND_TARGET`). `generateQuizQuestion` is pure — given features + mode + difficulty + region, it returns a `QuizQuestion`. Scoring uses haversine distance with `QUIZ_CORRECT_RADIUS_KM`.
3. **Plus engine** (`src/quiz/plusQuestionEngine.ts`) — the newer "Soru+" mode. Topic-scoped (mine, industry, energy, agriculture, mountain, river, lake, plainPlateau) with token/target drag-and-drop placement (`placement`, `mapMatch`, etc.). Same pure-function shape: `generatePlusQuestion(...)` → `PlusQuestion`.

`App.tsx` orchestrates quiz/plus state machines (current question, answer state, session stats, timer) and decides what to pass to `TurkeyMap`. Both engines are pure given their input features, so feature data is the source of truth.

4. **Gamification** (`src/quiz/gamification.ts`) — pure XP/level/badge/daily-quest logic (no side effects). Every Soru+ answer is recorded at the single funnel `finalizePlusAnswer` in `App.tsx`, which calls `recordAnswer` from `useQuizProgress` (`src/hooks/useQuizProgress.ts`). That hook keeps an in-memory session plus cloud-persisted lifetime totals/XP/badges/daily quests (optimistic upserts to Supabase via `useAuth`'s user). `recordAnswer` returns `GamificationEvents` that drive `GamificationFX` (`src/components/GamificationFX.tsx` — framer-motion + canvas-confetti). `useLeaderboard` reads the public `profiles` table. Keep the engines pure — persistence/effects stay in the hooks and `App.tsx`.

### Data flow

GeoJSON is fetched at runtime via `useGeoJson(url)` from `/geojson/*.geojson` (served from `public/`). There are four datasets, registered in `src/geojson/sources.ts`:

- `turkey-country.geojson` — country outline (geoBoundaries ADM0)
- `turkey-provinces.geojson` — 81 provinces (geoBoundaries ADM1)
- `turkey-physical-features.geojson` — mountains, plains, plateaus, rivers, lakes, coast types
- `turkey-economic-features.geojson` — mines, industry, energy, agriculture markers

Physical and economic features are typed in `src/geojson/physicalFeatures.ts` and `src/geojson/economicFeatures.ts`. Each file defines the canonical `topics` and `categories` arrays (id + label + color), exports `PhysicalFeature` / `EconomicFeature` types, and provides accessors used by both the map and the quiz engines. **Adding a new topic or category means editing both the source dataset and these two files in lockstep** — the quiz engines branch on these ids.

Marker icons are mapped in `src/geojson/featureIcons.ts`.

### Marker datasets are generated, not hand-edited

`public/geojson/turkey-physical-features.geojson` and `turkey-economic-features.geojson` are produced by the scripts in `scripts/`. Coordinates are sourced from OpenStreetMap / Photon (physical) and curated KPSS reference points (economic). Manual overrides for physical features live in `scripts/physicalFeatureCorrections.mjs`. **Do not hand-edit the generated GeoJSON** — change the script (or the corrections file) and re-run.

Physical-features geocoding is cached at `/tmp/kpss-physical-feature-geocoding-cache-v2.json` to keep reruns fast.

## Conventions

- All UI copy and content (question prompts, KPSS notes, labels) is in Turkish. Match that when adding strings.
- The quiz engines are designed to be deterministic given their inputs — keep them pure. Side-effecting code (timers, fetches, Leaflet) stays in `App.tsx`, `TurkeyMap.tsx`, and `useGeoJson.ts`.
- `index.css` holds all styles (no CSS modules, Tailwind, or styled-components). Inline `CSSProperties` is used freely in `App.tsx`.
