// src\esm-fs-unstable-mock.ts

// ESM unstable mock of 'node:fs'

// console.log('Loaded esm-fs-unstable-mock.ts.', process.cwd());

import { existsSync } from 'node:fs';

/**
 * Function to check if a file named 'not_a_file' exists.
 *
 * @returns {boolean} - Returns true if 'not_a_file' exists, false otherwise.
 */
export function not_a_file(): boolean {
  const not_a_file_exists = existsSync('not_a_file');
  // console.log(`not_a_file exist ${not_a_file_exists}`);
  return not_a_file_exists;
}
