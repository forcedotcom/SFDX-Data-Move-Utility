/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonContext from './ISfdmuRunCustomAddonContext.js';
import type ISfdmuRunCustomAddonResult from './ISfdmuRunCustomAddonResult.js';
import type ISfdmuRunCustomAddonRuntime from './ISfdmuRunCustomAddonRuntime.js';
/**
 * The base interface to implement in every custom SFDMU Add-On module.
 *
 * @export
 * @interface ISfdmuRunCustomAddonModule
 */
export default interface ISfdmuRunCustomAddonModule {
  /**
   * The instance of the Custom Add-On module runtime.
   * <br/>
   * Uses the public property {@link ISfdmuRunCustomAddonRuntime.service}
   * to share the Custom Add-On module API with the current module instance.
   *
   * @type {ISfdmuRunCustomAddonRuntime}
   * @memberof ISfdmuRunCustomAddonModule
   */
  runtime: ISfdmuRunCustomAddonRuntime;

  /**
   * The entry point which is executed by the Plugin when the Add-On event is triggered.
   *
   * @param {ISfdmuRunCustomAddonContext} context The current Add-On runtime context.
   * @param {Record<string, unknown>} args The JS object passed into the function from the `args` property
   * defined in the `object/[addons]` section of the script.
   * <br/>
   * <br/>
   * For example, the portion of the json as below:
   * <br/>
   * ```json
   * "args" : {
   *   "TEST__c": "Another test, assigning this text to the field TEST__c of each record being processed"
   * }
   * ```
   * Will pass to the method the following args:
   * ```ts
   * args = {
   *   TEST__c: "Another test, assigning this text to the field TEST__c of each record being processed"
   * }
   * ```
   * @return {Promise<ISfdmuRunCustomAddonResult>}
   * @memberof ISfdmuRunCustomAddonModule
   */
  onExecute(context: ISfdmuRunCustomAddonContext, args: Record<string, unknown>): Promise<ISfdmuRunCustomAddonResult>;

  /**
   * If implemented, this method runs once per Add-On module (both core and custom) immediately AFTER the export.json
   * file is parsed (the script is loaded) but BEFORE the migration job is actually started.
   * Allows you to modify the script or prepare prerequisites before execution.
   *
   * @param {ISfdmuRunCustomAddonContext} context The current Add-On runtime context.
   * @param {Record<string, unknown>} args The JS object passed into the function from the ```arg``` property
   * defined in the ```object/[addons]``` section of the Script.
   * @return {Promise<ISfdmuRunCustomAddonResult>}
   * @memberof ISfdmuRunCustomAddonModule
   */
  onInit?(context: ISfdmuRunCustomAddonContext, args: Record<string, unknown>): Promise<ISfdmuRunCustomAddonResult>;
}
