# Contributing to Mathfinder

## Track work in GitHub Issues

Use [GitHub Issues](https://github.com/adammartin2500-ship-it/Mathfinder/issues)
for new features, bugs, and actionable maintenance work. Search existing issues
first. One issue should describe a coherent outcome; use a checklist for its
implementation steps rather than opening an issue for every small task.

Include the problem, desired outcome, and testable acceptance criteria. Add
out-of-scope notes when boundaries matter. Use the issue templates to get
started. Keep labels lightweight: `bug`, `feature`, and `tech-debt` are enough
initially, with `needs-design` when requirements need discussion.

Claim work by assigning the issue to yourself when possible, and leave a comment
before starting to avoid duplicate efforts. Link dependencies explicitly.

In pull requests, use `Closes #123` only when the change completes that issue's
acceptance criteria; use `Refs #123` for partial progress. Verify applicable
tests and describe what was checked.

## Docs explain; issues track

Keep architecture, setup instructions, and durable design decisions in the
repository. Link them from issues instead of copying entire design documents
into tickets. Inline TODOs should be small and code-specific, with an issue
link when they represent deferred work.

Existing `TODO.md`, `BACKEND_ISSUES.md`, and plan checklists are migration inputs,
not places to add new work. Preserve them until their unfinished items have
been checked against current code and existing GitHub issues. Once migrated,
replace backlog-only files with links to the corresponding issues; retain
useful architecture documents without maintaining duplicate task status.

A GitHub Project is optional. If used, keep the board simple: Backlog, Ready,
In progress, Done. Issues remain the source of truth for scope and discussion.
