/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Preflight eligibility flags for a migration job task.
 */
export type TaskPreflightEligibilityType = {
  /**
   * True when the task can delete existing target records.
   */
  canDelete: boolean;

  /**
   * True when the task can query source records.
   */
  canQuerySource: boolean;

  /**
   * True when the task can query target records.
   */
  canQueryTarget: boolean;
};
