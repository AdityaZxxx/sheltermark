# PRD: Bookmark URL Manager

## Problem Statement

### What problem are we solving?
Browser bookmarks are chaotic and unorganized. They don't sync well across devices and browsers, making it difficult to maintain a clean, accessible collection of saved URLs. There's no easy way to:
- Organize bookmarks into meaningful collections
- Access bookmarks from any device seamlessly
- Share curated collections publicly
- Get useful metadata without manual entry

### Why now?
Personal productivity improvement. Daily frustration with scattered bookmarks across multiple browsers and devices.

### Who is affected?
- **Primary user:** Solo developer/researcher who saves many URLs daily
- **Secondary users:** Anyone who discovers public collections

## Proposed Solution

### Overview
A cross-device bookmark manager consisting of a Next.js web application and Chrome extension. Users authenticate via Google or Email, organize bookmarks into workspaces (public or private), and save URLs with auto-fetched metadata. The Chrome extension enables quick one-click saving of the current tab.

### User Experience

#### User Flow: Quick Save (Extension)
1. User clicks extension icon on any webpage
2. Extension authenticates with existing session
3. Bookmark saved to default workspace with auto-fetched metadata
4. Toast confirmation appears
5. User can optionally select different workspaces

#### User Flow: Organize Bookmarks (Web)
1. User opens web app, sees dashboard with workspaces
2. User navigates to a workspace, sees bookmarks in list view (default) or card view
3. User can single select or multi-select bookmarks to access actions: edit, move, delete
4. User can search bookmarks by title or URL and Enter to add bookmark from 1 smart input component

#### User Flow: Create Public Workspace
1. User creates new workspace
2. User toggles "Public" switch
3. System generates shareable URL
4. Public visitors can view (read-only) without auth

### Design Considerations
- **Visual:** Modern, clean, minimalist. Neutral colors, generous whitespace
- **Accessibility:** Full keyboard navigation, WCAG 2.1 AA compliance
- **Responsive:** Mobile-first, works on all screen sizes
- **Interactions:** Simple interactions, no animations

## End State

When this PRD is complete, the following will be true:

- [ ] Users can sign in with Google OAuth or Email
- [ ] Users can create multiple workspaces
- [ ] Users can create public/private workspaces
- [ ] Bookmarks auto-fetch metadata (title, favicon, og:image)
- [ ] Chrome extension enables one-click save of current tab
- [ ] Web app is fully responsive (mobile, tablet, desktop)
- [ ] All interactive elements are keyboard accessible
- [ ] Public workspaces are viewable without authentication
- [ ] Data syncs across all devices in real-time

## Success Metrics

### Quantitative
| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Daily active saves | 0 | 5+ bookmarks/day | Supabase analytics |
| Page load time | N/A | < 1.5s | Vercel analytics |
| Extension save time | N/A | < 500ms | Performance monitoring |

### Qualitative
- Personal satisfaction: "Does this feel better than browser bookmarks?"
- Friction: "Can I save a bookmark without thinking?"
- Organization: "Can I find what I saved last week?"

## Acceptance Criteria

### Authentication
- [ ] Google OAuth and Email sign-in works
- [ ] Session persists across browser refresh
- [ ] Extension can access authenticated session
- [ ] Sign out clears all sessions

### Workspaces
- [ ] User can create workspace with name
- [ ] User can delete workspace
- [ ] Default "Personal" workspace created on first sign-in
- [ ] Workspaces can be set as public or private
- [ ] User can move bookmarks between workspaces

### Bookmarks
- [ ] User can add bookmark via URL input
- [ ] Metadata auto-fetches: title, favicon, og:image
- [ ] User can edit bookmark title
- [ ] User can delete bookmark
- [ ] User can move bookmark between workspaces if user has more than 1 workspace
- [ ] Default display: list view (vertical, like browser tabs)
- [ ] Optional display: card view with og:image preview
- [ ] Text search on bookmark title and URL

### User Profile
- [ ] User can set public username (unique)
- [ ] User can add bio
- [ ] User can add social links: GitHub, X (Twitter), website URL
- [ ] User can toggle public/private profile
- [ ] Public profile page at `/u/<username>`
- [ ] Profile shows user's public workspaces

