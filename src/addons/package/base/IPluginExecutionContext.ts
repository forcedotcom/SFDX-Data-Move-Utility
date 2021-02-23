/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export default interface IPluginExecutionContext {
    
    /**
     * The name of the event 
     * which the Addon module was executed int it context.
     */
    eventName: string;

    /**
     * The original api name of the processed object
     * (null for the global script events)
     * 
     */
    objectName: string;

    /**
     * The display name of the processed object 
     * to use it in the console messages.
     */
    objectDisplayName: string;
}
