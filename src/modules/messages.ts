/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LoggerLevel } from '@salesforce/core';
import * as path from 'path';
import * as fs from 'fs';
import { CommonUtils } from './common';
import { SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';

const fileLogSubdirectory = "logs/";


/**
 * Keys from the common plugin resource file.
 *
 * @export
 * @enum {number}
 */
export enum COMMON_RESOURCES {


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


    fileLoggerInfoString = "fileLoggerInfoString",
    fileLoggerWarnSring = "fileLoggerWarnSring",
    fileLoggerErrorSring = "fileLoggerErrorSring",


    loggerImportantInfoString = "loggerImportantInfoString",
    loggerImportantInfoStringWithDate = "loggerImportantInfoStringWithDate",


    loggerStackTraceString = "loggerStackTraceString",


    loggerTimeElapsedString = "loggerTimeElapsedString",
    loggerCommandStartedString = "loggerCommandStartedString",
    loggerCommandCompletedString = "loggerCommandCompletedString",


    successfullyCompletedResult = "successfullyCompletedResult",
    commandInitializationErrorResult = "commandInitializationErrorResult",
    orgMetadataErrorResult = "orgMetadataErrorResult",
    commandExecutionErrorResult = "commandExecutionErrorResult",
    commandAbortedByUserErrorResult = "commandAbortedByUserErrorResult",
    commandUnexpectedErrorResult = "commandUnexpectedErrorResult",
    commandUnresolvableWarningResult = "commandUnresolvableWarningResult",

    commandInProgress = "commandInProgress",

    readyToInsert = "readyToInsert",
    readyToUpdate = "readyToUpdate",
    nothingToInsert = "nothingToInsert",
    nothingToUpdate = "nothingToUpdate",
    nothingToDelete = "nothingToDelete",

    usingBulkApi = "usingBulkApi",
    usingRestApi = "usingRestApi",
    usingQueryBulkApi = "usingQueryBulkApi",
    usingCollectionApi = "usingCollectionApi",
    apiOperationProgress = "apiOperationProgress",
    apiOperationCompleted = "apiOperationCompleted",
    apiOperationError = "apiOperationError",
    apiOperationError2 = "apiOperationError2",
    apiOperationError3 = "apiOperationError3",
    apiUnexpectedOperationError = "apiUnexpectedOperationError",
       
    jobStarted = "jobStarted",
    batchStarted = "batchStarted",
    jobStopped = "jobStopped",
    batchDataUploading = "batchDataUploading",
    batchDataProcessing = "batchDataProcessing",
    jobResultsRetrieving = "jobResultsRetrieving",
    jobError = "jobError"

}



/**
 * Class to manage file logs
 *
 * @class FileLogger
 */
class FileLogger {

    fileName: string;
    enabled: boolean;
    commonMessages: IResourceBundle;

    /**
     *Creates an instance of FileLogger.
     * @param {string} filePath Path to put log file there
     * @param {string} fileName Name of the log file without path
     * @param {boolean} enabled Enable/Disable the logging
     * @memberof FileLogger
     */
    constructor(commonMessages: IResourceBundle, filePath: string, fileName: string, enabled: boolean) {
        this.enabled = enabled;
        this.commonMessages = commonMessages;
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
            const d = CommonUtils.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.commonMessages.getMessage("fileLoggerInfoString", [d, message]);
            } else {
                m = this.commonMessages.getMessage("fileLoggerInfoStringWithoutDate", [message]);
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
            const d = CommonUtils.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.commonMessages.getMessage("fileLoggerWarnSring", [d, message]);
            } else {
                m = this.commonMessages.getMessage("fileLoggerWarnSringWithoutDate", [message]);
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
            const d = CommonUtils.formatDateTimeShort(new Date());
            let m: string;
            if (message.trim()) {
                m = this.commonMessages.getMessage("fileLoggerErrorSring", [d, message]);
            } else {
                m = this.commonMessages.getMessage("fileLoggerErrorSringWithoutDate", [message]);
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
export class MessageUtils {

    commandFullName: string;

    jsonFlag: boolean;

    startTime: Date;

    fileLogger: FileLogger;

    commonMessages: IResourceBundle;
    commandMessages: IResourceBundle;

    uxLogger: IUxLogger;
    uxLoggerLevel: LoggerLevel;
    uxLoggerVerbosity: LOG_MESSAGE_VERBOSITY

    verboseFlag: boolean;
    noPromptFlag: boolean;


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
     * @param {boolean} fileLogFlag --filelog command flag
     * @memberof MessageUtils
     */
    constructor(
        commonMessages: IResourceBundle,
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
        fileLogFlag: boolean) {

        this.commonMessages = commonMessages;
        this.commandMessages = commandMessages;
        this.uxLogger = uxLogger;

        this.jsonFlag = jsonFlag;
        this.verboseFlag = verboseFlag;
        this.noPromptFlag = noPromptFlag;


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
            let pinfo = CommonUtils.getPluginInfo(command);
            this.commandFullName = pinfo.pluginName + ":" + pinfo.commandName;
        } else {
            this.commandFullName = "unknown";
        }

        this.fileLogger = new FileLogger(
            this.commonMessages,
            path.join(rootPath, fileLogSubdirectory),
            `${CommonUtils.formatFileDate(new Date())}.log`,
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

        params.options = params.options || this.getResourceString(COMMON_RESOURCES.defaultPromptOptions);
        params.default = params.default || this.getResourceString(COMMON_RESOURCES.defaultPromptSelectedOption);
        params.timeout = params.timeout || 6000;
        params.message = this.getResourceString.apply(this, [params.message, ...tokens]);

        if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.NONE || this.noPromptFlag) {
            // Supress propmts on --quite or --noprompt, immediately send the default value
            return params.default;
        }

        try {
            params.message = this.getResourceString.apply(this, [params.message, ...tokens]);

            return await this.uxLogger.prompt(this.getResourceString(COMMON_RESOURCES.promptMessageFormat, String(params.message), params.options), {
                default: this.getResourceString(COMMON_RESOURCES.promptDefaultOptionFormat, params.default),
                timeout: params.timeout
            });
        } catch (ex) {
            return params.default;
        }

    }




    /**
    * Outputs simple yes/no prompt
    *
    * @param {string} message  Message to prompt the user
    * @returns {Promise<boolen>} Returns true if user has choosen 'y'
    * @memberof MessageUtils
    */
    async yesNoPromptAsync(message: string, ...tokens: string[]): Promise<boolean> {
        return this.promptAsync.apply(this, [{
            message
        }, ...tokens]) == this.getResourceString(COMMON_RESOURCES.defaultPromptSelectedOption);
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
        let dateString = CommonUtils.formatDateTime(new Date());
        let uxOutput: any;

        switch (type) {

            case LOG_MESSAGE_TYPE.ERROR:
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerErrorStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerErrorString, <string>uxLogMessage);
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
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerImportantInfoStringWithDate, dateString, <string>uxLogMessage);
                    }
                    else {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerImportantInfoString, <string>uxLogMessage);
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
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerWarnStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerWarnString, <string>uxLogMessage);
                    }
                    this.uxLogger.warn(uxOutput);
                }
                this.fileLogger.warn(fileLogMessage);
                break;

            default: // STRING
                if (allowUxOutput) {
                    let m = <string>uxLogMessage || "";
                    if (this.uxLoggerVerbosity == LOG_MESSAGE_VERBOSITY.VERBOSE && m.trim()) {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerInfoStringWithDate, dateString, <string>uxLogMessage);
                    } else {
                        uxOutput = this.getResourceString(COMMON_RESOURCES.loggerInfoString, <string>uxLogMessage);
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
     * Logs message as styled object and NORMAL verbosity
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
            this.uxLogger.startSpinner(this.getResourceString(COMMON_RESOURCES.commandInProgress));
        }

        this.log(
            this.getResourceString(COMMON_RESOURCES.loggerCommandStartedString, this.commandFullName),
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
        let timeElapsedString = CommonUtils.timeDiffString(this.startTime, endTime);

        if (this.jsonFlag) {
            // As JSON ....
            if (status == COMMAND_EXIT_STATUSES.SUCCESS) {
                // Success
                // Full success result to stdout
                this.log(<IExitSuccessMessage>{
                    command: this.commandFullName,
                    cliCommandString: CommonUtils.getFullCommandLine(),
                    endTime: CommonUtils.convertUTCDateToLocalDate(endTime),
                    endTimeUTC: endTime,
                    result: message,
                    startTime: CommonUtils.convertUTCDateToLocalDate(this.startTime),
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
                    cliCommandString: CommonUtils.getFullCommandLine(),
                    endTime: CommonUtils.convertUTCDateToLocalDate(endTime),
                    endTimeUTC: endTime,
                    message: message,
                    stack: stack,
                    startTime: CommonUtils.convertUTCDateToLocalDate(this.startTime),
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
                            this.getResourceString(COMMON_RESOURCES.loggerStackTraceString, stack),
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
                            this.getResourceString(COMMON_RESOURCES.loggerStackTraceString, stack),
                            LOG_MESSAGE_TYPE.IMPORTANT_STRING
                        );
                    }
                }
            }

            // "Command finished" to stdout
            this.log(
                this.getResourceString(COMMON_RESOURCES.loggerCommandCompletedString, this.commandFullName, String(status), statusString),
                LOG_MESSAGE_TYPE.STRING,
                LOG_MESSAGE_VERBOSITY.NORMAL
            );

            // "Time elapsed" to stdout 
            this.log(
                this.getResourceString(COMMON_RESOURCES.loggerTimeElapsedString, timeElapsedString),
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
            let mes = this.commonMessages.getMessage(String(message), tokens);
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
     *  Returns 
     *
     * @static
     * @param {Messages} messages The instance of Messages
     * @param {string} key The key of the common resource
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
        return CommonUtils.timeDiffString(this.startTime, timeNow);
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











