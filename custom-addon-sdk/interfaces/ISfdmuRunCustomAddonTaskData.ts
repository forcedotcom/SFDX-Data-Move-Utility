/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DATA_MEDIA_TYPE } from './common.js';

/**
 * Data associated with a migration task (source or target side).
 *
 * @export
 * @interface ISfdmuRunCustomAddonTaskData
 */
export default interface ISfdmuRunCustomAddonTaskData {
  /**
   * Data media type.
   * <br/>
   * For example, source data can use {@link DATA_MEDIA_TYPE.Org}
   * while target data uses {@link DATA_MEDIA_TYPE.File}.
   *
   * @type {DATA_MEDIA_TYPE}
   * @memberof ISfdmuRunCustomAddonTaskData
   */
  readonly mediaType: DATA_MEDIA_TYPE;

  /**
   * Returns true if this object contains data retrieved from source,
   * and false if it contains data retrieved from target.
   *
   * @type {boolean}
   * @memberof ISfdmuRunCustomAddonTaskData
   */
  readonly isSource: boolean;

  /**
   * The mapping between the record Id to the record object.
   *
   * @type {Map<string, Record<string, unknown>>}
   * @memberof ISfdmuRunCustomAddonTaskData
   */
  readonly idRecordsMap: Map<string, Record<string, unknown>>;

  /**
   * Mapping between externalId value and record Id value.
   *
   * @type {Map<string, string>}
   * @memberof ISfdmuRunCustomAddonTaskData
   */
  readonly extIdRecordsMap: Map<string, string>;

  /**
   * Array of records (source or target).
   *
   * @type {Array<Record<string, unknown>>}
   * @memberof ISfdmuRunCustomAddonTaskData
   */
  readonly records: Array<Record<string, unknown>>;
}
