/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonPluginInfo from './ISfdmuRunCustomAddonPluginInfo.js';

/**
 * Information about the currently running SFDMU command.
 * Contains CLI flags used to run the SFDMU job and common plugin information.
 */
export default interface ISfdmuRunCustomAddonCommandRunInfo {
  /**
   * The --sourceusername command flag.
   */
  sourceUsername: string;

  /**
   * The --targetusername command flag.
   */
  targetUsername: string;

  /**
   * The --apiversion command flag.
   */
  apiVersion: string;

  /**
   * Directory location where the plugin was started.
   */
  readonly basePath: string;

  /**
   * Information about the plugin and framework.
   */
  readonly pinfo: ISfdmuRunCustomAddonPluginInfo;
}
