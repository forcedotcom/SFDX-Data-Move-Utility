/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ISfdmuAddonInfo } from './common.js';

/**
 * Contains information about the SFDMU plugin.
 */
export default interface ISfdmuRunCustomAddonPluginInfo {
  /**
   * Plugin name (for example `sfdmu`).
   */
  pluginName: string;

  /**
   * Executed command (for example `run`).
   */
  commandName: string;

  /**
   * Current version of the running plugin (for example `5.0.0`).
   */
  version: string;

  /**
   * Path to the directory where the SFDMU plugin is installed.
   */
  path: string;

  /**
   * Full CLI command string used to run the command
   * (for example `sfdx sfdmu:run --sourceusername my-source@mail.com --targetusername my-target@mail.com`).
   */
  commandString: string;

  /**
   * The array of CLI arguments
   *
   * @example
   * ```ts
   * ['--sourceusername', 'my-source@mail.com', '--targetusername', 'my-target@mail.com'];
   * ```
   */
  argv: string[];

  /**
   * Contains information about the current version of the Add-On API
   * related to the sfdmu:run command.
   *
   * @type {ISfdmuAddonInfo}
   * @memberof ISfdmuRunCustomAddonPluginInfo
   */
  runAddOnApiInfo: ISfdmuAddonInfo;
}
