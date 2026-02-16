/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfdmuAddonInfoType } from './SfdmuAddonInfoType.js';

/**
 * Package.json shape required by the plugin.
 */
export type PluginPackageJsonType = {
  /**
   * Plugin version.
   */
  version: string;

  /**
   * Optional add-on metadata.
   */
  addons?: {
    /**
     * Optional run add-on info.
     */
    run?: SfdmuAddonInfoType;
  };
};
