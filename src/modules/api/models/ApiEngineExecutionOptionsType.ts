/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApiEngineRunOptionsType } from './ApiEngineRunOptionsType.js';
import type { IApiEngine } from './IApiEngine.js';

/**
 * Execution options for API engine runs.
 */
export type ApiEngineExecutionOptionsType = ApiEngineRunOptionsType & {
  /**
   * Selected engine instance.
   */
  engine: IApiEngine;
};