### Chrome Extension
- [ ] Extension icon shows logged-in state
- [ ] One-click saves current tab to default workspace
- [ ] Dropdown to select different workspace if user has more than 1 workspace
- [ ] Toast notification on successful save
- [ ] Works on all http/https pages

### Keyboard Accessibility
- [ ] Tab navigation works through all interactive elements
- [ ] Enter/Space activates buttons and links
- [ ] Escape closes modals and dropdowns
- [ ] Arrow keys navigate lists
- [ ] Focus indicators visible on all elements

### Responsive Design
- [ ] Mobile (< 640px): Single column, touch-friendly
- [ ] Tablet (640-1024px): Two columns
- [ ] Desktop (> 1024px): Main content 3-column at bookmark card list variant

---

## Technical Context

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Extension | Chrome Extension Manifest V3 |
| Deployment | Vercel (web), Chrome Web Store (extension) |

### Data Model

```
auth.users (managed by Supabase Auth)
├── id: uuid
├── email: string
├── encrypted_password: string
├── avatar_url: string
└── created_at: timestamp

profiles (public user data)
├── id: uuid (FK → auth.users.id)
├── username: string (unique, for public URL /u/@username)
├── full_name: string (nullable)
├── avatar_url: string (nullable)
├── bio: string (nullable)
├── website_url: string (nullable)
├── github_url: string (nullable)
├── x_url: string (nullable)
├── is_public: boolean
├── updated_at: timestamp
└── created_at: timestamp

workspaces
├── id: uuid
├── user_id: uuid (FK → profiles.id)
├── name: string
├── is_public: boolean
├── is_default: boolean
├── updated_at: timestamp
└── created_at: timestamp

bookmarks
├── id: uuid
├── user_id: uuid (FK → profiles.id)
├── workspace_id: uuid (FK → workspaces.id)
├── url: string
├── title: string (nullable)
├── favicon_url: string (nullable)
├── og_image_url: string (nullable)
├── updated_at: timestamp
└── created_at: timestamp

-- Ownership Validation Trigger
-- Ensures workspace belongs to same user as bookmark
```

### Row Level Security (RLS)

**profiles:**
- Public: `is_public = true` → readable by everyone
- CRUD: Users can only update own profile

**workspaces:**
- Public: `is_public = true` → readable by everyone
- CRUD: Users can only manage own workspaces

**bookmarks:**
- CRUD: Users can only manage own bookmarks
- Ownership validation: Bookmark's `user_id` must match workspace's `user_id`

- Extension uses same auth session as web app

### Metadata Fetching
- Server-side fetch using Next.js API route
- Parse HTML for: `<title>`, `link[rel="icon"]`, `meta[property="og:image"]`
- Fallback to URL if fetch fails
- Cache metadata to avoid refetching
- User can re-fetch metadata manually if needed

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Metadata fetch blocked by CORS/firewall | High | Medium | Server-side fetching, graceful fallback |
| Extension auth sync issues | Medium | High | Use Supabase session cookies, clear error states |
| Slow metadata fetching | Medium | Medium | Background job, optimistic UI |
| Supabase rate limits | Low | Medium | Implement caching, batch operations |

## Non-Goals (v1)

Explicitly out of scope for this PRD:

- **Team collaboration** - Personal use only for MVP
- **Import/export from browsers** - Nice to have, not critical
- **Full-text search** - Simple text search on title/URL only
- **Social features** - No comments, likes, follows

## Interface Specifications

## Documentation Requirements

- [ ] README.md with project overview, tech stack, and features
- [ ] Environment variables documentation
- [ ] Chrome extension installation guide

## Appendix

### Glossary
- **Workspace:** Top-level container for organizing collections (e.g., "Work", "Personal")
- **Metadata:** Auto-fetched info about URL (title, favicon, og:image)
- **Profile:** Public user page with username, bio, and social links
- **List View:** Default bookmark display, compact vertical list like browser tabs
- **Card View:** Alternative display showing og:image previews

### References
- [Nextjs 16](https://nextjs.org/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [shadcn/ui Components BaseUI API](https://ui.shadcn.com/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
