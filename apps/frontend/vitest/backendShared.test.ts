import { describe, expect, it } from 'vitest';

import { isApiResponse, MATTER_STORAGE_DIR, NODE_STORAGE_DIR } from '../src/utils/backendShared';

describe('backendShared', () => {
  it('exports the frontend runtime constants', () => {
    expect(NODE_STORAGE_DIR).toBe('storage');
    expect(MATTER_STORAGE_DIR).toBe('matterstorage');
  });

  it('returns true only for messages from Matterbridge to Frontend with a non-zero id', () => {
    expect(
      isApiResponse({
        id: 1,
        src: 'Matterbridge',
        dst: 'Frontend',
      } as any)
    ).toBe(true);

    expect(
      isApiResponse({
        id: 0,
        src: 'Matterbridge',
        dst: 'Frontend',
      } as any)
    ).toBe(false);

    expect(
      isApiResponse({
        id: 1,
        src: 'Plugin',
        dst: 'Frontend',
      } as any)
    ).toBe(false);

    expect(
      isApiResponse({
        id: 1,
        src: 'Matterbridge',
        dst: 'Backend',
      } as any)
    ).toBe(false);
  });
});
