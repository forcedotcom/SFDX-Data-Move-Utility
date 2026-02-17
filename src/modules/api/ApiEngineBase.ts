/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import { API_ENGINE } from '../common/Enumerations.js';
import type { ApiEngineInitOptionsType } from './models/ApiEngineInitOptionsType.js';

/**
 * Base class for API engine implementations.
 */
export default class ApiEngineBase {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Connection instance used by the engine.
   */
  private _connection: Connection;

  /**
   * Object API name for the current operation.
   */
  private _sObjectName: string;

  /**
   * Engine type identifier.
   */
  private _engineType: API_ENGINE;

  /**
   * Human readable engine name.
   */
  private _engineName: string;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new API engine instance.
   *
   * @param options - Initialization options.
   */
  public constructor(options: ApiEngineInitOptionsType) {
    this._connection = options.connection;
    this._sObjectName = options.sObjectName;
    this._engineType = options.engineType;
    this._engineName = options.engineName;
  }

  // ------------------------------------------------------//
  // ------------------- GETTERS & SETTERS --------------- //
  // ------------------------------------------------------//

  /**
   * Returns the engine name.
   *
   * @returns Engine name.
   */
  public getEngineName(): string {
    return this._engineName;
  }

  /**
   * Returns the engine type.
   *
   * @returns Engine type.
   */
  public getEngineType(): API_ENGINE {
    return this._engineType;
  }

  /**
   * Returns true when the engine uses REST API.
   *
   * @returns True for REST API engines.
   */
  public getIsRestApiEngine(): boolean {
    return this._engineType === API_ENGINE.REST_API;
  }

  /**
   * Returns the connection instance.
   *
   * @returns Connection instance.
   */
  public getConnection(): Connection {
    return this._connection;
  }

  /**
   * Returns the target object API name.
   *
   * @returns Object API name.
   */
  public getSObjectName(): string {
    return this._sObjectName;
  }
}
