/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfdmuAddonInfoType } from './SfdmuAddonInfoType.js';

/**
 * Describes plugin metadata for runtime logging and reporting.
 */
export type PluginInfoType = {
  /**
   * Command name.
   */
  commandName: string;

  /**
   * Plugin name.
   */
  pluginName: string;

  /**
   * Plugin version.
   */
  version: string;

  /**
   * Plugin root path.
   */
  path: string;

  /**
   * Add-on metadata stored in package.json.
   */
  runAddOnApiInfo?: SfdmuAddonInfoType;

  /**
   * Full command string used to run the CLI.
   */
  commandString: string;

  /**
   * Raw argv values.
   */
  argv: string[];
};
