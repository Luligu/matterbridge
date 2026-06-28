# Worker does not exit after `parentPort.close()` — `'exit'` is never emitted

## Summary

When a worker calls `parentPort.close()` and has nothing else keeping its event loop alive, **Node exits the worker (code `0`) and emits the `'exit'` event**. On **Bun**, the worker stays alive and `'exit'` is **never emitted**, so any code that awaits a clean worker shutdown via `'exit'` hangs.

## What version of Bun is running?

`1.3.14`.

## What platform is your computer?

Reproduced on Windows; the behavior appears runtime‑related rather than OS‑specific (the worker simply never signals exit).

## Minimal reproduction

```js
// repro.mjs  —  run with:  bun run repro.mjs
import { Worker } from 'node:worker_threads';

const worker = new Worker(
  `const { parentPort } = require("node:worker_threads");
   parentPort.on("message", (m) => {
     parentPort.postMessage("echo:" + m);
     parentPort.close();           // Node: lets the worker exit. Bun: worker keeps running.
   });`,
  { eval: true },
);

let exited = false;
worker.on('exit', () => {
  exited = true;
});

const reply = await new Promise((resolve) => {
  worker.once('message', resolve);
  worker.postMessage('ping');
});
console.log('reply:', reply);

// Grace window: Node exits the worker well within this after the port closes.
await new Promise((resolve) => setTimeout(resolve, 1000));
console.log('exited within 1s after parentPort.close()?', exited);

await worker.terminate(); // cleanup; on Bun this is the only thing that ends the thread
```

## What is the expected behavior?

```
reply: echo:ping
exited within 1s after parentPort.close()? true
```

(matches Node.js — the worker exits on its own and `'exit'` fires).

## What do you see instead?

```
reply: echo:ping
exited within 1s after parentPort.close()? false
```

`'exit'` never fires on its own; the worker stays alive until `worker.terminate()` is called explicitly.

## Additional information

For reference, the two reliable ways we found to end a worker under Bun are:

- `process.exit(code)` inside the worker → `'exit'` fires with that exact code.
- `worker.terminate()` from the parent → `'exit'` fires (code `0` on Bun; Node returns `1`).

Only `parentPort.close()` differs from Node: the port closes, but the thread does not wind down and `'exit'` is never emitted.

Thanks again for all the work on Bun — glad to share more details or test a fix.
