/*
 * --------------------------------------------------------------------------
 * This Add-On module is provided AS IS without any guarantee.
 * You can use this example to see how to build your own Add-On modules.
 * --------------------------------------------------------------------------
 * 
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Imports interfaces for custom Add-On module, context, result, and runtime from a package
import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonModule, ISfdmuRunCustomAddonResult, ISfdmuRunCustomAddonRuntime } from "../package";

/**
 * Defines a class implementing ISfdmuRunCustomAddonModule for custom manipulations of source records
 * before uploading to the Target system.
 */
export default class SfdmuCustomAddOnModule implements ISfdmuRunCustomAddonModule {

    /**
     * Constructor that initializes the Add-On module with the provided runtime from the Plugin.
     * @param {ISfdmuRunCustomAddonRuntime} runtime - Runtime provided by the Plugin to interact with the module.
     */
    constructor(runtime: ISfdmuRunCustomAddonRuntime) {
        this.runtime = runtime; // Assigns the passed runtime to this class's runtime property.
    }

    /**
     * The current instance of the Add-On module runtime to interact with the Salesforce Data Migration Utility (SFDMU) Plugin.
     */
    runtime: ISfdmuRunCustomAddonRuntime;

    /**
     * The main method that executes the custom logic for manipulating source records.
     * @param {ISfdmuRunCustomAddonContext} context - Provides context like module display name and event name.
     * @param {any} args - Arbitrary arguments that might be passed to the module for processing.
     * @returns {Promise<ISfdmuRunCustomAddonResult>} A promise resolving to null to continue the job.
     */
    async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {

        // Logs the start of the module execution
        this.runtime.service.log(this, `The Add-On module ${context.moduleDisplayName} has been successfully started. The event ${context.eventName} has been fired.`);

        // Logs a blank line for readability in the log output
        this.runtime.service.log(this, ''); // Prints new line
        // Logs a message indicating that arguments are about to be displayed
        this.runtime.service.log(this, 'The arguments are:'); // Prints string
        // Logs the passed arguments as formatted JSON
        this.runtime.service.log(this, args, "JSON"); // Prints object as formatted JSON
        // Logs another blank line for readability in the log output
        this.runtime.service.log(this, ''); // Prints new line

        // Retrieves the processed data relevant to the current context
        const data = this.runtime.service.getProcessedData(context);

        // Manipulates the source records based on the retrieved data and arguments
        [].concat(data.recordsToInsert, data.recordsToUpdate).forEach(record => {
            // Attempts to parse a 'LongText__c' field to JSON, or uses an empty JSON object as fallback
            const jsonString = String(record['LongText__c']) || '{}';
            // Parses the JSON string into an object
            if (jsonString) {
                const obj = JSON.parse(jsonString);
                // Assigns a value from the parsed object to 'TEST1__c' field of the record
                record['TEST1__c'] = obj['TEST1__c'];
            }
            // Iterates over args if they exist and assigns their properties to the current record
            if (args) {
                Object.keys(args).forEach(function (prop) {
                    record[prop] = args[prop];
                });
            }
        });

        // Logs the completion of the module execution
        this.runtime.service.log(this, `The Add-On module ${context.moduleDisplayName} has been successfully completed.`);

        // Returns null to indicate that the migration job should continue
        return null;
    }
}
