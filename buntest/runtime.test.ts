// buntest/runtime.test.ts

// A starter Bun-native test suite. Run from the repo root with:  bun test
// (bunfig.toml's `root = "buntest"` scopes discovery here.)

// This validates the things that actually matter when deciding whether Matterbridge can run on Bun:
//   1. that we're really on the Bun runtime,
//   2. that node:* builtins resolve and behave,
//   3. that node:dgram can bind + send + receive (the mDNS/Matter risk area),
//   4. that node:worker_threads can spawn and round-trip (the worker manager risk area).

import { test, expect, describe } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isMainThread, Worker, MessageChannel } from 'node:worker_threads';

describe('runtime', () => {
  test('is the Bun runtime, not Node', () => {
    // process.versions.bun is set only under Bun (see earlier: the reliable check).
    expect(process.versions.bun).toBeDefined();
    expect(typeof Bun).toBe('object');
  });
});

describe('node: builtins resolve and execute', () => {
  test('path / os / crypto behave', () => {
    expect(path.join('a', 'b')).toMatch(/^a[\\/]b$/);
    expect(typeof tmpdir()).toBe('string');
    expect(randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('node:dgram (Matter / mDNS transport)', () => {
  // Loopback unicast round-trip: reliable everywhere, including this NAT'd container.
  // It proves bind + send + receive — the core of what the Matter stack needs.
  test('binds and round-trips a datagram over loopback', async () => {
    const socket = createSocket('udp4');

    const received = new Promise<string>((resolve, reject) => {
      socket.on('message', (buf) => resolve(buf.toString()));
      socket.on('error', reject);
    });

    await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));

    const { address, port } = socket.address();
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);

    socket.send('matter-test', port, address);
    expect(await received).toBe('matter-test');

    socket.close();
  });

  // NOTE: this does NOT cover multicast group membership (addMembership), which is
  // what real mDNS discovery uses. That needs a multicast-capable interface and will
  // not work behind Docker's default NAT or WSL's default networking. To exercise it,
  // run the container with `--network host` on a Linux host and add a test that calls
  // socket.addMembership("224.0.0.251") then sends to that group. Treat a failure there
  // as a networking/environment result, not necessarily a Bun verdict.
});

describe('node:worker_threads (Matterbridge worker manager)', () => {
  test('MessageChannel ports round-trip a message', async () => {
    const { port1, port2 } = new MessageChannel();
    const got = new Promise((resolve) => port2.once('message', resolve));
    port1.postMessage({ hello: 'thread' });
    expect(await got).toEqual({ hello: 'thread' });
    port1.close();
    port2.close();
  });

  // BUN QUIRK (verified on Bun 1.3.14): a worker does NOT exit when it calls
  // parentPort.close() the way Node does — the thread stays alive and 'exit' never
  // fires, so awaiting 'exit' would hang. The two reliable ways to end a worker under
  // Bun are:
  //   - process.exit(code) inside the worker -> 'exit' fires with that exact code
  //   - worker.terminate() from the parent    -> 'exit' fires with code 0 (Node gives 1)
  // The exit.worker.ts used here self-exits with process.exit(0) for that reason.
  test('spawns a real Worker from a .ts file and gets a reply', async () => {
    expect(isMainThread).toBe(true);

    // Bun loads the .ts worker directly — no precompiled .js needed.
    const worker = new Worker(new URL('./exit.worker.ts', import.meta.url));

    const online = new Promise<void>((resolve, reject) => {
      worker.once('online', resolve);
      worker.once('error', reject);
    });

    // Register before sending: the worker calls process.exit(0) right after replying.
    const exited = new Promise<number>((resolve) => worker.once('exit', resolve));

    const reply = await new Promise<string>((resolve, reject) => {
      worker.once('message', (m) => resolve(String(m)));
      worker.once('error', reject);
      worker.postMessage('ping');
    });

    expect(await online).toBeUndefined();
    expect(reply).toBe('echo:ping');

    // The worker self-exits with process.exit(0), so 'exit' fires with code 0.
    expect(await exited).toBe(0);
  });

  // Documents the Bun quirk above: a worker that only calls parentPort.close() keeps
  // running, so 'exit' never fires on its own. We prove the worker still replies, then
  // confirm no 'exit' arrives within a grace window, and finally use terminate() to end it.
  test('parentPort.close() does NOT exit the worker under Bun', async () => {
    const worker = new Worker(new URL('./close.worker.ts', import.meta.url));

    let exited = false;
    worker.once('exit', () => {
      exited = true;
    });

    const reply = await new Promise<string>((resolve, reject) => {
      worker.once('message', (m) => resolve(String(m)));
      worker.once('error', reject);
      worker.postMessage('ping');
    });
    expect(reply).toBe('echo:ping');

    // Grace window: in Node the worker would have exited by now; in Bun it stays alive.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(exited).toBe(false);

    // terminate() is what actually ends the thread under Bun.
    const code = await worker.terminate();
    expect(typeof code).toBe('number');
  });
});
