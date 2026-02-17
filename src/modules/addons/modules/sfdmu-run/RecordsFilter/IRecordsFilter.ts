/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Arguments passed to a records filter add-on.
 */
export type IRecordsFilterArgs = {
  /**
   * Filter type identifier.
   */
  filterType: string;

  /**
   * Filter settings payload.
   */
  settings: IRecordsFilterSetting;
};

/**
 * Settings payload for a records filter add-on.
 */
export type IRecordsFilterSetting = {
  /**
   * Extra settings for the filter.
   */
  [key: string]: unknown;
};

/**
 * Records filter contract.
 */
export type IRecordsFilter = {
  /**
   * True when the filter is ready to be executed.
   */
  isInitialized: boolean;

  /**
   * Filters the provided records.
   *
   * @param records - Records to filter.
   * @returns Filtered records.
   */
  filterRecords(records: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>>;
};
