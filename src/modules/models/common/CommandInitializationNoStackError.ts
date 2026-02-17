/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Error raised during command initialization without a stack trace.
 */
export class CommandInitializationNoStackError extends Error {
  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Create a CommandInitializationNoStackError instance.
   *
   * @param message - Error details.
   */
  public constructor(message: string) {
    super(message);
  }
}
