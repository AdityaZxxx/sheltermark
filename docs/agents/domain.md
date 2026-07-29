# Domain Documentation

This repository uses a single-context domain documentation approach.

## Structure

- `CONTEXT.md` - Contains the project's domain language and key concepts
- `docs/adr/` - Contains Architectural Decision Records (ADRs) documenting key technical decisions

## Consumer Rules

Skills like `improve-codebase-architecture`, `diagnose`, and `tdd` will:

1. Read `CONTEXT.md` to understand the project's domain language
2. Look in `docs/adr/` for past architectural decisions that may affect implementation
3. Use this information to make contextually appropriate decisions

## Creation

If `CONTEXT.md` doesn't exist, it should be created at the repository root with key domain concepts.
If `docs/adr/` doesn't exist, it should be created to store architectural decision records.
