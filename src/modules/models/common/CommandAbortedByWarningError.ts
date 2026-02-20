/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Error raised when warnings are configured to abort execution.
 */
export class CommandAbortedByWarningError extends Error {
  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Creates a CommandAbortedByWarningError instance.
   *
   * @param message - Warning message causing the abort.
   */
  public constructor(message: string) {
    super(message);
  }
}
