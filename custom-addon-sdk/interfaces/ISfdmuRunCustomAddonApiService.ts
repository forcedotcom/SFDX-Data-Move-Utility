/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonCommandRunInfo from './ISfdmuRunCustomAddonCommandRunInfo.js';
import type ISfdmuRunCustomAddonContext from './ISfdmuRunCustomAddonContext.js';
import type ISFdmuRunCustomAddonJob from './ISFdmuRunCustomAddonJob.js';
import type ISfdmuRunCustomAddonModule from './ISfdmuRunCustomAddonModule.js';
import type ISfdmuRunCustomAddonProcessedData from './ISfdmuRunCustomAddonProcessedData.js';
import type ISFdmuRunCustomAddonTask from './ISFdmuRunCustomAddonTask.js';

/**
 * Provides the Custom Add-On API functionality.
 *
 * @export
 * @interface ISfdmuRunCustomAddonApiService
 */
export default interface ISfdmuRunCustomAddonApiService {
  /**
   * Prints a message to the console and the log file (when file logging is enabled).
   *
   * @param {ISfdmuRunCustomAddonModule} module The currently running Add-On module instance.
   * @param {string} message The message text or the message template to print.
   * @param {("INFO" | "WARNING" | "ERROR" | "JSON")} [messageType] The type of the message.
   * @param {...string[]} tokens The optional string tokens to replace in the message template.
   * <br/>
   * For example:
   * ```ts
   *  async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {
   *      this.runtime.service.log(this, 'My %s template', 'INFO', 'cool'); // Outputs 'My cool template'
   *  }
   * ```
   * @memberof ISfdmuRunCustomAddonApiService
   */
  log(
    module: ISfdmuRunCustomAddonModule,
    message: string | object,
    messageType?: 'INFO' | 'WARNING' | 'ERROR' | 'JSON',
    ...tokens: string[]
  ): void;

  /**
   * Returns data currently processed by the plugin.
   * Gives the Add-On module the ability to access and modify runtime data on the fly.
   * <br>
   *
   * @example
   * ```ts
   *  async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {
   *
   *      // Get the data from the Plugin runtime context
   *      const data = this.runtime.service.getProcessedData(context);
   *
   *      // Modify the records which are about to be inserted into the Target
   *      data.recordsToInsert.forEach(record => record['TEST__c'] = 'text');
   *  }
   * ```
   *
   * @param {ISfdmuRunCustomAddonContext} context The current instance of the Add-On context.
   * @return {ISfdmuRunCustomAddonProcessedData} Data processed by the plugin in the current runtime context.
   * @memberof ISfdmuRunCustomAddonApiService
   */
  getProcessedData(context: ISfdmuRunCustomAddonContext): ISfdmuRunCustomAddonProcessedData;

  /**
   * Returns information about the SFDMU plugin and executed CLI command.
   * <br>
   *
   * @example
   * ```ts
   *  async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {
   *       console.log(this.runtime.service.getPluginRunInfo().pinfo.pluginName); // Outputs 'sfdmu'
   *  }
   * ```
   *
   * @return {ISfdmuRunCustomAddonCommandRunInfo}
   * @memberof ISfdmuRunCustomAddonApiService
   */
  getPluginRunInfo(): ISfdmuRunCustomAddonCommandRunInfo;

  /**
   * Returns the running SFDMU job.
   *
   * @return {ISFdmuRunCustomAddonJob}
   * @memberof ISfdmuRunCustomAddonApiService
   */
  getPluginJob(): ISFdmuRunCustomAddonJob;

  /**
   * Returns the running job task.
   *
   * @param {ISfdmuRunCustomAddonContext} context The current instance of the Add-On context.
   * @return {ISFdmuRunCustomAddonTask}
   * @memberof ISfdmuRunCustomAddonApiService
   */
  getPluginTask(context: ISfdmuRunCustomAddonContext): ISFdmuRunCustomAddonTask | null;
}
