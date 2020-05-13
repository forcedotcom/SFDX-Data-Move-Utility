/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { LoggerLevel } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import { Common } from './common';
import { SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { CONSTANTS } from './statics';


/**
 * Tokens from the common.json resource file.
 * The shared tokens are being used by all commands of the plugin 
 * (the sfdmu:run command and every additional commands as well)
 *
 * @export
 * @enum {number}
 */
export enum RESOURCES {

    newLine = "newLine",
    separator = "separator",
    source = "source",
    target = "target",
    Step1 = "Step1",
    Step2 = "Step2",
    Pass1 = "Pass1",
    Pass2 = "Pass2",
    Pass3 = "Pass3",
    csvFile = "csvFile",
    org = "org",
    sourceOrg = "sourceOrg",
    targetOrg = "targetOrg",
    scriptFile = "scriptFile",
    skipped = "skipped",
    noRecords = "noRecords",

    defaultPromptOptions = "defaultPromptOptions",
    defaultPromptSelectedOption = "defaultPromptSelectedOption",
    promptMessageFormat = "promptMessageFormat",
    promptDefaultOptionFormat = "promptDefaultOptionFormat",

    loggerInfoString = "loggerInfoString",
    loggerInfoStringWithDate = "loggerInfoStringWithDate",
    loggerWarnString = "loggerWarnString",
    loggerWarnStringWithDate = "loggerWarnStringWithDate",
    loggerErrorString = "loggerErrorString",
    loggerErrorStringWithDate = "loggerErrorStringWithDate",
    loggerImportantInfoString = "loggerImportantInfoString",
    loggerImportantInfoStringWithDate = "loggerImportantInfoStringWithDate",
   
    loggerStackTraceString = "loggerStackTraceString",
    loggerTimeElapsedString = "loggerTimeElapsedString",
    loggerCommandStartedString = "loggerCommandStartedString",
    loggerCommandCompletedString = "loggerCommandCompletedString",

    fileLoggerInfoString = "fileLoggerInfoString",
    fileLoggerWarnSring = "fileLoggerWarnSring",
    fileLoggerErrorSring = "fileLoggerErrorSring",
    fileLoggerInfoStringWithoutDate =  "fileLoggerInfoStringWithoutDate",
    fileLoggerWarnSringWithoutDate =  "fileLoggerWarnSringWithoutDate",
    fileLoggerErrorSringWithoutDate = "fileLoggerErrorSringWithoutDate",
        
    successfullyCompletedResult = "successfullyCompletedResult",
    commandInitializationErrorResult = "commandInitializationErrorResult",
    orgMetadataErrorResult = "orgMetadataErrorResult",

    commandExecutionErrorResult = "commandExecutionErrorResult",
    commandUnresolvableWarningResult = "commandUnresolvableWarningResult",    
    commandAbortedByUserErrorResult = "commandAbortedByUserErrorResult",
    commandUnexpectedErrorResult = "commandUnexpectedErrorResult",


    commandInProgress = "commandInProgress",    
    packageScript = "packageScript",
    pluginVersion = "pluginVersion",
    workingPathDoesNotExist = "workingPathDoesNotExist",
    packageFileDoesNotExist = "packageFileDoesNotExist",
    loadingPackageFile = "loadingPackageFile",
    objectWillBeExcluded = "objectWillBeExcluded",
    noObjectsDefinedInPackageFile = "noObjectsDefinedInPackageFile",

    tryingToConnectCLI = "tryingToConnectCLI",
    successfullyConnected = "successfullyConnected",
    tryingToConnectCLIFailed = "tryingToConnectCLIFailed",
    sourceTargetCouldNotBeTheSame = "sourceTargetCouldNotBeTheSame",
    accessToOrgExpired = "accessToOrgExpired",
    MalformedQuery = "MalformedQuery",
    MalformedDeleteQuery = "MalformedDeleteQuery",
    needBothOrgsToSupportPersonAccounts = "needBothOrgsToSupportPersonAccounts",
    
    gettingOrgMetadata = "gettingOrgMetadata",
    gettingMetadataForSObject = "gettingMetadataForSObject",
    noExternalKey = "noExternalKey",
    objectSourceDoesNotExist = "objectSourceDoesNotExist",
    objectTargetDoesNotExist = "objectTargetDoesNotExist",
    processingSObject = "processingSObject",
    fieldSourceDoesNtoExist = "fieldSourceDoesNtoExist",
    fieldTargetDoesNtoExist = "fieldTargetDoesNtoExist",
    missingFieldsToProcess = "missingFieldsToProcess",

    dataMigrationProcessStarted = "dataMigrationProcessStarted",
    buildingMigrationStaregy = "buildingMigrationStaregy",

    readingValuesMappingFile = "readingValuesMappingFile",
    mappingRawCsvValues = "mappingRawCsvValues",
    validatingAndFixingSourceCSVFiles = "validatingAndFixingSourceCSVFiles",
    validatingSourceCSVFilesSkipped = "validatingSourceCSVFilesSkipped",
    writingToCSV = "writingToCSV",
    noIssuesFoundDuringCSVValidation = "noIssuesFoundDuringCSVValidation",
    issuesFoundDuringCSVValidation = "issuesFoundDuringCSVValidation",
    continueTheJobPrompt = "continueTheJobPrompt",
    csvFileIsEmpty = "csvFileIsEmpty",
    columnsMissingInCSV = "columnsMissingInCSV",
    missingParentRecordForGivenLookupValue = "missingParentRecordForGivenLookupValue",
    cantUpdateChildLookupCSVColumn = "cantUpdateChildLookupCSVColumn",
    csvFilesWereUpdated = "csvFilesWereUpdated",
    validationAndFixingsourceCSVFilesCompleted = "validationAndFixingsourceCSVFilesCompleted",

    executionOrder = "executionOrder",
    queryingOrder = "queryingOrder",  

    unprocessedRecord = "unprocessedRecord",
    invalidRecordHashcode = "invalidRecordHashcode",
    apiOperationFailed = "apiOperationFailed",
    apiOperationProcessError = "apiOperationProcessError",
    apiOperationJobCreated = "apiOperationJobCreated",
    apiOperationBatchCreated = "apiOperationBatchCreated",
    apiOperationDataUploaded = "apiOperationDataUploaded",
    apiOperationInProgress = "apiOperationInProgress",
    apiOperationCompleted = "apiOperationCompleted",
    apiOperationWarnCompleted = "apiOperationWarnCompleted",
    apiOperationStarted = "apiOperationStarted",
    apiOperationFinished = "apiOperationFinished",
    invalidApiOperation = "invalidApiOperation",
    unexpectedApiError = "unexpectedApiError",

    gettingRecordsCount = "gettingRecordsCount",
    totalRecordsAmount = "totalRecordsAmount",

    deletingOldData = "deletingOldData",
    deletingTargetSObject = "deletingTargetSObject",
    deletingFromTheTargetNRecordsWillBeDeleted = "deletingFromTheTargetNRecordsWillBeDeleted",
    deletingFromTheTargetCompleted = "deletingFromTheTargetCompleted",
    deletingOldDataCompleted = "deletingOldDataCompleted",
    deletingOldDataSkipped = "deletingOldDataSkipped",
    nothingToDelete = "nothingToDelete",

    retrievingData = "retrievingData",    
    retrievingDataCompleted = "retrievingDataCompleted",
    queryingAll = "queryingAll",  
    queryingIn = "queryingIn",
    queryingSelfReferenceRecords = "queryingSelfReferenceRecords",
    queryingFinished = "queryingFinished",
    queryingTotallyFetched = "queryingTotallyFetched",
    queryString = "queryString",
    fetchingSummary = "fetchingSummary",

    updatingTarget = "updatingTarget",
    updatingTargetCompleted = "updatingTargetCompleted",
    writingToFile = "writingToFile",
    nothingUpdated = "nothingUpdated"

}



/**
 * Class to manage file logs
 *
 * @class FileLogger
 */
class FileLogger {

    fileName: string;
    enabled: boolean;
    resources: IResourceBundle;

    /**
     *Creates an instance of FileLogger.
     * @param {string} filePath Path to put log file there
     * @param {string} fileName Name of the log file without path
     * @param {boolean} enabled Enable/Disable the logging
     * @memberof FileLogger
     */
    constructor(resources: IResourceBundle, filePath: string, fileName: string, enabled: boolean) {
        this.enabled = enabled;
        this.resources = resources;
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath);
        }
        this.fileName = path.join(filePath, fileName);
    }

    /** 
     * Writes INFO message into log file
     *
     * @param {string} message
     * @memberof FileLogger
     */
    log(message: string) {
        if (this.enabled) {
            message = message || "";
            const d = Common.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.resources.getMessage(RESOURCES.fileLoggerInfoString, [d, message]);
            } else {
                m = this.resources.getMessage(RESOURCES.fileLoggerInfoStringWithoutDate, [message]);
            }
            fs.appendFileSync(this.fileName, m);
        }
    }

    /**
     * Writes WARN message into log file
     *
     * @param {string} message
     * @memberof FileLogger
     */
    warn(message: string) {
        if (this.enabled) {
            message = message || "";
            const d = Common.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.resources.getMessage(RESOURCES.fileLoggerWarnSring, [d, message]);
            } else {
                m = this.resources.getMessage(RESOURCES.fileLoggerWarnSringWithoutDate, [message]);
            }
            fs.appendFileSync(this.fileName, m);
        }
    }

    /**
     * Writes ERROR message into log file
     *
     * @param {string} message
     * @memberof FileLogger
     */
    error(message: string) {
        if (this.enabled) {
            message = message || "";
            const d = Common.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.resources.getMessage(RESOURCES.fileLoggerErrorSring, [d, message]);
            } else {
                m = this.resources.getMessage(RESOURCES.fileLoggerErrorSringWithoutDate, [message]);
            }
            fs.appendFileSync(this.fileName, m);
        }
    }

}

