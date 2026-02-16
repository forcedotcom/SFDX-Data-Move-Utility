/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Re-exports for dependencies that ship native ESM builds.
 */
export { parse as parseCsv } from 'csv-parse';
export { deepCloneAsync, deepCloneSync } from './DeepClone.js';
export { glob } from 'glob';
export {
  all as throttleAll,
  raw as throttleRaw,
  sync as throttleSync,
} from 'promise-parallel-throttle/dist/lib/throttle.mjs';
