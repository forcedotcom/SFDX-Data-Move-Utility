import { Common } from "../../../modules/components/common_components/common";
import { Logger, LOG_MESSAGE_TYPE, LOG_MESSAGE_VERBOSITY, RESOURCES } from "../../../modules/components/common_components/logger";
import { SYSTEM_MESSAGES } from "../../messages/system";
import ICommandRunInfo from "../../../modules/models/common_models/ICommandRunInfo";
import IAddonModuleBase from "./IAddonModuleBase";
import {  ITableMessage } from "../../../modules/models/common_models/helper_interfaces";
import { IAddonRuntimeSystem } from "./IAddonRuntimeSystem";




export default class AddonRuntimeBase implements IAddonRuntimeSystem {

    runInfo: ICommandRunInfo;
    #logger: Logger;

    constructor(logger: Logger, runInfo: ICommandRunInfo) {
        this.#logger = logger;
        this.runInfo = runInfo;
    }

    // --------------------------- IPluginRuntimeSystem ------------------------------------- //
    getSystemMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): string {
        switch (message) {
            case SYSTEM_MESSAGES.NewLine:
                return ''; 
        }
        let mess = Common.formatStringLog((message || '').toString(), ...tokens);
        return this.#logger.getResourceString(RESOURCES.coreAddonMessageTemplate,
            module.moduleDisplayName,
            module.context.objectDisplayName,
            mess);
    }

    writeSystemInfoMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void {
        this.writeMessage(this.getSystemMessage(module, message, ...tokens), "INFO");
    }

    writeSystemWarningMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void {
        this.writeMessage(this.getSystemMessage(module, message, ...tokens), "WARNING");
    }

    writeSystemErrorMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void {
        this.writeMessage(this.getSystemMessage(module, message, ...tokens), "ERROR");
    }



    // --------------------------- Own members ------------------------------------- //
    writeSystemMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void {
        switch (messageType) {
            case 'ERROR':
                this.writeSystemErrorMessage(module, message, ...tokens);
                break;

            case 'WARNING':
                this.writeSystemWarningMessage(module, message, ...tokens);
                break;

            default:
                this.writeSystemInfoMessage(module, message, ...tokens);
                break;
        }
    }

    /**
     * Writes message into the output
     *
     * @param {(string | object | ITableMessage)} message The message to write
     * @param {("INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE" | "JSON")} [messageType] The type of the message
     * @param {...string[]} tokens The optional parameters to replace %s placeholders in the given message
     * @memberof PluginRuntimeBase
     */
    writeMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE" | "JSON", ...tokens: string[]): void {
        switch (messageType) {
            case "WARNING":
                this.#logger.warn(<string>message, ...tokens);
                break;

            case "ERROR":
                this.#logger.error(<string>message, ...tokens);
                break;

            case "OBJECT":
                this.#logger.objectNormal(<object>message);
                break;

            case "TABLE":
                this.#logger.log(<ITableMessage>message, LOG_MESSAGE_TYPE.TABLE, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens);
                break;

            default:
                this.#logger.infoNormal(<string>message, ...tokens);
                break;
        }
    }

    /**
     * Writes default start message into the output
     *
     * @param {IAddonModuleBase} module The current module instance
     * @memberof PluginRuntimeBase
     */
    writeStartMessage(module: IAddonModuleBase): void {
        module.runtime.writeMessage(RESOURCES.startAddonExecute.toString(), "INFO", module.moduleDisplayName, module.context.objectDisplayName);
    }

    /**
     * Writes default finish message into the output
     *
     * @param {IAddonModuleBase} module The current module instance
     * @memberof PluginRuntimeBase
     */
    writeFinishMessage(module: IAddonModuleBase) {
        module.runtime.writeMessage(RESOURCES.finishAddonExecute.toString(), "INFO", module.moduleDisplayName, module.context.objectDisplayName);
    }

    /**
     * Execute several async functions in parallel
     *
     * @param {Array<(...args: any[]) => Promise<any>>} fns The functions to execute
     * @param {*} [thisArg] This arg to apply to all functions
     * @param {number} [maxParallelTasks=5] The maximum parallelizm
     * @returns {Promise<any[]>} Array of results of all functions
     */
    async parallelExecAsync(fns: ((...args: any[]) => Promise<any>)[], thisArg?: any, maxParallelTasks?: number): Promise<any[]> {
        return await Common.parallelExecAsync(fns, thisArg, maxParallelTasks);
    }

    /**
     * Execute secveral async functions in serial mode 
     *
     * @param {Array<(...args: any[]) => Promise<any>>} fns The functions to execute
     * @param {*} [thisArg] This arg to apply to all functions
     * @returns {Promise<any[]>} Array of results of all functions 
     */
    async serialExecAsync(fns: ((...args: any[]) => Promise<any>)[], thisArg?: any): Promise<any[]> {
        return await Common.serialExecAsync(fns, thisArg);
    }

    /**
     * Remove folder with all files
     *
     * @param {string} path Path to the folder to remove
     * @param {boolean} [throwIOErrors] if any IO error while deleting fiel or folder throws the runtime error
     * @memberof SfdmuRunPluginRuntime
     */
    deleteFolderRecursive(path: string, throwIOErrors?: boolean): void {
        Common.deleteFolderRecursive(path, throwIOErrors);
    }

    /**
     * Reads data from CSV file
     *
     * @param {string} filePath The file path to read
     * @param {number} [linesToRead] Amount of lines to read from the CSV file. 0  to read entire file.
     * @param {Map<string, string>} [columnDataTypeMap] The map between [CSV Column Name] => [data type of this column, for example 'boolean', 'text', etc]
     *                                                   This parameter is uses the SF metadata describe field types.   
     * @returns {Promise<Array<any>>} Array of the records from the CSV file
    
     */
    async readCsvFileAsync(filePath: string, linesToRead?: number, columnDataTypeMap?: Map<string, string>): Promise<any[]> {
        return await Common.readCsvFileAsync(filePath, linesToRead, columnDataTypeMap);
    }

    /**
     * Write data into CSV file
     *
     * @param {string} filePath The file path to write
     * @param {Array<any>} records The records to write into the CSV file.
     * @param {boolean} [createEmptyFileOnEmptyArray] true to override/create en empty csv file if there are no records passed.
     *                                                  Otherwise the file will not be override with empty data only if the records array is not empty.
     * @returns {Promise<void>}
    
     */
    async writeCsvFileAsync(filePath: string, records: any[], createEmptyFileOnEmptyArray?: boolean): Promise<void> {
        return await Common.writeCsvFileAsync(filePath, records, createEmptyFileOnEmptyArray);
    }


}