/**
 * Class to manage logs
 *
 * @export
 * @class MessageUtils
 */
export class Logger {

    commandFullName: string;

    jsonFlag: boolean;

    startTime: Date;

    fileLogger: FileLogger;

    resources: IResourceBundle;
    commandMessages: IResourceBundle;

    uxLogger: IUxLogger;
    uxLoggerLevel: LoggerLevel;
    uxLoggerVerbosity: LOG_MESSAGE_VERBOSITY

    verboseFlag: boolean;
    noPromptFlag: boolean;
    noWarningsFlag: boolean;


    /**
     *Creates an instance of MessageUtils.
     * @param {IUxLogger} uxLogger Sfdx UX logger instance
     * @param {string} logLevelFlag --loglevel command flag
     * @param {string} rootPath The root directory wo write the command log file, the /logs/ subdirectory is actually used
     * @param {boolean} verboseFlag --verbose command flag
     * @param {boolean} conciseFlag --concise command flag
     * @param {boolean} quietFlag --quiet/silence command flag
     * @param {boolean} jsonFlag --json command flag
     * @param {boolean} noPromptFlag --noprompt command flag
     * @param {boolean} noWarningsFlag --nowarnings command flag
     * @param {boolean} fileLogFlag --filelog command flag
     * @memberof MessageUtils
     */
    constructor(
        resources: IResourceBundle,
        commandMessages: IResourceBundle,
        uxLogger: IUxLogger,
        command: typeof SfdxCommand,
        logLevelFlag: string,
        rootPath: string,
        verboseFlag: boolean,
        conciseFlag: boolean,
        quietFlag: boolean,
        jsonFlag: boolean,
        noPromptFlag: boolean,
        noWarningsFlag: boolean,
        fileLogFlag: boolean) {

        this.resources = resources;
        this.commandMessages = commandMessages;
        this.uxLogger = uxLogger;

        this.jsonFlag = jsonFlag;
        this.verboseFlag = verboseFlag;
        this.noPromptFlag = noPromptFlag;
        this.noWarningsFlag = noWarningsFlag;

        this.startTime = new Date();

        if (quietFlag) {
            this.uxLoggerVerbosity = LOG_MESSAGE_VERBOSITY.NONE;
        } else if (conciseFlag) {
            this.uxLoggerVerbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
        } else if (verboseFlag) {
            this.uxLoggerVerbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
        } else {
            this.uxLoggerVerbosity = LOG_MESSAGE_VERBOSITY.NORMAL;
        }

        this.uxLoggerLevel = (<any>LoggerLevel)[String(logLevelFlag).toUpperCase()];

        if (command) {
            let pinfo = Common.getPluginInfo(command);
            this.commandFullName = pinfo.pluginName + ":" + pinfo.commandName;
        } else {
            this.commandFullName = "unknown";
        }

        this.fileLogger = new FileLogger(
            this.resources,
            path.join(rootPath, CONSTANTS.FILE_LOG_SUBDIRECTORY),
            `${Common.formatFileDate(new Date())}.${CONSTANTS.FILE_LOG_FILEEXTENSION}`,
            fileLogFlag
        );

        this.commandEnterMessage();

    }




