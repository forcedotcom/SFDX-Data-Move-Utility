
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { API_ENGINE, OPERATION } from "../../../modules/components/common_components/enumerations";
import { IBlobField } from "../../../modules/models/api_models";
import { ITableMessage } from "../../../modules/models/common_models/helper_interfaces";
import ICommandRunInfo from "../../../modules/models/common_models/ICommandRunInfo";
import { STANDARD_MESSAGES } from "../../messages/standard";
import SfdmuContentVersion from "./sfdmuContentVersion";
import SfdmuPluginJob from "./sfdmuPluginJob";
import SfdmuRunPluginTask from "./sfdmuRunPluginTask";
import IAddonModuleBase from "../common/IAddonModuleBase";





/* Provides access to the SFDMU runtime functionality.
*
* The SFDMU Addon can use its methods to perform
*  a variety of actions on the live data, connected orgs, etc.
*  when the Plugin command is running.
*/

/**
 * Provides the base Api methods and properties
 * to use in the AddOn module
 */
export default interface ISfdmuRunPluginRuntime {


    /**
         * Returns the information about the running command.
         */
    runInfo: ICommandRunInfo;

    /**
     * Writes a custom message string to the console or/and log file.
     * All the messages are written with the VERBOSE verbosity level.
     */
    writeMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE" | "JSON", ...tokens: string[]): void;

    /**
     * Writes a message from a predefined Addon Core (standard) messages 
     */
    writeStandardMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void;

    /**
     * Writes the standard message about plugin starts to execute
     *
     */
    writeStartMessage(module: IAddonModuleBase): void;

    /**
     * Writes the standard message about plugin finishes to execute
     *
     */
    writeFinishMessage(module: IAddonModuleBase): void;

    /**
     * Reads the records from CSV file
     *
     */
    readCsvFileAsync(filePath: string, linesToRead?: number, columnDataTypeMap?: Map<string, string>): Promise<any[]>;

    /**
     * Writes the records into CSV file
     *
     */
    writeCsvFileAsync(filePath: string, records: any[], createEmptyFileOnEmptyArray?: boolean): Promise<void>;

