# SPA Routing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure direct links and browser refreshes for `/login`, `/dashboard`, `/manage`, and `/import` load the Vite single-page application instead of returning Vercel 404 pages.

**Architecture:** Add a Vercel rewrite that maps every incoming path to the SPA entry point. Keep client-side React Router responsible for selecting the rendered screen.

**Tech Stack:** Vercel, Vite, React Router.

## Global Constraints

- Do not change application data, authentication, or visual components.
- Preserve existing client-side routes.
- Verify production build before committing.

### Task 1: Add SPA fallback rewrite

**Files:**
- Create: `vercel.json`

- [x] Add a catch-all rewrite from `/(.*)` to `/index.html`.
- [x] Run `npm run build` to verify the configuration does not affect the Vite build.
- [x] Commit the configuration and plan.