    /**
     * Prompts the user and returns value entered by the user
     *
     * @param {string} message Message to prompt the user
     * @param {string} [options=getMessage('defaultPromptOptions')]  Options to choose, like 'y/n'
     * @param {string} [default=getMessage('defaultPromptSelectedOption')]  Default option if nothing entered, like 'n'
     * @param {number} [timeout=6000] Timeout in ms if user does not respond
     * @param {...string[]} tokens Tokens for the command resource
     * @returns {Promise<string>} 
     * @memberof MessageUtils
     */
    async promptAsync(params: {
        message: string,
        options?: string,
        default?: string,
        timeout?: number
    }, ...tokens: string[]
    ): Promise<string> {

        params.options = params.options || this.getResourceString(RESOURCES.defaultPromptOptions);
        params.default = params.default || this.getResourceString(RESOURCES.defaultPromptSelectedOption);
        params.timeout = params.timeout || CONSTANTS.DEFAULT_USER_PROMPT_TIMEOUT_MS;
        params.message = this.getResourceString.apply(this, [params.message, ...tokens]);

        if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.NONE || this.noPromptFlag) {
            // Suppress propmts on --quite or --noprompt, immediately send the default value
            return params.default;
        }

        try {
            params.message = this.getResourceString.apply(this, [params.message, ...tokens]);

            return await this.uxLogger.prompt(this.getResourceString(RESOURCES.promptMessageFormat, String(params.message), params.options), {
                default: this.getResourceString(RESOURCES.promptDefaultOptionFormat, params.default),
                timeout: params.timeout
            });
        } catch (ex) {
            return params.default;
        }

    }

    /**
    * Outputs simple "yes"/"no" prompt.
    * If user has not responded - the default option ("no") is applied
    *
    * @param {string} message  Message to prompt the user
    * @returns {Promise<boolen>} Returns true if user has choosen "yes"
    * @memberof MessageUtils
    */
    async yesNoPromptAsync(message: string, ...tokens: string[]): Promise<boolean> {
        return (await this.promptAsync.apply(this, [{
            message
        }, ...tokens])) != this.getResourceString(RESOURCES.defaultPromptSelectedOption);
    }

    /**
     * Outputs message to sfdx ux and to the log file
     *
     * @param {(string | object | ITableMessage)} message Message to output
     * @param {LOG_MESSAGE_TYPE} [type] The type of the message (Default to STRING)
     * @param {LOG_MESSAGE_VERBOSITY} [verbosity] The verbosity type of the message (Default to NORMAL)
     * @param {...string[]} tokens Tokens for the command resource
     * @returns {void}
     * @memberof MessageUtils
     */
    log(message: string | object | ITableMessage,
        type?: LOG_MESSAGE_TYPE,
        verbosity?: LOG_MESSAGE_VERBOSITY,
        ...tokens: string[]
    ): void {

        type = type || LOG_MESSAGE_TYPE.STRING;
        verbosity = verbosity || LOG_MESSAGE_VERBOSITY.NORMAL;

        if (typeof message == "undefined"
            || message == null) {
            return;
        }

        // Try to fetch message string from the resource
        message = this.getResourceString.apply(this, [message, ...tokens]);

        // Check verbosity 
        let allowUxOutput = true;
        if ([LOG_MESSAGE_TYPE.ERROR,
        LOG_MESSAGE_TYPE.IMPORTANT_JSON,
        LOG_MESSAGE_TYPE.IMPORTANT_STRING,
        LOG_MESSAGE_TYPE.IMPORTANT_OBJECT,
        LOG_MESSAGE_TYPE.WARN].indexOf(type) < 0) {
            if (this.uxLoggerVerbosity < verbosity) {
                allowUxOutput = false;
            }
        }

        // Format the message
        let fileLogMessage: string;
        let uxLogMessage = <string | object>message;

        if ([LOG_MESSAGE_TYPE.IMPORTANT_JSON,
        LOG_MESSAGE_TYPE.JSON,
        LOG_MESSAGE_TYPE.OBJECT,
        LOG_MESSAGE_TYPE.TABLE].indexOf(type) >= 0) {
            // Message should be an object ****
            if (typeof message !== "object") {
                // A string - incorrect --
                try {
                    // Try to treat the message as json string                    
                    uxLogMessage = JSON.parse(String(message));
                    // Stringify to compress json string back if originally it was prettified
                    fileLogMessage = JSON.stringify(uxLogMessage);
                } catch (ex) {
                    // Message in unknown string format
                    uxLogMessage = String(message);
                    fileLogMessage = uxLogMessage;
                }
            } else {
                // An object - correct ---
                try {
                    //Json string
                    fileLogMessage = JSON.stringify(message);
                } catch (ex) {
                    // Unknown format
                    fileLogMessage = String(message);
                }
            }
        } else {
            // Message should be a string ***
            if (typeof message === "object") {
                // An object - incorrect --
                try {
                    // Try to convert to json string
                    uxLogMessage = JSON.stringify(message);
                } catch (ex) {
                    // Treat the message as unknown object format
                    uxLogMessage = String(message);
                }
            } else {
                // A string - correct --
                uxLogMessage = String(message);
            }
            // Always a string
            fileLogMessage = String(uxLogMessage);
        }
        // Get the date string
        let dateString = Common.formatDateTime(new Date());
        let uxOutput: any;

        switch (type) {

            case LOG_MESSAGE_TYPE.ERROR:
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(RESOURCES.loggerErrorStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(RESOURCES.loggerErrorString, <string>uxLogMessage);
                    }
                    this.uxLogger.error(uxOutput);
                }
                this.fileLogger.error(fileLogMessage);
                break;

            case LOG_MESSAGE_TYPE.HEADER:
                if (allowUxOutput) {
                    this.uxLogger.styledHeader(String(uxLogMessage).toUpperCase());
                }
                this.fileLogger.log(String(fileLogMessage).toUpperCase());
                break;

            case LOG_MESSAGE_TYPE.IMPORTANT_JSON:
                if (allowUxOutput) {
                    this.uxLogger.styledJSON(uxLogMessage);
                }
                this.fileLogger.log(fileLogMessage);
                break;

            case LOG_MESSAGE_TYPE.IMPORTANT_STRING:
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(RESOURCES.loggerImportantInfoStringWithDate, dateString, <string>uxLogMessage);
                    }
                    else {
                        uxOutput = this.getResourceString(RESOURCES.loggerImportantInfoString, <string>uxLogMessage);
                    }
                    this.uxLogger.log(uxOutput);
                }
                this.fileLogger.log(fileLogMessage);
                break;


            case LOG_MESSAGE_TYPE.JSON:
                if (allowUxOutput) {
                    this.uxLogger.styledJSON(uxLogMessage);
                }
                this.fileLogger.log(fileLogMessage);
                break;

            case LOG_MESSAGE_TYPE.IMPORTANT_OBJECT:
            case LOG_MESSAGE_TYPE.OBJECT:
                if (allowUxOutput) {
                    this.uxLogger.styledObject(uxLogMessage);
                }
                this.fileLogger.log(fileLogMessage);
                break;

            case LOG_MESSAGE_TYPE.TABLE:
                if (allowUxOutput) {
                    this.uxLogger.table((<ITableMessage>message).tableBody, {
                        columns: (<ITableMessage>message).tableColumns
                    });
                }
                this.fileLogger.log(fileLogMessage);
                break;

            case LOG_MESSAGE_TYPE.WARN:
                if (allowUxOutput && !this.noWarningsFlag) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(RESOURCES.loggerWarnStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(RESOURCES.loggerWarnString, <string>uxLogMessage);
                    }
                    this.uxLogger.warn(uxOutput);
                }
                this.fileLogger.warn(fileLogMessage);
                break;

            default: // STRING
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(RESOURCES.loggerInfoStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(RESOURCES.loggerInfoString, <string>uxLogMessage);
                    }
                    this.uxLogger.log(uxOutput);
                }
                this.fileLogger.log(fileLogMessage);
                break;

        }

    }

    /**
     * Logs info string message in NORMAL verbosity
     *
     * @param {(string | object | ITableMessage)} message
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    infoNormal(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
    }

    /**
     * Logs info string message in MINIMAL verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    infoMinimal(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.MINIMAL, ...tokens]);
    }

    /**
     * Logs info string message in VERBOSE verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    infoVerbose(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.VERBOSE, ...tokens]);
    }

    /**
     * Logs message as styled header  and MINIMAL verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    headerMinimal(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.HEADER, LOG_MESSAGE_VERBOSITY.MINIMAL, ...tokens]);
    }

    /**
     * Logs message as styled header  and NORMAL verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    headerNormal(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.HEADER, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
    }

    /**
     * Logs message as styled object and NORMAL verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    objectNormal(message: object): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.OBJECT, LOG_MESSAGE_VERBOSITY.NORMAL]);
    }

    /**
     * Logs message as styled object and MINIMAL verbosity
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    objectMinimal(message: object): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.OBJECT, LOG_MESSAGE_VERBOSITY.MINIMAL]);
    }

    /**
     * Logs warn string message
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    warn(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.WARN, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
    }

    /**
     * Logs error string message
     *
     * @param {string} message Message to output
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    error(message: string, ...tokens: string[]): void {
        this.log.apply(this, [message, LOG_MESSAGE_TYPE.ERROR, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
    }

    /**
     * Logs message when command is starting
     *
     * @memberof MessageUtils
     */
    commandEnterMessage(): void {

        if (this.uxLoggerVerbosity != LOG_MESSAGE_VERBOSITY.VERBOSE) {
            this.uxLogger.startSpinner(this.getResourceString(RESOURCES.commandInProgress));
        }

        this.log(
            this.getResourceString(RESOURCES.loggerCommandStartedString, this.commandFullName),
            LOG_MESSAGE_TYPE.STRING,
            LOG_MESSAGE_VERBOSITY.NORMAL
        );
    }

    /**
     * Method to update ux spinner
     *
     * @param {string} message Message to set to the spinner
     * @param {...string[]} tokens 
     * @memberof MessageUtils
     */
    spinner(message: string, ...tokens: string[]): void {
        message = this.getResourceString.apply(this, [message, ...tokens]);
        if (!message) {
            this.uxLogger.stopSpinner();
        } else {
            this.uxLogger.setSpinnerStatus(message);
        }
    }

    /**
     * Logs result message when command is finishing
     *
     * @param {string | object} message Result message as string or as object.
     *                                  When --json = true the method always prints formatted json.
     *                                  When --json = false the method prints formatted object or plain text
     *                                    according to the type of the message object.
     * @param {COMMAND_EXIT_STATUSES} status Status of the command
     * @param {string} [stack] Stack trace to output as text along with the string message 
     *                         in case of unknown error or --logLevel = trace.
     *                         Json output will aways contain stack trace regardless --loglevel value.
     * @param {...string[]} tokens Tokens for the command resource
     * @memberof MessageUtils
     */
    commandExitMessage(message: string | object,
        status: COMMAND_EXIT_STATUSES,
        stack?: string,
        ...tokens: string[]
    ): void {

        this.uxLogger.stopSpinner();

        if (typeof message == "undefined"
            || message == null) {
            return;
        }

        // Try to fetch message string from the resource
        let plainMessageString = "";

        message = this.getResourceString.apply(this, [message, ...tokens]);

        if (typeof message !== "object") {
            plainMessageString = <string>message;
        } else {
            plainMessageString = JSON.stringify(message);
        }

        let statusString = COMMAND_EXIT_STATUSES[status].toString();
        let endTime = new Date();
        let timeElapsedString = Common.timeDiffString(this.startTime, endTime);

        if (this.jsonFlag) {
            // As JSON ....
            if (status == COMMAND_EXIT_STATUSES.SUCCESS) {
                // Success
                // Full success result to stdout
                this.log(<IExitSuccessMessage>{
                    command: this.commandFullName,
                    cliCommandString: Common.getFullCommandLine(),
                    endTime: Common.convertUTCDateToLocalDate(endTime),
                    endTimeUTC: endTime,
                    result: message,
                    startTime: Common.convertUTCDateToLocalDate(this.startTime),
                    startTimeUTC: this.startTime,
                    status: status,
                    statusString: statusString,
                    timeElapsed: timeElapsedString
                }, LOG_MESSAGE_TYPE.IMPORTANT_JSON);

            } else {
                // Error
                // Full error resut to stdout
                this.log(<IExitFailedMessage>{
                    command: this.commandFullName,
                    cliCommandString: Common.getFullCommandLine(),
                    endTime: Common.convertUTCDateToLocalDate(endTime),
                    endTimeUTC: endTime,
                    message: message,
                    stack: stack,
                    startTime: Common.convertUTCDateToLocalDate(this.startTime),
                    startTimeUTC: this.startTime,
                    status: status,
                    statusString: statusString,
                    timeElapsedString: timeElapsedString
                }, LOG_MESSAGE_TYPE.IMPORTANT_JSON);
            }

        } else {
            // As STRING OR OBJECT ....
            stack = (this.uxLoggerLevel == LoggerLevel.TRACE
                || status == COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR)
                && stack;

            if (typeof message !== "object") {
                // As STRING...
                if (status == COMMAND_EXIT_STATUSES.SUCCESS) {
                    // Success
                    // Success result only to stdout
                    this.log(message, LOG_MESSAGE_TYPE.IMPORTANT_STRING);

                } else {
                    // Error
                    // Error message only to stderr
                    this.log(plainMessageString, LOG_MESSAGE_TYPE.ERROR);
                    // Stack trace to stdout
                    if (stack) {
                        this.log(
                            this.getResourceString(RESOURCES.loggerStackTraceString, stack),
                            LOG_MESSAGE_TYPE.IMPORTANT_STRING
                        );
                    }
                }

            } else {
                // As FORMATTED OBJECT...
                // Success result as formatted object to stdout
                this.log(message, LOG_MESSAGE_TYPE.IMPORTANT_OBJECT);

                if (status != COMMAND_EXIT_STATUSES.SUCCESS) {
                    // Error
                    // Error message only to stderr
                    this.log(plainMessageString, LOG_MESSAGE_TYPE.ERROR);
                    // Stack trace to stdout
                    if (stack) {
                        this.log(
                            this.getResourceString(RESOURCES.loggerStackTraceString, stack),
                            LOG_MESSAGE_TYPE.IMPORTANT_STRING
                        );
                    }
                }
            }

            // "Command finished" to stdout
            this.log(
                this.getResourceString(RESOURCES.loggerCommandCompletedString, this.commandFullName, String(status), statusString),
                LOG_MESSAGE_TYPE.STRING,
                LOG_MESSAGE_VERBOSITY.NORMAL
            );

            // "Time elapsed" to stdout 
            this.log(
                this.getResourceString(RESOURCES.loggerTimeElapsedString, timeElapsedString),
                LOG_MESSAGE_TYPE.STRING,
                LOG_MESSAGE_VERBOSITY.NORMAL
            );

        }
    }

    /**
     * Try to get string from the plugin resources using input message value as a key.
     * If resource with given key does not exist returns original input string.
     *
     * @private
     * @param {*} message Message to process
     * @param {...string[]} tokens Tokens for the command resource
     * @returns {*}
     * @memberof MessageUtils
     */
    getResourceString(message: any, ...tokens: string[]): any {
        if (!message || typeof message != "string") return message;
        try {
            let mes = this.resources.getMessage(String(message), tokens);
            return mes;
        } catch (ex) {
            try {
                let mes = this.commandMessages.getMessage(String(message), tokens);
                return mes;
            } catch (ex) {
                return message;
            }
        }
    }

    /**
     * @static Returns resource string from the Messages framework by the given key
     * 
     * @param {Messages} messages The instance of Messages
     * @param {string} key The key of the resource
     * @param {...string[]} tokens Tokens for the resource
     * @returns {string}
     * @memberof MessageUtils
     */
    public static getMessagesString(messages: Messages, key: string, ...tokens: string[]): string {
        try {
            return messages.getMessage(String(key), tokens);
        } catch (ex) {
            return "";
        }
    }

    /**
     * Gets difference value from the startTime till timeNow in human readable format
     *
     * @param {Date} [timeNow] The now time to calculate the diff
     * @returns {string} String representation of date diff
     * @memberof MessageUtils
     */
    getFormattedElapsedTimeString(timeNow?: Date): string {
        timeNow = timeNow || new Date();
        return Common.timeDiffString(this.startTime, timeNow);
    }

    /**
     * Returns time when the process was started
     *
     * @returns {Date}
     * @memberof MessageUtils
     */
    getStartTime(): Date {
        return this.startTime;
    }

}

