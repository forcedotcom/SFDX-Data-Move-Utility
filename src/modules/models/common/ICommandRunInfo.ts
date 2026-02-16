/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { PluginInfoType } from './PluginInfoType.js';

/**
 * Command run metadata used during execution.
 */
export type ICommandRunInfo = {
  /**
   * API version override for the run.
   */
  apiVersion: string;

  /**
   * Source username or alias.
   */
  sourceUsername: string;

  /**
   * Target username or alias.
   */
  targetUsername: string;

  /**
   * Base working directory.
   */
  basePath: string;

  /**
   * Plugin metadata for the run.
   */
  pluginInfo: PluginInfoType;
};
