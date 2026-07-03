# `FileHandle.createWriteStream({ flush: true })` + `handle.close()` leaks the handle on Windows → `EPERM` on subsequent `rename()`

## Summary

On **Windows**, after writing a temp file through `FileHandle.createWriteStream({ flush: true })` and awaiting `handle.close()`, the underlying OS file handle is **not released by the time `close()` resolves**. The next `rename()` of that temp file then fails with `EPERM`, because Windows refuses to rename a file that still has an open handle.

This is the classic write‑temp‑then‑atomic‑rename pattern. It works on Node.js and on Bun for Linux/macOS; it only fails on Bun for Windows.

## What version of Bun is running?

`1.3.14` (also reproduced on the GitHub Actions `windows-latest` runner).

## What platform is your computer?

Windows 11 (and Windows Server on `windows-latest`). **Not** reproducible on Linux or macOS (POSIX allows renaming an open file).

## Minimal reproduction

```js
// repro.mjs  —  run with:  bun run repro.mjs
import { open, rename, rm, mkdir, readFile } from 'node:fs/promises';

const dir = 'bun-rename-repro';
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
const final = `${dir}/file`;

for (let i = 0; i < 500; i++) {
  const tmp = `${final}.tmp`;
  const handle = await open(tmp, 'w');
  const writer = handle.createWriteStream({ encoding: 'utf8', flush: true });
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    writer.write(`v${i}`);
    writer.end();
  });
  await handle.close(); // resolves, but the OS handle is still held on Windows
  await rename(tmp, final); // EPERM on Bun/Windows
}

console.log('done:', await readFile(final, 'utf8'));
```

## What is the expected behavior?

The loop completes and prints `done: v499`, exactly as on Node.js. Once `await handle.close()` resolves, the OS handle is released and `rename()` succeeds.

## What do you see instead?

```
EPERM: operation not permitted, rename 'bun-rename-repro\file.tmp' -> 'bun-rename-repro\file'
  syscall: "rename",
  errno: -1,
  code: "EPERM"
```

It typically fails on the very first iteration.

## Additional information

- The defect is specific to the **write‑stream** path. The following alternatives all work on Bun/Windows, so `rename()` itself is fine — only the `createWriteStream(...) + close()` handle lifecycle is affected:
  - `await writeFile(tmp, value)` + `rename`
  - `await handle.writeFile(value)` + `close` + `rename`
  - `await Bun.write(tmp, value)` + `rename`
- **Retrying the `rename` does not help.** A retry/backoff (10 attempts, ~275 ms total) still throws `EPERM`, which suggests the handle is not released within any usable window rather than losing a transient race.
- **Real‑world impact:** this is the standard atomic‑write used by storage layers. We hit it via `matter.js` (`@matter/nodejs` `FileStorageDriver.#writeAndMoveFile`), which breaks all persistent storage when running the app on Bun for Windows.

Thanks again for looking into it — happy to provide more details, traces, or test against a patched build.
