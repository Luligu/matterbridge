# Contributing

Thanks for taking the time to contribute to Matterbridge.

This guide is intentionally **repository-agnostic** so it can be reused across Matterbridge repositories. Each repository may also include extra instructions in its `README*` files. When in doubt, follow the repo-specific documentation.

## Ways to Contribute

- Report bugs (with clear reproduction steps)
- Propose improvements and new features
- Improve documentation and examples
- Submit code changes and tests

## Before You Start

- Search existing issues and pull requests to avoid duplicates.
- For larger changes, open an issue first to discuss scope and approach.

## Development Workflow

- Fork the repository and create a topic branch.
- Base your branch on the repository’s intended development branch:
  - Prefer `dev` when the repository uses it.
  - Otherwise, use the default branch (`main`).
- Follow the repo’s setup instructions (usually in `README.md` / `README-DEV.md`).
- Run formatting/lint/tests if the repository provides scripts for them (for example: `npm run lint`, `npm run format`, `npm run test`, `npm run build`).

## Submitting a Pull Request

- Open a PR from your fork to the upstream repository.
- Target the correct base branch (`dev` when used, otherwise the default branch).
- Keep the PR focused (one feature/fix per PR when possible).
- Describe what changed and why, and include:
  - Steps to test the change
  - Links to related issues
  - Screenshots/logs when relevant
- Follow the existing code style and patterns.
- Add or update tests for any behavior changes when practical.
- Ensure CI passes (or explain why it cannot).

## Reporting Bugs

When filing a bug report, please include:

- What you expected to happen vs what happened
- Steps to reproduce
- Versions (Matterbridge/repo version, Node.js, OS)
- Relevant logs (remove tokens/secrets)

## Security

If you believe you’ve found a security issue, avoid posting sensitive details publicly. Contact the maintainers through GitHub or Discord group.
