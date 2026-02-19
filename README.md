# Sheltermark

A clean, minimalist bookmark manager. Organize and access your bookmarks from anywhere.

## Features

- **🔖 Smart Bookmarks** - Auto-fetch metadata (title, favicon, og:image) from any URL
- **📁 Workspaces** - Organize bookmarks into collections (public or private)
- **🔍 Quick Search** - Find bookmarks instantly by title or URL
- **🌐 Public Profiles** - Share your curated collections at `/u/[username]`
- **🎨 Clean UI** - Minimalist design focused on content

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend:** Supabase (Auth, Database, Storage)
- **State Management:** TanStack Query
- **Package Manager:** Bun

## Features in Detail

### Workspaces
- Create unlimited workspaces
- Toggle public/private visibility
- Move bookmarks between workspaces

### Bookmark Management
- Add bookmarks via URL (auto-metadata fetch)
- Edit title and move between workspaces
- Bulk operations (move, delete, copy URLs)
- View as list or card grid

### Public Profiles
- Share workspaces publicly
- Beautiful profile pages at `/u/username`
- Filter by workspace tabs

## Roadmap

- [x] Web app with workspaces
- [x] Public profile pages
- [x] Auto-metadata fetching
- [ ] Chrome Extension (WIP)
- [ ] Import/export
- [ ] Full-text search