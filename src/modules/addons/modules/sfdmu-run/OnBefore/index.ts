/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
} from '../../../../../../custom-addon-sdk/interfaces/index.js';
import AddonResult from '../../../models/AddonResult.js';

/**
 * Core add-on executed before the run starts.
 */
export default class CoreOnBefore implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Execution context assigned by the add-on manager.
   */
  public context: ISfdmuRunCustomAddonContext;

  /**
   * Runtime instance provided by the add-on manager.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new core OnBefore add-on.
   *
   * @param runtime - Runtime instance provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
    this.context = {
      eventName: '',
      moduleDisplayName: '',
      objectName: '',
      objectDisplayName: '',
      description: '',
    };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes the core OnBefore hook.
   *
   * @param context - Add-on execution context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    void context;
    void args;
    this.runtime.logAddonExecutionStarted(this);
    this.runtime.logAddonExecutionFinished(this);
    return Promise.resolve(new AddonResult());
  }
}
