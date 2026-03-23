# Changelog

### Added
- **Authentication**
  - Google OAuth sign-in
  - Email/password sign-in
  - Forgot password flow
  - Reset password flow
  - Session persistence across devices

- **Workspaces**
  - Create multiple workspaces
  - Default "Personal" workspace on first sign-in
  - Public/private workspace toggle
  - Delete workspace with confirmation
  - Move bookmarks between workspaces

- **Bookmarks**
  - Add bookmark via URL input
  - Auto-fetch metadata (title, favicon, og:image)
  - Edit bookmark title
  - Delete bookmark with confirmation
  - Rename bookmark
  - Move between workspaces
  - List view (default) and card view with og:image preview
  - Text search on title and URL

- **User Profile**
  - Unique username for public URL `/u/username`
  - Bio and full name
  - Social links: GitHub, X (Twitter), website
  - Avatar upload
  - Public/private profile toggle
  - Public profile page showing all public workspaces

- **Chrome Extension**
  - One-click save from any tab (Ctrl+Shift+K)
  - Dropdown to select workspace
  - Notification on save
  - X/Twitter specific capture script

- **UI/UX**
  - Keyboard-first navigation
  - Dark/light theme toggle
  - Responsive design (mobile, tablet, desktop)
  - Demo mode for unauthenticated users

### Changed
- Improved metadata fetching reliability

### Fixed
- RLS policies for proper data isolation
- Workspace ownership validation for bookmarks
- Extension auth session handling