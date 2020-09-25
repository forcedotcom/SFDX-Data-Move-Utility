/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// -------------------------------------------------------
// The shared SFDMU Addon package.
// 
// This package is intended to be shared with the end-user
// who is developing the custom SFDMU Addons.
// -------------------------------------------------------


/* ------------------ Common ------------------ */
/**
 * The information about the runing sfdmu command
 *
 * @export
 * @interface ICommandRunInfo
 */
export interface ICommandRunInfo {
    sourceUsername: string,
    targetUsername: string,
    apiVersion: string,
    readonly basePath: string,
    readonly pinfo: IPluginInfo
}

/**
 * The information about the running Plugin
 */
export interface IPluginInfo {

    // The Plugin name (sfdmu)
    pluginName: string,

    // The executed command (run)
    commandName: string,

    // Version of the Plugin (5.0.0)
    version: string,

    // Path to the directory where the Plugin is installed
    path: string,

    // Full CLI string used to run the command (sfdx sfdmu:run --sourceusername a@mail.com --targetusername b@mail.com)
    commandString: string,

    // The array of CLI arguments ('--sourceusername', 'a@mail.com', '--targetusername', 'b@mail.com')
    argv: string[]
}

/**
 * Descrbes table to output it to the console
 */
export interface ITableMessage {
    tableBody: Array<object>,
    tableColumns: Array<{
        key: string,
        label: string,
        width?: number
    }>
}



/* ------------------ IPluginRuntime ------------------ */
/**
* Provides access to the SFDMU runtime functionality.
*
* The SFDMU Addon can use its methods to perform
*  a variety of actions on the live data, connected orgs, etc.
*  when the Plugin command is running.
*/
export interface IPluginRuntime {

    /**
     * Returns the information about the running command.
     */
    runInfo: ICommandRunInfo,

    /**
     *  Returns the jsforce.Connection object 
     *   that can be directly used by the Addon 
     *   to call the SF API
     * @return {jsforce.Connection}
     */
    getConnection(isSource: boolean): any,

    /**
     * Returns the information about the connected Orgs.
     */
    getOrgInfo(isSource: boolean): {
        instanceUrl: string,
        accessToken: string,
        apiVersion: string,
        isFile: boolean,
    };

    /**
     * Writes message to the console or/and log file.
     * All the messages are written with the VERBOSE verbosity level.
     */
    writeLogConsoleMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE"): void;

}



/* ------------------ IAddonModule ------------------ */
/**
 * The interface to be implemented in each SFDMU Addon.
 */
export interface IAddonModule {

    /**
     * The Plugin will share with the Addon its public
     *   methods and runtime data using this property
     */
    runtime: IPluginRuntime;

    /*
        // TODO:  Add this constructor to the 
        //        Addon code for the initialization
        constructor(runtime : IPluginRuntime){
            this.runtime = runtime;
        }
    */

    /**
     * Triggered by the plugin after the Plugin is initialized.
     * The Addon can modify and return aupdated startup parameters (ICOmmandRunInfo)
     * to change the behavior.
     */
    onScriptSetup?(runInfo: ICommandRunInfo): Promise<ICommandRunInfo>,

    /**
     * Triggered when the Orgs were successfully connected.
     * The Addon can then call runtime.getOrgInfo() to get iformation about the coneected Orgs.
     */
    onOrgsConnected?(): Promise<any>
}