    /** 
     * Execute several async functions in parallel mode 
     */
    parallelExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any, maxParallelTasks?: number): Promise<any[]>;

    /**
     * Execute several async functions in serial mode 
     */
    serialExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any): Promise<any[]>;

    /**
     * Removes folder including all its subfolders and files
     *
     */
    deleteFolderRecursive(path: string, throwIOErrors?: boolean): void;



    // ---------- Props ------------ //
    /**
    * All data related to the current migration job,
    * which has collected from all core processes.
    *   
    */
    pluginJob: SfdmuPluginJob;


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
     * All data related to the current running task
     * in the context where the AddOn is currently called
     */
    getPluginTask(module: IAddonModuleBase): SfdmuRunPluginTask,

    /**
     * Returns the api engine to for CRUD operation.
     *
     * @param {number} recordsAmount The amout of records to transfer
     * @param {API_ENGINE} preferredEngine The engine to prefer by default
     * @returns {API_ENGINE}
     * @memberof Script
     */
    getApiEngine(recordsAmount: number, preferredEngine: API_ENGINE): API_ENGINE;

    /**
     * Retrieves the records from the connected salesforce environment
     * or from the CSV file (depend on the runtime)
     * 
     * @return {Array<any>} The array of the retrieved records     
     */
    queryAsync(isSource: boolean, soql: string, useBulkQueryApi?: boolean): Promise<Array<any>>;

    /**
     * Retrieves the records from the connected salesforce environment
     * or from the CSV file (depend on the runtime)
     * 
     * (used to join retrieved records by the multple soql queries)
     * 
     * @return {Array<any>} The array of all retrieved records     
     */
    queryMultiAsync(isSource: boolean, soqls: string[], useBulkQueryApi?: boolean): Promise<Array<any>>;

    /**
    * Constructs array of SOQL-IN queries based on the provided values.
    * Keeps aware of the query length limitation according to the documentation:
    * (https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_soslsoql.htm)
    *
    *
    * @param {string[]} selectFields The fields to include into the SELECT statement in each query
    * @param {string} [fieldName="Id"] The field of the IN clause
    * @param {string} sObjectName The object api name to select 
    * @param {string[]} valuesIN The array of values to use in the IN clause
    * @param {string} whereClause The additional where clause to add besides the IN, like (Id Name ('Name1', 'Name2)) AND (Field__c = 'value')
    * @returns {string[]} The array of SOQLs depend on the given values to include all of them
    */
    createFieldInQueries(selectFields: Array<string>, fieldName: string, sObjectName: string, valuesIN: Array<string>, whereClause?: string): Array<string>;

    /**
      * Performs DML operation on the Target org pr writes into the target CSV file.
      * 
      * if the target object exists in the Script - the settings
      * defined in the script for this object will be used, 
      * otherwise it leverages the default settings for other objects. 
      * 
      * If the target is csvfile it will write into the CSV file according to the script settings.    
     *
     * @param {string} sObjectName The sObject name to update.
     * @param {OPERATION} operation The operation
     * @param {any[]} records The records to process
     * @param {API_ENGINE} [engine] You can choose the API engine to use
     * @param {boolean} [updateRecordId] When true it will override the Ids of the source records passed to the method by the Ids returned 
     *                                    from the SF API, otherwise it will remain the source records as is and will return them from the method.
     *
     * @returns {Promise<any[]>} The result records. Typeically it is THE SAME records as passed to the method, but you can override the IDs
     *                           with the target Ids by putting updateRecordId = true
     * @memberof ISfdmuRunPluginRuntime
     */
    updateTargetRecordsAsync(sObjectName: string, operation: OPERATION, records: any[], engine?: API_ENGINE, updateRecordId?: boolean): Promise<any[]>;

    /**
     * Downloads the blob data from the given sobject and field
     *
     * @param {boolean} isSource
     * @param {Array<string>} recordIds The list of record ids to download the blob data using the given blob field
     * @param {IBlobField} blobField The field of blob type from where to download the data (for example Attachment.Body)
     * @returns {Promise<Map<string, string>>} Map: [record Id] => [blob data as bas64 string]
     * @memberof ISfdmuRunPluginRuntime
     */
    downloadBlobDataAsync(isSource: boolean, recordIds: Array<string>, blobField: IBlobField): Promise<Map<string, string>>;

    /**
     * Downloads the given ContentVersions from the source org and uploads it to the target org.
     * Supports both binary and url contents.
     * 
     * Creates or updates ContentDocument object if necessary. 
     * If ContentDocument does exist it will add a new ContentVersion to it.
     *
     * @param {ISfdmuContentVersion} sourceVersions The ContentVersion records to process
     * @returns {Promise<ISfdmuContentVersion[]>} The updated input ContentVersion records
     * @memberof ISfdmuRunPluginRuntime
     */
    transferContentVersions(module: IAddonModuleBase, sourceVersions: SfdmuContentVersion[]): Promise<SfdmuContentVersion[]>;

    /**
     * Creates if not exist or returns the path to the temporary folder
     * dedicated to this Addon
     *
     * @returns {string}
     * @memberof ISfdmuRunPluginRuntime
     */
    getOrCreateTempPath(module: IAddonModuleBase): string;

    /**
     * Destroys the previously created temporary path
     *
     * @memberof ISfdmuRunPluginRuntime
     */
    destroyTempPath(module: IAddonModuleBase, removeParentFolder?: boolean): void;

    /**
     * The base path to the currently executing job (export.json file)
     *
     * @type {string}
     * @memberof ISfdmuRunPluginRuntime
     */
    readonly basePath: string;

    /**
     * The path to the source files
     *
     * @type {string}
     * @memberof ISfdmuRunPluginRuntime
     */
    readonly sourcePath: string;

    /**
     * The path to the target files
     *
     * @type {string}
     * @memberof ISfdmuRunPluginRuntime
     */
    readonly targetPath: string;

}
