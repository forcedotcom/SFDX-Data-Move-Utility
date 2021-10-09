/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Holds information about the runtime context where the event is currently executed
 */
export default interface IAddonContext {
    
    /**
     * The name of the executed event
     */
    eventName: string;

    /**
     * The api name of the processed object
     * (null for the Global Script Event)
     */
    objectName: string;

    /**
     * The display name of the processed object 
     * (typically object label)
     */
    objectDisplayName: string;


    /**
     *
     * The optional description of the processed event
     * (defined in the Script file)
     */
    description: string;

    /**
     * The optional message to be printed each time the event is ececuted
     * (defined in the Script file)
     */
    startupMessage: string;

    /**
     * Returns true if this is custom-defined plugin
     */
    isCore: boolean;


}
