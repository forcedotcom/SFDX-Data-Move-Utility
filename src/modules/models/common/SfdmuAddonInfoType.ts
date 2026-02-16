/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Describes add-on metadata stored in package.json.
 */
export type SfdmuAddonInfoType = {
  /**
   * Optional add-on name.
   */
  name?: string;

  /**
   * Optional add-on version.
   */
  version?: string;
};
