# Verify npm latest and dev tag alignment for Matterbridge packages

Verify that the published Matterbridge packages on npm are aligned for both the `latest` and `dev` dist-tags.

Scope:

- Use [package.json](../package.json) to discover the root package name and the workspace manifest paths.
- Check the root `matterbridge` package and every real workspace package listed in the root `workspaces` array.
- Read each workspace package name from its `package.json`; do not hard-code the workspace package list.
- Ignore mock package manifests under `packages/core/src/mock/**`.
- Exclude [apps/frontend/package.json](../apps/frontend/package.json) because `@matterbridge/frontend` is versioned and published independently. Include it only when explicitly requested.

Execution rules:

- Query the npm registry directly. Do not infer published versions from local manifest versions, lockfiles, release notes, or Git tags.
- Do not run repository build, test, publish, or automation scripts.
- For each package, query the exact version selected by both dist-tags, equivalent to:

  ```bash
  npm view <package-name>@latest version
  npm view <package-name>@dev version
  ```

- Treat the published `matterbridge@latest` version as the expected version for every in-scope package's `latest` tag.
- Treat the published `matterbridge@dev` version as the expected version for every in-scope package's `dev` tag.
- Require exact version equality, including any prerelease suffix such as `-dev-YYYYMMDD-abcdef0`.
- Do not compare `latest` with `dev`; alignment is evaluated independently within each tag.
- Treat a missing package, missing dist-tag, empty response, invalid version, authentication error, network error, or npm registry error as a verification failure. Report the error and do not silently skip that package.
- Do not modify package metadata, publish packages, or move npm dist-tags.

Checks:

- Verify every in-scope package at `latest` exactly matches `matterbridge@latest`.
- Verify every in-scope package at `dev` exactly matches `matterbridge@dev`.
- Verify every workspace listed by the root manifest was checked for both tags.
- If arguments name a subset of packages or one tag, limit the registry queries to that requested scope while still using the corresponding `matterbridge` tag as the reference.

Output requirements:

- Report the npm registry used for the queries.
- Report `matterbridge@latest` and `matterbridge@dev` first, unless the requested scope contains only one tag.
- Provide a concise table with one row per package and columns for package, `latest`, `dev`, and status.
- Mark a package aligned only when each checked tag exactly matches the corresponding `matterbridge` reference version.
- List every mismatch with the package name, tag, current published version, and expected version.
- List registry/query failures separately from version mismatches.
- If everything matches, explicitly state that `matterbridge` and all in-scope Matterbridge workspace packages are aligned on both `latest` and `dev`.
- If only a subset was requested, state exactly which packages or tags were not checked.
- Do not modify files or npm registry state.
