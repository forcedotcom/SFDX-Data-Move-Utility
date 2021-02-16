/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { IPluginRuntimeBase, DATA_MEDIA_TYPE, OPERATION } from "./commonComponents";


/* ------------------ ISfdmuRunPluginJob ------------------ */
/**
 * Holds the data for the migration job
 */
export interface ISfdmuRunPluginJob {
    tasks: ISfdmuRunPluginTask[],
}


/* ------------------ ISfdmuRunPluginTask ------------------ */
/**
 * Holds the data per migration task
 */
export interface ISfdmuRunPluginTask {
    readonly sourceToTargetRecordMap: Map<any, any>,
    readonly sourceTaskData: ISfdmuRunPluginTaskData,
    readonly targetTaskData: ISfdmuRunPluginTaskData,
    readonly sObjectName: string,
    readonly operation: OPERATION
}


/* ------------------ ISfdmuRunPluginTaskData ------------------ */
/**
 * Holds the data for each data layer (Source / Target) per migration task
 */
export interface ISfdmuRunPluginTaskData {
    readonly records: Array<any>,
    readonly isSource: boolean,
    readonly extIdRecordsMap: Map<string, string>,
    readonly idRecordsMap: Map<string, any>,
    readonly sObjectName: string,
    readonly mediaType: DATA_MEDIA_TYPE
}


/* ------------------ ISfdmuRunPluginRuntime ------------------ */
/**
* Provides access to the SFDMU runtime functionality.
*
* The SFDMU Addon can use its methods to perform
*  a variety of actions on the live data, connected orgs, etc.
*  when the Plugin command is running.
*/
export interface ISfdmuRunPluginRuntime extends IPluginRuntimeBase {

    // ---------- Props ------------ //
    /**
    * All data related to the current migration job,
    * which has collected from all core processes.
    *   
    */
    pluginJob: ISfdmuRunPluginJob;



    // ---------- Methods ------------ //s
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
     * Retrieves the records from the connected salesforce environment
     * or from the CSV file (depend on the runtime)
     * 
     * @return {Array<any>} The array of the retrieved records     
     */
    queryAsync(isSource: boolean, soql: string, useBulkQueryApi: boolean): Promise<Array<any>>;

    /**
     * Retrieves the records from the connected salesforce environment
     * or from the CSV file (depend on the runtime)
     * 
     * (used to join retrieved records by the multple soql queries)
     * 
     * @return {Array<any>} The array of all retrieved records     
     */
    queryMultiAsync(isSource: boolean, soqls: string[], useBulkQueryApi: boolean): Promise<Array<any>>;

    /**
     * Constructs array of SOQL-IN queries based on the provided values.
     */
    createFieldInQueries(selectFields: Array<string>, fieldName: string, sObjectName: string, valuesIN: Array<string>): Array<string>;

}







