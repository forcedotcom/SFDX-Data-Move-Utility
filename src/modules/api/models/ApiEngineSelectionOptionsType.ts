/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';

/**
 * Options used to select the appropriate API engine.
 */
export type ApiEngineSelectionOptionsType = {
  /**
   * Jsforce connection instance.
   */
  connection: Connection;

  /**
   * Object API name for the current operation.
   */
  sObjectName: string;

  /**
   * Number of records to process.
   */
  amountToProcess: number;

  /**
   * Bulk API threshold override.
   */
  bulkThreshold?: number;

  /**
   * Force REST API regardless of thresholds.
   */
  alwaysUseRest?: boolean;

  /**
   * Force Bulk API regardless of thresholds.
   */
  forceBulk?: boolean;

  /**
   * Bulk API version string or number.
   */
  bulkApiVersion?: string | number;
};
