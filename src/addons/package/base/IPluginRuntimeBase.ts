
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonModuleBase, ICommandRunInfo, ITableMessage } from ".";



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
     */
    writeStartMessage(module: IAddonModuleBase): void;

    /**
     * Write the standard message about plugin finishes to execute
     *
     */
    writeFinishMessage(module: IAddonModuleBase): void;

    /**
     * Reads CSV file
     *
     */
    readCsvFileAsync(filePath: string, linesToRead?: number, columnDataTypeMap?: Map<string, string>): Promise<any[]>;

    /**
     * Writes into CSV file
     *
     */
    writeCsvFileAsync(filePath: string, records: any[], createEmptyFileOnEmptyArray?: boolean): Promise<void>;

    /** 
     * Execute secveral async functions in parallel mode 
     */
    parallelExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any, maxParallelTasks?: number): Promise<any[]>;

    /**
     * Execute secveral async functions in serial mode 
     */
    serialExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any): Promise<any[]>;

    /**
     * Removes folder with all subfolders and files
     *
     */
    deleteFolderRecursive(path: string, throwIOErrors?: boolean): void;

}