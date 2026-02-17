/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApiEngineExecutionOptionsType } from './models/ApiEngineExecutionOptionsType.js';
import type { ApiEngineRunOptionsType } from './models/ApiEngineRunOptionsType.js';
import type { IApiEngine } from './models/IApiEngine.js';

/**
 * Executes CRUD operations using a configured engine.
 */
export default class ApiEngineExecutor {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * API engine instance.
   */
  private readonly _engine: IApiEngine;

  /**
   * Engine execution options.
   */
  private readonly _runOptions: ApiEngineRunOptionsType;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates an API engine executor.
   *
   * @param options - Execution options.
   */
  public constructor(options: ApiEngineExecutionOptionsType) {
    const { engine, ...runOptions } = options;
    this._engine = engine;
    this._runOptions = runOptions;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes CRUD operations using the configured engine.
   *
   * @returns Processed records.
   */
  public async executeCrudAsync(): Promise<Array<Record<string, unknown>>> {
    return this._engine.executeCrudAsync(this._runOptions);
  }
}
