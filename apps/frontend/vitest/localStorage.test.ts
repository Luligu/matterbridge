import { beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_STORAGE_PREFIX, LOCAL_STORAGE_TABLE_KEYS, MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

describe('localStorage utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports storage keys using the configured prefix', () => {
    expect(LOCAL_STORAGE_PREFIX).toBe('mbf-');

    expect(MbfLsk).toEqual({
      'enable-mobile': `${LOCAL_STORAGE_PREFIX}enable-mobile`,
      'devices-filter-plugins': `${LOCAL_STORAGE_PREFIX}devices-filter-plugins`,
      'devices-filter-devices': `${LOCAL_STORAGE_PREFIX}devices-filter-devices`,
      'devices-view-mode': `${LOCAL_STORAGE_PREFIX}devices-view-mode`,
      'devices-cluster-view-mode': `${LOCAL_STORAGE_PREFIX}devices-cluster-view-mode`,
      'frontend-version': `${LOCAL_STORAGE_PREFIX}frontend-version`,
      'matterbridge-version': `${LOCAL_STORAGE_PREFIX}matterbridge-version`,
      'home-page-mode': `${LOCAL_STORAGE_PREFIX}home-page-mode`,
      'log-filter-level': `${LOCAL_STORAGE_PREFIX}log-filter-level`,
      'log-filter-search': `${LOCAL_STORAGE_PREFIX}log-filter-search`,
      'log-auto-scroll': `${LOCAL_STORAGE_PREFIX}log-auto-scroll`,
      'log-length': `${LOCAL_STORAGE_PREFIX}log-length`,
      'frontend-theme': `${LOCAL_STORAGE_PREFIX}frontend-theme`,
      'home-page-plugins': `${LOCAL_STORAGE_PREFIX}home-page-plugins`,
      'virtual-mode': `${LOCAL_STORAGE_PREFIX}virtual-mode`,
      'install-auto-exit': `${LOCAL_STORAGE_PREFIX}install-auto-exit`,
      'search-plugins-total': `${LOCAL_STORAGE_PREFIX}search-plugins-total`,
      'search-plugins-meta': `${LOCAL_STORAGE_PREFIX}search-plugins-meta`,
      'search-plugins-versions': `${LOCAL_STORAGE_PREFIX}search-plugins-versions`,
      'search-plugins-search': `${LOCAL_STORAGE_PREFIX}search-plugins-search`,
    });

    expect(LOCAL_STORAGE_TABLE_KEYS).toEqual({
      'devices-table-order-by': `${LOCAL_STORAGE_PREFIX}devices-table-order-by`,
      'devices-table-order': `${LOCAL_STORAGE_PREFIX}devices-table-order`,
      'devices-column-visibility': `${LOCAL_STORAGE_PREFIX}devices-column-visibility`,
      'plugins-table-order-by': `${LOCAL_STORAGE_PREFIX}plugins-table-order-by`,
      'plugins-table-order': `${LOCAL_STORAGE_PREFIX}plugins-table-order`,
      'plugins-column-visibility': `${LOCAL_STORAGE_PREFIX}plugins-column-visibility`,
      'search-plugins-table-order-by': `${LOCAL_STORAGE_PREFIX}search-plugins-table-order-by`,
      'search-plugins-table-order': `${LOCAL_STORAGE_PREFIX}search-plugins-table-order`,
      'search-plugins-column-visibility': `${LOCAL_STORAGE_PREFIX}search-plugins-column-visibility`,
      'registered-devices-table-order-by': `${LOCAL_STORAGE_PREFIX}registered-devices-table-order-by`,
      'registered-devices-table-order': `${LOCAL_STORAGE_PREFIX}registered-devices-table-order`,
      'registered-devices-column-visibility': `${LOCAL_STORAGE_PREFIX}registered-devices-column-visibility`,
      'clusters-table-order-by': `${LOCAL_STORAGE_PREFIX}clusters-table-order-by`,
      'clusters-table-order': `${LOCAL_STORAGE_PREFIX}clusters-table-order`,
      'clusters-column-visibility': `${LOCAL_STORAGE_PREFIX}clusters-column-visibility`,
    });
  });

  it('removes only defined localStorage keys', () => {
    const managedKeys = [...Object.values(MbfLsk), ...Object.values(LOCAL_STORAGE_TABLE_KEYS)];

    managedKeys.forEach((key, index) => {
      localStorage.setItem(key, `value-${index}`);
    });
    localStorage.setItem('unmanaged-key', 'keep-me');

    resetLocalStorage();

    managedKeys.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
    expect(localStorage.getItem('unmanaged-key')).toBe('keep-me');
  });
});
