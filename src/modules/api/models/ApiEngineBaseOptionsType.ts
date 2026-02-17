/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApiEngineInitOptionsType } from './ApiEngineInitOptionsType.js';

/**
 * Initialization options supplied by callers (engine-specific values added internally).
 */
export type ApiEngineBaseOptionsType = Omit<ApiEngineInitOptionsType, 'engineName' | 'engineType'>;
