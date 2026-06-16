// vitest\createDirectory.test.ts

const NAME = 'CreateDirectory';

import fs from 'node:fs';
import path from 'node:path';

import { LogLevel } from 'node-ansi-logger';

import { createDirectory } from '../src/createDirectory.js';
import { HOMEDIR, log, loggerLogSpy, setupTest } from './vitestSetupTest.js';

// Setup the test environment
await setupTest(NAME, false);

await fs.promises.rmdir(path.join(HOMEDIR, 'newDir')).catch(() => {});

describe('createDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log a message if the directory already exists', async () => {
    await createDirectory(path.join('.', 'screenshots'), 'Screenshots', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Directory Screenshots already exists at path: ${path.join('.', 'screenshots')}`);
  });

  it('should create directory if it does not exist', async () => {
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Created Jest New Directory: ${path.join(HOMEDIR, 'newDir')}`);
    await fs.promises.rmdir(path.join(HOMEDIR, 'newDir')).catch(() => {});
  });

  it('should handle errors when creating directory', async () => {
    vi.spyOn(fs.promises, 'mkdir').mockRejectedValueOnce(new Error('Failed to create directory'));
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`Error creating dir Jest New Directory path ${path.join(HOMEDIR, 'newDir')}: Failed to create directory`),
    );
  });

  it('should handle errors when accessing directory', async () => {
    const errorMessage = 'Access denied';
    vi.spyOn(fs.promises, 'access').mockRejectedValueOnce(new Error(errorMessage));
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`Error accessing dir Jest New Directory path ${path.join(HOMEDIR, 'newDir')}: ${errorMessage}`),
    );
  });
});
