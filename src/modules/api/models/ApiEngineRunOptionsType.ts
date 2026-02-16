/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OPERATION } from '../../common/Enumerations.js';
import type { LoggerType } from '../../logging/LoggerType.js';
import type Script from '../../models/script/Script.js';
import type ScriptObject from '../../models/script/ScriptObject.js';

/**
 * Execution options passed to API engines.
 */
export type ApiEngineRunOptionsType = {
  /**
   * CRUD operation to execute.
   */
  operation: OPERATION;

  /**
   * Records to process.
   */
  records: Array<Record<string, unknown>>;

  /**
   * Update record Ids from API results.
   */
  updateRecordId: boolean;

  /**
   * Logger instance.
   */
  logger: LoggerType;

  /**
   * Script configuration.
   */
  script: Script;

  /**
   * Optional script object configuration.
   */
  scriptObject?: ScriptObject;

  /**
   * Indicates whether current DML execution is the final retry attempt.
   * When false, engines must avoid emitting warning-level "completed with issues" logs.
   */
  isFinalDmlAttempt?: boolean;
};
