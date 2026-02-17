/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Error raised during command initialization.
 */
export class CommandInitializationError extends Error {
  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Create a CommandInitializationError instance.
   *
   * @param message - Error details.
   */
  public constructor(message: string) {
    super(message);
  }
}
