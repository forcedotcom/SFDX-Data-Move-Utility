/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


// -------------------------------------------------------
// The base shared SFDMU Addon package.
// 
// This package is intended to be shared with the end-user
// who is developing the custom SFDMU Addons.
// -------------------------------------------------------


/* ------------------ Common ------------------ */
export enum DATA_MEDIA_TYPE {
    Org,
    File
}


export enum OPERATION {
    Insert,
    Update,
    Upsert,
    Readonly,
    Delete,
    Unknown
}


/**
 * Describes table to output it to the console.
 */
export interface ITableMessage {
    tableBody: Array<object>,
    tableColumns: Array<{
        key: string,
        label: string,
        width?: number
    }>
}



/* ------------------ ICommandRunInfo ------------------ */
/**
 * The information about the running sfdmu command.
 */
export interface ICommandRunInfo {
    // --sourceusername command flag 
    sourceUsername: string,
    // --targetusername command flag
    targetUsername: string,
    // --apiversion command flag
    apiVersion: string,
    // the location of the export.json file
    readonly basePath: string,
    // the information about the Plugin and the framework
    readonly pinfo: IPluginInfo
}


/* ------------------ IPluginInfo ------------------ */
/**
 * The information about the running Plugin
 */
export interface IPluginInfo {
    // The Plugin name (f.ex. sfdmu)
    pluginName: string,
    // The executed command (f.ex. run)
    commandName: string,
    // Version of the Plugin (f.ex. 5.0.0)
    version: string,
    // Path to the directory where the Sfdmu Plugin is installed
    path: string,
    // Full CLI string used to run the command (sfdx sfdmu:run --sourceusername a@mail.com --targetusername b@mail.com)
    commandString: string,
    // The array of CLI arguments ('--sourceusername', 'a@mail.com', '--targetusername', 'b@mail.com')
    argv: string[]
}



/* ------------------ IPluginExecutionContext ------------------ */
/**
 * Provides the context that the Addon was currently colled in it.
 */
export interface IPluginExecutionContext {
    /**
     * The name of the event 
     * which the Addon module was executed int it context.
     */
    eventName: string;

    /**
     * The name of the object which was requested
     * to be processed (null for the global script events)
     * 
     */
    objectName: string;
}



/* ------------------ IAddonModule ------------------ */
/**
 * The interface to be implemented in each SFDMU Addon.
 */
export interface IAddonModuleBase {

    /**
     * The Plugin will share with the Addon its public
     *   methods and runtime data using this property
     */
    runtime: IPluginRuntimeBase;

    /**
     * The main method which is executed by the Plugin
     * when the Addon is running.
     *
     * @param {any} args The user's arguments passed from the 
     *                        manifest file.
     * @returns {any} Updated runTime data to be passed to the next
     *                Addon in the method chain.
     */
    onExecute(context: IPluginExecutionContext, args: any): void;

}


export interface IPluginRuntimeBase {

    // ---------- Props ------------ //
    /**
     * Returns the information about the running command.
     */
    runInfo: ICommandRunInfo;

    /**
     * Write a message to the console or/and log file.
     * All the messages are written with the VERBOSE verbosity level.
     */
    writeLogConsoleMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE", ...tokens: string[]): void;

}





