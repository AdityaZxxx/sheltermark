# GitHub Issue Tracker

This repository uses GitHub Issues as its issue tracker.

## Workflow

Skills like `to-issues`, `triage`, `to-prd`, and `qa` will use the `gh` CLI to interact with GitHub Issues:

- `gh issue create` - Create new issues
- `gh issue list` - List existing issues
- `gh issue view` - View issue details
- `gh issue update` - Update issue labels, status, etc.

## Authentication

The GitHub CLI (`gh`) must be authenticated with appropriate permissions to the repository.

## Issue Format

Issues follow standard GitHub format with:

- Title
- Description
- Labels
- Assignees (optional)
- Milestones (optional)
