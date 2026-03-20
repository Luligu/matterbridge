import { beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_STORAGE_PREFIX, LOCAL_STORAGE_TABLE_KEYS, MbfLsk, resetLocalStorage } from '../src/utils/localStorage';

describe('localStorage utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports storage keys using the configured prefix', () => {
    expect(LOCAL_STORAGE_PREFIX).toBe('');

    expect(MbfLsk).toEqual({
      enableMobile: 'enableMobile',
      devicesFilterPlugins: 'devicesFilterPlugins',
      devicesFilterDevices: 'devicesFilterDevices',
      devicesViewMode: 'devicesViewMode',
      frontendVersion: 'frontendVersion',
      matterbridgeVersion: 'matterbridgeVersion',
      homePageMode: 'homePageMode',
      logFilterLevel: 'logFilterLevel',
      logFilterSearch: 'logFilterSearch',
      logAutoScroll: 'logAutoScroll',
      logLength: 'logLength',
      frontendTheme: 'frontendTheme',
      homePagePlugins: 'homePagePlugins',
      virtualMode: 'virtualMode',
      installAutoExit: 'installAutoExit',
      searchPluginsTotal: 'searchPluginsTotal',
      searchPluginsMeta: 'searchPluginsMeta',
      searchPluginsVersions: 'searchPluginsVersions',
    });

    expect(LOCAL_STORAGE_TABLE_KEYS).toEqual({
      Devices_table_order_by: 'Devices_table_order_by',
      Devices_table_order: 'Devices_table_order',
      Devices_column_visibility: 'Devices_column_visibility',
      Plugins_table_order_by: 'Plugins_table_order_by',
      Plugins_table_order: 'Plugins_table_order',
      Plugins_column_visibility: 'Plugins_column_visibility',
      'Registered devices_table_order_by': 'Registered devices_table_order_by',
      'Registered devices_table_order': 'Registered devices_table_order',
      'Registered devices_column_visibility': 'Registered devices_column_visibility',
      Clusters_table_order_by: 'Clusters_table_order_by',
      Clusters_table_order: 'Clusters_table_order',
      Clusters_column_visibility: 'Clusters_column_visibility',
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
