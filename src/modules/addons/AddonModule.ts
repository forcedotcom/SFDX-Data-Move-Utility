/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { IAddonContext } from './models/IAddonContext.js';
import type AddonResult from './models/AddonResult.js';
import type AddonRuntime from './AddonRuntime.js';

/**
 * Base class for add-on modules.
 */
export default abstract class AddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Execution context set by the addon manager.
   */
  public context: IAddonContext;

  /**
   * Runtime instance used by the add-on.
   */
  public runtime: AddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on module.
   *
   * @param runtime - Runtime instance.
   */
  public constructor(runtime: AddonRuntime) {
    this.runtime = runtime;
    this.context = {
      eventName: '',
      objectName: '',
      description: '',
      objectDisplayName: '',
      moduleDisplayName: '',
      isCore: false,
      isFirstPass: true,
      passNumber: 0,
      objectSetIndex: 0,
    };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes the add-on logic for the event.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public onInitAsync(context: IAddonContext, args: Record<string, unknown>): Promise<AddonResult | void> {
    void this;
    void context;
    void args;
    return Promise.resolve(undefined);
  }

  /**
   * Executes the add-on logic for the event.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public abstract onExecuteAsync(context: IAddonContext, args: Record<string, unknown>): Promise<AddonResult | void>;
}