/**
 * Type of message
 *
 * @export
 * @enum {number}
 */
export enum LOG_MESSAGE_TYPE {

    /**
     * Info string to stdout (including date on --verbose)
     */
    STRING,

    /**
     * Error string to stderr (including date on --verbose)
     * Always is sent, even when --quite.
     */
    ERROR,

    /**
     * Warn string to stderr (including date on --verbose)
     * Always is sent, even when --quite.
     */
    WARN,

    /**
     * Formatted table to stdout (without date)
     */
    TABLE,

    /**
     * Formatted json to stdout (without date)
     */
    JSON,

    /**
     * Formatted object to stdout (without date)
     */
    OBJECT,

    /**
     * Formatted header to stdout (without date)
     */
    HEADER,

    /**
     * * Formatted json to stdout (without date)
     *   Always is sent, even when --quite.
     */
    IMPORTANT_JSON,

    /**
     * * Info string to stdout (including date on --verbose)
     *   Always is sent, even when --quite.
     */
    IMPORTANT_STRING,

    /**
     * * Formatted object to stdout (without date)
     *   Always is sent, even when --quite.
     */
    IMPORTANT_OBJECT
}

/**
 * The wanted verbosity defined by the command flags or the verbosity of the message
 *
 * @export
 * @enum {number}
 */
