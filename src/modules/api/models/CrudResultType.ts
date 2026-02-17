/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Normalized CRUD result from API responses.
 */
export type CrudResultType = {
  /**
   * Record Id.
   */
  id?: string;

  /**
   * Success flag.
   */
  success?: boolean;

  /**
   * Error payloads.
   */
  errors?: Array<{ message?: string }> | string[];
};
