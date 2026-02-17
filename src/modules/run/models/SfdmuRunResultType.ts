/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FinishMessageType } from '../../logging/models/FinishMessageType.js';
import type { SfdmuRunFlagsType } from './SfdmuRunFlagsType.js';

/**
 * Result payload for the sfdmu run command.
 */
export type SfdmuRunResultType = FinishMessageType & {
  /**
   * Normalized flags for the run command.
   */
  flags: SfdmuRunFlagsType;

  /**
   * Per object-set order info for JSON output.
   */
  objectOrders?: Array<{
    objectSetIndex: number;
    queryOrder: string[];
    deleteOrder: string[];
    updateOrder: string[];
  }>;
};
