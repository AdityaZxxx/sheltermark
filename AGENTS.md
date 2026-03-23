# Project Overview
Cross-device bookmark manager with web app + Chrome extension called Sheltermark. Personal use focus with public collections capability.

## Tech Stack
- **Frontend:** Next.js (App Router), React, Tailwind CSS v4, shadcn/ui
- **Backend:** Supabase (Auth, Database, Storage)
- **Query:** Tanstack-query, server actions
- **Extension:** Chrome Extension (Manifest V3)
- **Design:** Modern, clean, minimalist. Function over form.

## Key Patterns

### Project Structure
- `/web`: Next.js 16 + Tailwind v4 + Supabase (Web App)
- `/extension`: Chrome Extension Manifest V3
- `AGENTS.md`: Project instructions
- `prd-bookmark-manager.md`: Product Requirements Document

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui with BaseUI
- **Backend:** Supabase (Auth, Database, Realtime)
- **Extension:** Manifest V3, Vanilla JS (for now)
- **Package Manager:** Bun

- `profiles` - Public user data (username, bio, social links)
- `workspaces` - User workspaces private by default (can be made public)
- `bookmarks` - Individual bookmarks with metadata (no description, title only)

### Design Principles
1. **Keyboard-first:** All actions accessible via keyboard
2. **Minimal clicks:** Quick actions, smart defaults
3. **Fast metadata:** Auto-fetch title, description, favicon, og:image
4. **Clean UI:** No clutter, focus on content

### Extension Communication
- Extension saves to Supabase directly
- Uses Supabase auth session from web app
- Minimal UI - quick save only for MVP

## Code Standards
- Strict TypeScript, no `any`
- Use Zod for validation
- Prefer server components, client only when needed
- All components keyboard accessible
- Follow shadcn/ui patterns

## Non-Goals (v1)
- AI categorization
- Team collaboration features
- Import/export from browsers
- Full-text search (simple text search on title/URL only)
- Mobile app (responsive web is enough)
- Tagging system (keep it simple first)
- Drag-drop reordering

## Important Notes
- All user interactions must be in English
- Dont make any changes with assumptions, always ask user first
- Git operations are not allowed by default just have read access