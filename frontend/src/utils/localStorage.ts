export const LOCAL_STORAGE_PREFIX = '';

export const MbfLsk = {
  // App
  enableMobile: `${LOCAL_STORAGE_PREFIX}enableMobile`,
  // Devices page
  devicesFilter: `${LOCAL_STORAGE_PREFIX}devicesFilter`,
  devicesViewMode: `${LOCAL_STORAGE_PREFIX}devicesViewMode`,
  // Home page
  frontendVersion: `${LOCAL_STORAGE_PREFIX}frontendVersion`,
  matterbridgeVersion: `${LOCAL_STORAGE_PREFIX}matterbridgeVersion`,
  homePageMode: `${LOCAL_STORAGE_PREFIX}homePageMode`,
  // Logs page
  logFilterLevel: `${LOCAL_STORAGE_PREFIX}logFilterLevel`,
  logFilterSearch: `${LOCAL_STORAGE_PREFIX}logFilterSearch`,
  logAutoScroll: `${LOCAL_STORAGE_PREFIX}logAutoScroll`,
  logLength: `${LOCAL_STORAGE_PREFIX}logLength`,
  // Settings page
  frontendTheme: `${LOCAL_STORAGE_PREFIX}frontendTheme`,
  homePagePlugins: `${LOCAL_STORAGE_PREFIX}homePagePlugins`,
  virtualMode: `${LOCAL_STORAGE_PREFIX}virtualMode`,
  // Install package dialog
  installAutoExit: `${LOCAL_STORAGE_PREFIX}installAutoExit`,
};

export const LOCAL_STORAGE_TABLE_KEYS = {
  // MbfTable component
  'Devices_table_order_by': `${LOCAL_STORAGE_PREFIX}Devices_table_order_by`,
  'Devices_table_order': `${LOCAL_STORAGE_PREFIX}Devices_table_order`,
  'Devices_column_visibility': `${LOCAL_STORAGE_PREFIX}Devices_column_visibility`,
  'Plugins_table_order_by': `${LOCAL_STORAGE_PREFIX}Plugins_table_order_by`,
  'Plugins_table_order': `${LOCAL_STORAGE_PREFIX}Plugins_table_order`,
  'Plugins_column_visibility': `${LOCAL_STORAGE_PREFIX}Plugins_column_visibility`,
  'Registered devices_table_order_by': `${LOCAL_STORAGE_PREFIX}Registered devices_table_order_by`,
  'Registered devices_table_order': `${LOCAL_STORAGE_PREFIX}Registered devices_table_order`,
  'Registered devices_column_visibility': `${LOCAL_STORAGE_PREFIX}Registered devices_column_visibility`,
  'Clusters_table_order_by': `${LOCAL_STORAGE_PREFIX}Clusters_table_order_by`,
  'Clusters_table_order': `${LOCAL_STORAGE_PREFIX}Clusters_table_order`,
  'Clusters_column_visibility': `${LOCAL_STORAGE_PREFIX}Clusters_column_visibility`,
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
