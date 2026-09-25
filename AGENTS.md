# AGENTS.md

Guidance for agents working in this repository.

## Project

This project is a live local-only browser app for project timeline planning. The product requirements live in `docs/project_timeline_manager_requirements.md`.

Core constraints from the requirements:

- Build a static React/Vite application that can run without a backend.
- Store the single active plan entirely in the browser URL hash.
- Support copying the URL for backup and sharing.
- Keep scheduling, ISO week generation, dependency handling, external dependency markers, validation, and resource calculations fully client-side.
- Favor a self-explanatory UI for small teams and low-to-medium usage.
- Treat compatibility as a live-product constraint: avoid breaking existing shared URLs, compact URL payloads, or user workflows unless the owner explicitly decides on a breaking change and the migration plan is documented.

## Expected Stack

- React with Vite
- Tailwind CSS
- Zustand or React Context with `useReducer` for state
- Native browser APIs for URL hash updates, explicit local snapshot saves, and CSV export
- No server, API, database, authentication, or account system

## Build and Development Commands

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`
- Run tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`

## Architecture and Structure

The project is a local-only sprint planner built with React 19, Vite, and Tailwind CSS.

### Core Architecture

- Local-First State: No backend. The active plan is stored in the URL hash. Named snapshots are stored in `localStorage`.
- Scheduling Engine: Logic for generating ISO weeks, sprints, and computed schedule rows is kept pure and separate from React components in `src/engine/`.
- State Management: Uses Zustand for global application state (`src/store/`).
- Persistence: URL hash and `localStorage` logic is handled in `src/persistence/`.

### Project Layout

- `src/engine/`: Core scheduling and calculation logic (Pure JS).
- `src/store/`: Zustand store definitions.
- `src/persistence/`: Logic for syncing state with URL and local storage.
- `src/components/`: Reusable UI components.
- `src/pages/`: Page-level views.
- `src/hooks/`: Custom React hooks.
- `src/utils/`: General purpose utility functions.
- `src/constants/`: Global constants and configuration.
- `src/test/`: Test utilities and helpers.

### Key Domain Concepts

- ISO Week-Year: Columns are labeled `YY.WW` based on ISO standards.
- Resource Rules: Resource allocations are stored as rules that apply from a specific week onward until changed.
- Computed Schedule: The app regenerates the schedule in memory based on the compact document stored in the URL.

## Development Notes

- Keep generated build output such as `dist/` out of version control.
- Prefer small, focused modules for scheduling, URL persistence, export, and UI state.
- When adding scheduling logic, keep pure calculation functions separate from React components so they are easy to test.
- Preserve the compact URL document shape described in the requirements unless a deliberate migration plan is added. Resource edits should stay as source rules rather than generated weekly schedule rows, and external dependencies should stay as deadline markers rather than generated spans.
- Keep Markdown requirements aligned with the URL-owned single-plan product; localStorage is only for explicit named snapshots, not hidden autosave or multi-plan ownership.
- Keep Markdown files up to date with behavior changes in the same change set, especially `README.md`, `docs/project_timeline_manager_requirements.md`, and `docs/implementation_plan.md`.
- Use clear, task-oriented UI copy and avoid hidden workflows.

## Verification

When implementation exists, run the project checks available in `package.json`, typically:

```powershell
npm run test
npm run build
```

If no scripts exist yet, document any manual browser checks performed.
