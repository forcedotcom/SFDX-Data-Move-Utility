/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import type { API_ENGINE } from '../../common/Enumerations.js';

/**
 * Initialization options for API engine instances.
 */
export type ApiEngineInitOptionsType = {
  /**
   * Jsforce connection instance.
   */
  connection: Connection;

  /**
   * Source object API name.
   */
  sObjectName: string;

  /**
   * Engine type identifier.
   */
  engineType: API_ENGINE;

  /**
   * Human readable engine name.
   */
  engineName: string;
};
