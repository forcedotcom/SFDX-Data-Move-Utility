/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Static metadata for an SFDMU command.
 */
export type SfdmuStaticsType = {
  /**
   * Plugin metadata values.
   */
  plugin: {
    /**
     * Plugin root directory.
     */
    root: string;

    /**
     * Plugin name.
     */
    name: string;
  };

  /**
   * Command name.
   */
  name: string;
};
