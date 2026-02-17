/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonSFieldDescribe from './ISfdmuRunCustomAddonSFieldDescribe.js';

/**
 * Contains information about records processed within the current update step.
 *
 * @export
 * @interface ISfdmuRunCustomAddonProcessedData
 */
export default interface ISfdmuRunCustomAddonProcessedData {
  /**
   * List of API names of Salesforce object fields that are about to be updated in target.
   *
   * @type {Array<string>}
   * @memberof ISfdmuRunCustomAddonProcessedData
   */
  readonly fieldNames: string[];

  /**
   * Records to be updated in target.
   *
   * @type {Array<Record<string, unknown>>}
   * @memberof ISfdmuRunCustomAddonProcessedData
   */
  recordsToUpdate: Array<Record<string, unknown>>;

  /**
   * Records to be inserted in target.
   *
   * @type {Array<Record<string, unknown>>}
   * @memberof ISfdmuRunCustomAddonProcessedData
   */
  recordsToInsert: Array<Record<string, unknown>>;

  /**
   * Descriptions of Salesforce object fields that are about to be updated in target.
   * The {@link ISfdmuRunCustomAddonProcessedData.fieldNames} property contains API names of the same fields.
   *
   * @type {Array<ISfdmuRunCustomAddonSFieldDescribe>}
   * @memberof ISfdmuRunCustomAddonProcessedData
   */
  fields: ISfdmuRunCustomAddonSFieldDescribe[];
}