export enum LOG_MESSAGE_VERBOSITY {

    /** Message not to display */
    NONE = 0,

    /** Minimal verbosity message */
    MINIMAL = 1,

    /** Normal verboisty message */
    NORMAL = 2,

    /** High verbosity message */
    VERBOSE = 3

}

/**
 * UX Logger type description
 *
 * @interface ISfdxUxLogger
 */
interface IUxLogger {
    log: Function,
    styledJSON: Function,
    warn: Function,
    error: Function,
    styledObject: Function,
    table: Function,
    prompt: Function,
    styledHeader: Function,
    startSpinner: Function,
    stopSpinner: Function,
    setSpinnerStatus: Function
}

/**
 * Represents message bundle type
 *
 * @interface IResourceBundle
 */
interface IResourceBundle {
    getMessage(key: string, tokens?: any): string;
}

/**
 * Tabular message description
 *
 * @interface ITableMessage
 */
interface ITableMessage {
    tableBody: Array<object>,
    tableColumns: Array<{
        key: string,
        label: string,
        width?: number
    }>
}

/**
 * Format of output message for successful command result
 *
 * @interface IExitSuccessMessage
 */
interface IExitSuccessMessage {
    command: string,
    cliCommandString: string,
    result: string,
    status: number,
    statusString: string,
    startTime: Date,
    startTimeUTC: Date,
    endTime: Date,
    endTimeUTC: Date,
    timeElapsed: string
}

/**
 * Format of output message for failed command result
 *
 * @interface IExitFailedMessage
 */
interface IExitFailedMessage {
    command: string,
    cliCommandString: string,
    message: string,
    stack: string,
    status: number,
    statusString: string,
    startTime: Date,
    startTimeUTC: Date,
    endTime: Date,
    endTimeUTC: Date,
    timeElapsedString: string
}

/**
 * Exit status codes are passed to the command output
 * when the command completed
 *
 * @enum {number}
 */
export enum COMMAND_EXIT_STATUSES {
    SUCCESS = 0,
    COMMAND_UNEXPECTED_ERROR = 1,
    COMMAND_INITIALIZATION_ERROR = 2,
    ORG_METADATA_ERROR = 3,
    COMMAND_EXECUTION_ERROR = 4,
    COMMAND_ABORTED_BY_USER = 5,
    UNRESOLWABLE_WARNING = 6
}











