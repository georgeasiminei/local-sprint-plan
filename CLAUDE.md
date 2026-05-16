# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Local-First State**: No backend. The active plan is stored in the URL hash. Named snapshots are stored in `localStorage`.
- **Scheduling Engine**: Logic for generating ISO weeks, sprints, and computed schedule rows is kept pure and separate from React components in `src/engine/`.
- **State Management**: Uses Zustand for global application state (`src/store/`).
- **Persistence**: URL hash and `localStorage` logic is handled in `src/persistence/`.

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
- **ISO Week-Year**: Columns are labeled `YY.WW` based on ISO standards.
- **Resource Rules**: Resource allocations are stored as rules that apply from a specific week onward until changed.
- **Computed Schedule**: The app regenerates the schedule in memory based on the compact document stored in the URL.
