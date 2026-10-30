export const LOCAL_STORAGE_PREFIX = 'mbf-';

export const MbfLsk = {
  // App
  'enable-mobile': `${LOCAL_STORAGE_PREFIX}enable-mobile`,
  // Devices page
  'devices-filter-plugins': `${LOCAL_STORAGE_PREFIX}devices-filter-plugins`,
  'devices-filter-devices': `${LOCAL_STORAGE_PREFIX}devices-filter-devices`,
  'devices-view-mode': `${LOCAL_STORAGE_PREFIX}devices-view-mode`,
  'devices-cluster-view-mode': `${LOCAL_STORAGE_PREFIX}devices-cluster-view-mode`,
  // Home page
  'frontend-version': `${LOCAL_STORAGE_PREFIX}frontend-version`,
  'matterbridge-version': `${LOCAL_STORAGE_PREFIX}matterbridge-version`,
  'home-page-mode': `${LOCAL_STORAGE_PREFIX}home-page-mode`,
  // Logs page
  'log-filter-level': `${LOCAL_STORAGE_PREFIX}log-filter-level`,
  'log-filter-search': `${LOCAL_STORAGE_PREFIX}log-filter-search`,
  'log-auto-scroll': `${LOCAL_STORAGE_PREFIX}log-auto-scroll`,
  'log-length': `${LOCAL_STORAGE_PREFIX}log-length`,
  // Settings page
  'frontend-theme': `${LOCAL_STORAGE_PREFIX}frontend-theme`,
  'home-page-plugins': `${LOCAL_STORAGE_PREFIX}home-page-plugins`,
  'virtual-mode': `${LOCAL_STORAGE_PREFIX}virtual-mode`,
  // Install package dialog
  'install-auto-exit': `${LOCAL_STORAGE_PREFIX}install-auto-exit`,
  // Search plugins total cache
  'search-plugins-total': `${LOCAL_STORAGE_PREFIX}search-plugins-total`,
  // Search plugins metadata cache (homepage/help/changelog)
  'search-plugins-meta': `${LOCAL_STORAGE_PREFIX}search-plugins-meta`,
  // Search plugins versions cache
  'search-plugins-versions': `${LOCAL_STORAGE_PREFIX}search-plugins-versions`,
  // Search plugins list cache (last successful npm search)
  'search-plugins-search': `${LOCAL_STORAGE_PREFIX}search-plugins-search`,
};

export const LOCAL_STORAGE_TABLE_KEYS = {
  // MbfTable component
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
};

/**
 * Resets all localStorage items defined in MbfLsk and LOCAL_STORAGE_TABLE_KEYS.
 */
export function resetLocalStorage(): void {
  Object.values(MbfLsk).forEach((key) => {
    localStorage.removeItem(key);
  });
  Object.values(LOCAL_STORAGE_TABLE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}
