import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiMatter } from '../src/utils/backendShared';

const fabricInformations = [{ fabricIndex: 1 }] as any;
const inactiveSessionInformations = [
  {
    fabric: undefined,
    isPeerActive: false,
    numberOfActiveSubscriptions: 1,
  },
] as any;
const activeSessionWithoutSubscriptions = [
  {
    fabric: { fabricIndex: 1 },
    isPeerActive: true,
    numberOfActiveSubscriptions: 0,
  },
] as any;
const activeSessionWithSubscriptions = [
  {
    fabric: { fabricIndex: 1 },
    isPeerActive: true,
    numberOfActiveSubscriptions: 2,
  },
] as any;

function createMatter(overrides: Partial<ApiMatter> = {}): ApiMatter {
  return {
    id: 'matter-1',
    online: true,
    commissioned: true,
    qrPairingCode: 'MT:TEST',
    manualPairingCode: '12345678901',
    fabricInformations: [],
    sessionInformations: [],
    ...overrides,
  } as ApiMatter;
}

async function loadGetQRColor(debug = false) {
  vi.resetModules();
  vi.doMock('../src/App', () => ({ debug }));
  return import('../src/utils/getQRColor');
}

describe('getQRColor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns red when matter is undefined', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(getQRColor(undefined)).toBe('red');
  });

  it('logs when debug is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { getQRColor } = await loadGetQRColor(true);

    expect(getQRColor(undefined)).toBe('red');
    expect(consoleSpy).toHaveBeenCalledWith('getQRColor (id: undefined) received matter:', 'undefined');
  });

  it('returns red when matter is offline', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(getQRColor(createMatter({ online: false }))).toBe('red');
  });

  it('returns red when pairing, fabric, and session information are all missing', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          qrPairingCode: '',
          manualPairingCode: '',
          fabricInformations: undefined,
          sessionInformations: undefined,
        })
      )
    ).toBe('red');
  });

  it('returns the primary color when not commissioned and both pairing codes are available', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          commissioned: false,
        })
      )
    ).toBe('var(--primary-color)');
  });

  it('returns the secondary color when commissioned with fabrics but no active peer sessions', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          fabricInformations,
          sessionInformations: inactiveSessionInformations,
        })
      )
    ).toBe('var(--secondary-color)');
  });

  it('returns the secondary color when commissioned with active sessions but no subscriptions', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          fabricInformations,
          sessionInformations: activeSessionWithoutSubscriptions,
        })
      )
    ).toBe('var(--secondary-color)');
  });

  it('returns the div text color when session information is undefined after early checks', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          manualPairingCode: '',
          fabricInformations,
          sessionInformations: undefined,
        })
      )
    ).toBe('var(--div-text-color)');
  });

  it('returns the div text color when commissioned with active sessions and subscriptions', async () => {
    const { getQRColor } = await loadGetQRColor();
    expect(
      getQRColor(
        createMatter({
          fabricInformations,
          sessionInformations: activeSessionWithSubscriptions,
        })
      )
    ).toBe('var(--div-text-color)');
  });
});
