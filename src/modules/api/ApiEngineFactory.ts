/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { API_ENGINE } from '../common/Enumerations.js';
import {
  DEFAULT_BULK_API_THRESHOLD_RECORDS,
  DEFAULT_BULK_API_VERSION,
  NOT_SUPPORTED_OBJECTS_IN_BULK_API,
} from '../constants/Constants.js';
import OrgConnectionAdapter from '../org/OrgConnectionAdapter.js';
import BulkApiV1Engine from './engines/BulkApiV1Engine.js';
import BulkApiV2Engine from './engines/BulkApiV2Engine.js';
import RestApiEngine from './engines/RestApiEngine.js';
import type { ApiEngineInitOptionsType } from './models/ApiEngineInitOptionsType.js';
import type { ApiEngineSelectionOptionsType } from './models/ApiEngineSelectionOptionsType.js';
import type { IApiEngine } from './models/IApiEngine.js';

/**
 * Factory for creating API engines based on runtime options.
 */
export default class ApiEngineFactory {
  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates an API engine using a resolved connection.
   *
   * @param options - Selection options.
   * @returns Engine instance.
   */
  public static createEngine(options: ApiEngineSelectionOptionsType): IApiEngine {
    const engineType = ApiEngineFactory.resolveEngineType(options);
    const initOptions = ApiEngineFactory._buildInitOptions(options, engineType);

    switch (engineType) {
      case API_ENGINE.BULK_API_V2:
        return new BulkApiV2Engine(initOptions);
      case API_ENGINE.BULK_API_V1:
        return new BulkApiV1Engine(initOptions);
      case API_ENGINE.REST_API:
      default:
        return new RestApiEngine(initOptions);
    }
  }

  /**
   * Creates an API engine using a connection resolved from an alias or username.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @param options - Engine selection options without connection.
   * @param apiVersion - Optional API version override.
   * @returns Engine instance.
   */
  public static async createEngineFromAliasAsync(
    aliasOrUsername: string,
    options: Omit<ApiEngineSelectionOptionsType, 'connection'>,
    apiVersion?: string
  ): Promise<IApiEngine> {
    const connection = await OrgConnectionAdapter.getConnectionForAliasAsync(aliasOrUsername, apiVersion);
    return ApiEngineFactory.createEngine({ ...options, connection });
  }

  /**
   * Resolves the engine type based on the selection options.
   *
   * @param options - Selection options.
   * @returns Engine type.
   */
  public static resolveEngineType(options: ApiEngineSelectionOptionsType): API_ENGINE {
    const bulkThreshold = options.bulkThreshold ?? DEFAULT_BULK_API_THRESHOLD_RECORDS;
    const alwaysUseRest = options.alwaysUseRest ?? false;
    const forceBulk = options.forceBulk ?? false;
    const amountToProcess = options.amountToProcess ?? 0;
    const bulkApiVersion = Number(options.bulkApiVersion ?? DEFAULT_BULK_API_VERSION) || 1;
    const sObjectName = options.sObjectName;
    const bulkSupported = !NOT_SUPPORTED_OBJECTS_IN_BULK_API.includes(sObjectName);

    if (forceBulk && bulkSupported) {
      if (bulkApiVersion >= 2) {
        return API_ENGINE.BULK_API_V2;
      }
      return API_ENGINE.BULK_API_V1;
    }

    const bulkAllowed = amountToProcess > bulkThreshold && !alwaysUseRest && bulkSupported;

    if (!bulkAllowed) {
      return API_ENGINE.REST_API;
    }

    if (bulkApiVersion >= 2) {
      return API_ENGINE.BULK_API_V2;
    }

    return API_ENGINE.BULK_API_V1;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Builds initialization options for the engine instance.
   *
   * @param options - Selection options.
   * @param engineType - Engine type to instantiate.
   * @returns Initialization options.
   */
  private static _buildInitOptions(
    options: ApiEngineSelectionOptionsType,
    engineType: API_ENGINE
  ): ApiEngineInitOptionsType {
    const engineName = ApiEngineFactory._resolveEngineName(engineType);
    return {
      connection: options.connection,
      sObjectName: options.sObjectName,
      engineType,
      engineName,
    };
  }

  /**
   * Resolves engine name by type.
   *
   * @param engineType - Engine type.
   * @returns Engine name.
   */
  private static _resolveEngineName(engineType: API_ENGINE): string {
    switch (engineType) {
      case API_ENGINE.BULK_API_V2:
        return BulkApiV2Engine.ENGINE_NAME;
      case API_ENGINE.BULK_API_V1:
        return BulkApiV1Engine.ENGINE_NAME;
      case API_ENGINE.REST_API:
      default:
        return RestApiEngine.ENGINE_NAME;
    }
  }
}
