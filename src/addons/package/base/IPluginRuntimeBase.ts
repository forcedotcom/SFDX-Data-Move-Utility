
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import IAddonModuleBase from "./IAddonModuleBase";
import ICommandRunInfo from "./ICommandInfo";
import ITableMessage from "../common/ITableMessage";

export default interface IPluginRuntimeBase {

    // ---------- Props ------------ //
    /**
     * Returns the information about the running command.
     */
    runInfo: ICommandRunInfo;

    /**
     * Write a message to the console or/and log file.
     * All the messages are written with the VERBOSE verbosity level.
     */
    writeMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE", ...tokens: string[]): void;

    /**
     * Write the standard message about plugin starts to execute
     *
     * @memberof IPluginRuntimeBase
     */
    writeStartMessage(module : IAddonModuleBase): void;

    /**
     * Write the standard message about plugin finishes to execute
     *
     * @memberof IPluginRuntimeBase
     */
    writeFinishMessage(module : IAddonModuleBase): void;

}