/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Error raised when a user aborts execution.
 */
export class CommandAbortedByUserError extends Error {
  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Create a CommandAbortedByUserError instance.
   *
   * @param message - Error details.
   */
  public constructor(message: string) {
    super(message);
  }
}
