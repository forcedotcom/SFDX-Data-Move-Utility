/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonModule } from ".";



/**
 *
 *
 * @export
 * @interface ISfdmuRunCustomAddonService
 */
export default interface ISfdmuRunCustomAddonService {

    /**
     *
     *
     * @param {ISfdmuRunCustomAddonModule} module
     * @param {string} message
     * @param {("INFO" | "WARNING" | "ERROR")} [messageType]
     * @param {...string[]} tokens
     * @memberof ISfdmuRunCustomAddonService
     */
    logFormatted(module: ISfdmuRunCustomAddonModule, message: string, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void;



    /**
     *
     *
     * @param {(string | object)} message
     * @param {("INFO" | "WARNING" | "ERROR" | "OBJECT" | "JSON")} [messageType]
     * @param {...string[]} tokens
     * @memberof ISfdmuRunCustomAddonService
     */
    log(message: string | object, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "JSON", ...tokens: string[]): void;
}