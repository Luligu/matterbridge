/**
 * Supported application directories.
 */
export type AppDir = 'config' | 'data' | 'logs' | 'cache';
/**
 * Returns the platform-correct directory for application files
 * and ensures the directory exists.
 *
 * @param {string} appName Application name.
 * @param { AppDir } dir Requested directory.
 *
 * @returns {string} The resolved directory path.
 */
export declare function getPath(appName: string, dir: AppDir): string;
//# sourceMappingURL=getPath.d.ts.map