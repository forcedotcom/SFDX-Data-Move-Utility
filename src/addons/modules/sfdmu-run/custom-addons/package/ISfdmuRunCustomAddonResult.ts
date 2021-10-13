

/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The class returned from the {@link ISfdmuRunCustomAddonModule.onExecute } method.
 * The Add-On can interact  with the parent process by returning this object back to the caller. 
 *
 * @export
 * @interface ISfdmuRunCustomAddonResult
 */
export default interface ISfdmuRunCustomAddonResult {

    /**
     * Set this property to true will abort the current Plugin job.
     * Use this property if you want to interrupt the migration process after finishing the Add-On execution.
     * @example 
     * ```ts
     * async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> { 
     *      // Return cancel = true if you want to abort the current miration job.
     *      return { cancel: true }; 
     * }
     * ```
     *
     * @type {boolean}
     * @memberof ISfdmuRunCustomAddonResult
     */
    cancel: boolean;

}