# AGENTS.md

Guidance for agents working in this repository.

## Project

This project is a local-only browser app for project timeline planning. The product requirements live in `docs/project_timeline_manager_requirements.md`.

Core constraints from the requirements:

- Build a static React/Vite application that can run without a backend.
- Store the single active plan entirely in the browser URL hash.
- Support copying the URL for backup and sharing.
- Keep scheduling, ISO week generation, dependency handling, external dependency markers, validation, and resource calculations fully client-side.
- Favor a self-explanatory UI for small teams and low-to-medium usage.

## Expected Stack

- React with Vite
- Tailwind CSS
- Zustand or React Context with `useReducer` for state
- Native browser APIs for URL hash updates, explicit local snapshot saves, and CSV export
- No server, API, database, authentication, or account system

## Development Notes

- Keep generated build output such as `dist/` out of version control.
- Prefer small, focused modules for scheduling, URL persistence, export, and UI state.
- When adding scheduling logic, keep pure calculation functions separate from React components so they are easy to test.
- Preserve the compact URL document shape described in the requirements unless a deliberate migration plan is added. Resource edits should stay as source rules rather than generated weekly schedule rows, and external dependencies should stay as deadline markers rather than generated spans.
- Keep Markdown requirements aligned with the URL-owned single-plan product; localStorage is only for explicit named snapshots, not hidden autosave or multi-plan ownership.
- Use clear, task-oriented UI copy and avoid hidden workflows.

## Verification

When implementation exists, run the project checks available in `package.json`, typically:

```powershell
npm run test
npm run build
```

If no scripts exist yet, document any manual browser checks performed.
