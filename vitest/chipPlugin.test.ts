/**
 * @file vitest/chipPlugin.test.ts
 * @description Verify CHIP plugin setup commands without Docker
 * @author Codex
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../scripts/run-chip-test.mjs', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');

/**
 * Run the CLI with an isolated filesystem and Docker command recorder.
 *
 * @param {string[]} args CLI arguments.
 * @param {string} name Configured plugin name.
 * @returns {object} Captured commands, errors and written config.
 */
function runCli(args: string[], name = 'matterbridge-example'): { commands: string[][]; errors: string[]; writes: string[]; copiedPaths: string[] } {
  const commands: string[][] = [];
  const errors: string[] = [];
  const writes: string[] = [];
  const copiedPaths: string[] = [];
  runInNewContext(source, {
    process: { argv: ['node', 'script', ...args], cwd: () => '/plugin', exitCode: 0 },
    console: { log: () => {}, warn: () => {}, error: (message: string) => errors.push(message) },
    resolve: (...parts: string[]) => parts.join('/'),
    join: (...parts: string[]) => parts.join('/'),
    tmpdir: () => '/tmp',
    mkdtempSync: () => '/tmp/config',
    rmSync: () => {},
    cpSync: (_source: string, _target: string, options: { filter: (path: string) => boolean; verbatimSymlinks: boolean }) => {
      expect(options.verbatimSymlinks).toBe(true);
      for (const path of ['/plugin/dist/module.js', '/plugin/node_modules/matterbridge', '/plugin/node_modules/node-ansi-logger']) {
        if (options.filter(path)) copiedPaths.push(path);
      }
    },
    existsSync: () => false,
    readdirSync: () => [],
    readFileSync: (path: string) => JSON.stringify(path.endsWith('package.json') ? { name: 'matterbridge-example' } : { config: { name }, tests: [] }),
    writeFileSync: (_path: string, data: string) => writes.push(data),
    spawnSync: (command: string, parameters: string[]) => {
      commands.push([command, ...parameters]);
      return { status: 0, stdout: 'Server node for Matterbridge is online\nConfigured plugin matterbridge-example type DynamicPlatform', stderr: '' };
    },
  });
  return { commands, errors, writes, copiedPaths };
}

describe('CHIP plugin startup', () => {
  it('should copy cwd and config, register and restart with a local image', () => {
    const result = runCli(['--start', '--local', '--plugin']);
    expect(result.errors).toEqual([]);
    expect(result.commands).toContainEqual(['docker', 'cp', '/tmp/config/plugin/.', 'chip-test:/root/Matterbridge/matterbridge-example']);
    expect(result.commands).toContainEqual(['docker', 'cp', '/tmp/config/matterbridge-example.config.json', 'chip-test:/root/.matterbridge/matterbridge-example.config.json']);
    expect(result.commands).toContainEqual(['docker', 'exec', 'chip-test', 'matterbridge', '--add', 'matterbridge-example']);
    expect(result.commands.at(-2)).toEqual(['docker', 'restart', 'chip-test']);
    expect(result.commands.find((command) => command[1] === 'run')).toContain('MATTERBRIDGE_DEMO_DEVICES=');
    expect(result.commands.some((command) => command[1] === 'pull')).toBe(false);
    expect(JSON.parse(result.writes[0])).toEqual({ name: 'matterbridge-example' });
  });

  it('should exclude the local Matterbridge package while retaining other dependencies and built code', () => {
    const result = runCli(['--start', '--plugin']);
    expect(result.copiedPaths).toEqual(['/plugin/dist/module.js', '/plugin/node_modules/node-ansi-logger']);
  });

  it('should reject a mismatched plugin before changing the container', () => {
    const result = runCli(['--start', '--plugin'], 'another-plugin');
    expect(result.errors[0]).toContain('must match config.name');
    expect(result.commands).toEqual([]);
  });

  it('should require start for plugin setup', () => {
    const result = runCli(['--plugin']);
    expect(result.errors).toEqual(['--plugin requires --start']);
    expect(result.commands).toEqual([]);
  });

  it('should preserve demo startup without the plugin switch', () => {
    const result = runCli(['--start']);
    expect(result.errors).toEqual([]);
    expect(result.commands).toContainEqual(['docker', 'pull', 'luligu/matterbridge:chip-test']);
    expect(result.commands.find((command) => command[1] === 'run')).toContain('MATTERBRIDGE_DEMO_DEVICES=1');
    expect(result.writes).toEqual([]);
  });
});
