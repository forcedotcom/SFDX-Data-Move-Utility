/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import type { API_ENGINE } from '../../common/Enumerations.js';
import type { ApiEngineRunOptionsType } from './ApiEngineRunOptionsType.js';

/**
 * Contract for API engine implementations.
 */
export type IApiEngine = {
  /**
   * Returns the engine name.
   *
   * @returns Engine name.
   */
  getEngineName(): string;

  /**
   * Returns the engine type.
   *
   * @returns Engine type.
   */
  getEngineType(): API_ENGINE;

  /**
   * Returns true when the engine uses REST API.
   *
   * @returns True for REST API engines.
   */
  getIsRestApiEngine(): boolean;

  /**
   * Returns the connection instance.
   *
   * @returns Connection instance.
   */
  getConnection(): Connection;

  /**
   * Returns the target object API name.
   *
   * @returns Object API name.
   */
  getSObjectName(): string;

  /**
   * Executes CRUD operations for the given options.
   *
   * @param options - Execution options.
   * @returns Processed records.
   */
  executeCrudAsync(options: ApiEngineRunOptionsType): Promise<Array<Record<string, unknown>>>;
};
