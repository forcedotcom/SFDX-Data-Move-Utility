/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfdmuStaticsType } from './SfdmuStaticsType.js';

/**
 * Command metadata exposed to utilities.
 */
export type SfdmuCommandType = {
  /**
   * Command static values.
   */
  statics: SfdmuStaticsType;

  /**
   * Command argv passed to the CLI.
   */
  argv: string[];
};
