/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/* ------------------ Enumerations ------------------ */
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

export enum API_ENGINE {
    DEFAULT_ENGINE,
    REST_API,
    BULK_API_V1,
    BULK_API_V2
}

export enum RESULT_STATUSES {
    Undefined = "Undefined",
    ApiOperationStarted = "ApiOperationStarted",
    ApiOperationFinished = "ApiOperationFinished",
    Information = "Information",
    JobCreated = "JobCreated",
    BatchCreated = "BatchCreated",
    DataUploaded = "DataUploaded",
    InProgress = "InProgress",
    Completed = "Completed",
    FailedOrAborted = "FailedOrAborted",
    ProcessError = "ProcessError"
}

export enum MESSAGE_IMPORTANCE {
    Silent,
    Low,
    Normal,
    High,
    Warn,
    Error
}

export enum ADDON_MODULE_METHODS {
    none = 'none',
    onBefore = "onBefore",
    onAfter = "onAfter"
}


/* ------------------ ITableMessage ------------------ */
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

/* ------------------ IAddonModuleBase ------------------ */
/**
 * The interface to be implemented in each SFDMU Addon.
 */
export interface IAddonModuleBase {

    context: IPluginExecutionContext;

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

    /**
     * The display name of the current Plugin 
     */
    readonly displayName: string;

}

/**
 *
 * The base class for the Plugin Runtime provided by the runtime engine
 */
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

export abstract class AddonModuleBase implements IAddonModuleBase {
    context: IPluginExecutionContext;
    abstract runtime: IPluginRuntimeBase;
    abstract onExecute(context: IPluginExecutionContext, args: any): void;
    abstract displayName: string;
}





