/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

import { IAppLogger } from '../../app/appModels';
import { ITableMessage } from '../../models/common_models/helper_interfaces';
import ISfdmuCommand from '../../models/common_models/ISfdxCommand';
import { Common } from './common';
import { CONSTANTS } from './statics';



// ------ Resources --------//
// ----------------------//
export enum RESOURCES {

  newLine = "newLine",
  separator = "separator",
  source = "Source",
  target = "Target",
  step1 = "step1",
  step2 = "step2",
  pass1 = "pass1",
  pass2 = "pass2",
  pass3 = "pass3",
  pass4 = "pass4",
  objectSetStarted = "objectSetStarted",
  csvFile = "csvFile",
  org = "org",
  sourceOrg = "sourceOrg",
  targetOrg = "targetOrg",
  scriptFile = "scriptFile",
  noRecords = "noRecords",
  insert = "insert",
  update = "update",
  personContact = "personContact",
  customAddon = "customAddon",
  cantLoad = "cantLoad",
  global = "global",
  cantLoadModule = "cantLoadModule",
  actionNotPermitted = "actionNotPermitted",

  defaultPromptOptions = "defaultPromptOptions",
  defaultNopromptOption = "defaultNopromptOption",
  defaultPromptNoOption = "defaultPromptNoOption",
  userConfirmTemplate = "userConfirmTemplate",
  userTextInputTemplate = "userTextInputTemplate",

  formattedDateLogTemplate = "formattedDateLogTemplate",
  infoLogTemplate = "infoLogTemplate",
  warnLogTemplate = "warnLogTemplate",
  errorLogTemplate = "errorLogTemplate",

  traceLogTemplate = "traceLogTemplate",
  timeElapsedLogTemplate = "timeElapsedLogTemplate",
  commandStartTemplate = "commandStartTemplate",
  commandFinishTemplate = "commandFinishTemplate",

  infoFileLogTemplate = "infoFileLogTemplate",
  warnFileLogTemplate = "warnFileLogTemplate",
  errorFileLogTemplate = "errorFileLogTemplate",

  commandSucceededResult = "commandSucceededResult",
  commandInitializationErrorResult = "commandInitializationErrorResult",
  commandOrgMetadataErrorResult = "commandOrgMetadataErrorResult",

  commandExecutionErrorResult = "commandExecutionErrorResult",
  commandAbortedDueWarningErrorResult = "commandAbortedDueWarningErrorResult",
  commandAbortedByUserErrorResult = "commandAbortedByUserErrorResult",
  commandAbortedByAddOnErrorResult = "commandAbortedByAddOnErrorResult",
  commandAbortedDueUnexpectedErrorResult = "commandAbortedDueUnexpectedErrorResult",

  commandInProgress = "commandInProgress",
  packageScript = "packageScript",
  pluginVersion = "pluginVersion",
  runningVersion = "runningVersion",
  runningAddOnApiVersion = "runningAddOnApiVersion",
  workingPathDoesNotExist = "workingPathDoesNotExist",
  packageFileDoesNotExist = "packageFileDoesNotExist",
  loadingExportJson = "loadingExportJson",
  objectIsExcluded = "objectIsExcluded",
  noObjectsToProcess = "noObjectsToProcess",
  invalidOperation = "invalidOperation",
  noFieldsToUpdate = "noFieldsToUpdate",
  incorrectExportJsonFormat = "incorrectExportJsonFormat",
  exportJsonFileLoadError = "exportJsonFileLoadError",
  runningInSimulationMode = "runningInSimulationMode",

  connectingToOrg = "connectingToOrg",
  connectingToOrgSf = "connectingToOrgSf",
  successfullyConnected = "successfullyConnected",
  connectingFailed = "connectingFailed",
  cannotMigrateFile2File = "cannotMigrateFile2File",
  accessTokenExpired = "accessTokenExpired",
  malformedQuery = "malformedQuery",
  malformedDeleteQuery = "malformedDeleteQuery",
  personAccountSupportWarning = "personAccountSupportWarning",

  retrievingOrgMatadata = "retrievingOrgMatadata",
  retrievingObjectMetadata = "retrievingObjectMetadata",
  noExternalKey = "noExternalKey",
  missingObjectInSource = "missingObjectInSource",
  missingObjectInTarget = "missingObjectInTarget",
  processingObject = "processingObject",
  missingFieldInSource = "missingFieldInSource",
  missingFieldInTarget = "missingFieldInTarget",
  missingFieldsToProcess = "missingFieldsToProcess",
  addedMissingParentLookupObject = "addedMissingParentLookupObject",
  failedToResolveExternalId = "failedToResolveExternalId",
  fieldIsNotOfPolymorphicType = "fieldIsNotOfPolymorphicType",
  fieldMissingPolymorphicDeclaration = "fieldMissingPolymorphicDeclaration",
  theExternalIdNotFoundInTheQuery = "theExternalIdNotFoundInTheQuery",

  loadingCoreAddonManifestFile = "loadingCoreAddonManifestFile",
  loadingAddonModule = "loadingAddonModule",

  dataMigrationProcessStarted = "dataMigrationProcessStarted",
  buildingMigrationStaregy = "buildingMigrationStaregy",

  readingCsvFileError = "readingCsvFileError",
  writingCsvFileError = "writingCsvFileError",
  readingValuesMappingFile = "readingValuesMappingFile",
  readingFieldsMappingFile = "readingFieldsMappingFile",
  mappingCsvValues = "mappingCsvValues",
  mappingValues = "mappingValues",
  processingCsvFiles = "processingCsvFiles",
  processingCsvFilesSkipped = "processingCsvFilesSkipped",
  writingCsvFile = "writingCsvFile",
  correctCsvFiles = "correctCsvFiles",
  incorrectCsvFiles = "incorrectCsvFiles",
  continueTheJob = "continueTheJob",
  missingCsvFile = "missingCsvFile",
  missingColumnsInCsvFile = "missingColumnsInCsvFile",
  missingParentLookupRecords = "missingParentLookupRecords",
  cantUpdateChildLookupCSVColumn = "cantUpdateChildLookupCSVColumn",
  csvFilesWereUpdated = "csvFilesWereUpdated",
  validationCsvFileCompleted = "validationCsvFileCompleted",
  unableToDeleteTargetDirectory = "unableToDeleteTargetDirectory",
  unableToDeleteCacheDirectory = "unableToDeleteCacheDirectory",
  unableToDeleteSourceDirectory = "unableToDeleteSourceDirectory",
  canModifyPrompt = "canModifyPrompt",

  preparingJob = "preparingJob",
  executingJob = "executingJob",
  executionOrder = "executionOrder",
  queryingOrder = "queryingOrder",
  deletingOrder = "deletingOrder",

  unprocessedRecord = "unprocessedRecord",
  invalidRecordHashcode = "invalidRecordHashcode",
  apiOperationFailed = "apiOperationFailed",
  apiOperationFailedWithMessage = "apiOperationFailedWithMessage",
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
  simulationMode = "simulationMode",

  analysingData = "analysingData",
  totalRecordsAmountByQueryString = "totalRecordsAmountByQueryString",

  deletingTargetData = "deletingTargetData",
  deletingSourceData = "deletingSourceData",

  deletingTargetSObjectRecords = "deletingTargetSObjectRecords",
  deletingSourceSObjectRecords = "deletingSourceSObjectRecords",

  amountOfRecordsToDelete = "amountOfRecordsToDelete",
  deletingRecordsCompleted = "deletingRecordsCompleted",
  nothingToDelete = "nothingToDelete",
  nothingToDelete2 = "nothingToDelete2",

  deletingDataCompleted = "deletingDataCompleted",
  deletingDataSkipped = "deletingDataSkipped",

  mappingQuery = "mappingQuery",
  mappingSourceRecords = "mappingSourceRecords",
  mappingTargetRecords = "mappingTargetRecords",
  retrievingData = "retrievingData",
  retrievingDataCompleted = "retrievingDataCompleted",
  usingRestApi = "usingRestApi",
  usingBulkAPIQuery = "usingBulkAPIQuery",
  queryingAll = "queryingAll",
  queryingIn = "queryingIn",
  queryingIn2 = "queryingIn2",
  retrievingBinaryData = "retrievingBinaryData",
  queryingSelfReferenceRecords = "queryingSelfReferenceRecords",
  queryingFinished = "queryingFinished",
  amuntOfRetrievedRecords = "amuntOfRetrievedRecords",
  queryString = "queryString",
  fetchingSummary = "fetchingSummary",
  apiCallProgress = "apiCallProgress",

  updatingTarget = "updatingTarget",
  deletingTarget = "deletingTarget",
  updatePersonAccountsAndContacts = "updatePersonAccountsAndContacts",
  amountOfRecordsTo = "amountOfRecordsTo",
  updatingTargetObjectCompleted = "updatingTargetObjectCompleted",
  updatingTargetCompleted = "updatingTargetCompleted",
  writingToFile = "writingToFile",
  nothingUpdated = "nothingUpdated",
  skippedUpdatesWarning = "skippedUpdatesWarning",
  skippedTargetRecordsFilterWarning = "skippedTargetRecordsFilterWarning",
  missingParentLookupsPrompt = "missingParentLookupsPrompt",
  updatingSummary = "updatingSummary",
  updatingTotallyUpdated = "updatingTotallyUpdated",

  processingAddon = "processingAddon",
  runAddonMethod = "runAddonMethod",
  nothingToProcess = "nothingToProcess",
  startAddonExecution = "startAddonExecution",
  stopAddonExecution = "stopAddonExecution",
  coreAddonMessageTemplate = "coreAddonMessageTemplate",
  runAddonMethodCompleted = "runAddonMethodCompleted",
  comandAbortedByAddonResult = "comandAbortedByAddonResult",

  writingToCacheFile = "writingToCacheFile",
  readingFromCacheFile = "readingFromCacheFile"
}



// ------ Enumerations/types --------//
// ----------------------//
/**
 *STRING,SUCCESS,FAILURE,
 STDOUT_ONLY,TABLE,JSON,
 OBJECT,HEADER=30 => INFO level,

 WARN=40 => WARN level

 ERROR=50 => ERROR level

 */
export enum LOG_MESSAGE_TYPE {
  STRING = 30,
  SUCCESS = 31,
  FAILURE = 32,
  STDOUT_ONLY = 33,
  TABLE = 34,
  JSON = 35,
  OBJECT = 36,
  HEADER = 37,
  WARN = 40,
  ERROR = 50
}

export enum LOG_MESSAGE_VERBOSITY {
  ALWAYS = -1,
  NONE = 0,
  MINIMAL = 1,
  NORMAL = 2,
  VERBOSE = 3
}

export enum LOG_LEVEL {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
}
export interface IUxLogger {
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

export declare type Tokens = Array<string | boolean | number | null | undefined>;
export interface IMessages {
  getMessage(key: string, tokens?: Tokens): string;
}
export interface IResourceBundle {
  getMessage(key: string, tokens?: any): string;
}


export interface IFinishMessage {
  command: string,
  cliCommandString: string,
  message: string,
  fullLog: string[],
  stack: string[],
  status: number,
  statusString: string,
  startTime: Date,
  startTimeUTC: Date,
  endTime: Date,
  endTimeUTC: Date,
  timeElapsedString: string
}

export enum COMMAND_EXIT_STATUSES {
  SUCCESS = 0,
  COMMAND_UNEXPECTED_ERROR = 1,
  COMMAND_INITIALIZATION_ERROR = 2,
  ORG_METADATA_ERROR = 3,
  COMMAND_EXECUTION_ERROR = 4,
  COMMAND_ABORTED_BY_USER = 5,
  UNRESOLWABLE_WARNING = 6,
  COMMAND_ABORTED_BY_ADDON = 7,
}



// ------ File Logger --------//
// ---------------------------//
class FileLogger {

  fileName: string;

  resources: IResourceBundle;

  constructor(resources: IResourceBundle, filePath: string, fileName: string) {

    this.resources = resources;
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath);
    }
    this.fileName = path.join(filePath, fileName);
  }

  log(message: string, omitDate?: boolean) {
    message = message || "";
    const date = !omitDate && this.resources.getMessage(RESOURCES.formattedDateLogTemplate, [Common.formatDateTimeShort(new Date())]) || '';
    fs.appendFileSync(this.fileName, message.trim() ? this.resources.getMessage(RESOURCES.infoFileLogTemplate, [date, message]) : '\n');
  }

  warn(message: string, omitDate?: boolean) {
    message = message || "";
    const date = !omitDate && this.resources.getMessage(RESOURCES.formattedDateLogTemplate, [Common.formatDateTimeShort(new Date())]) || '';
    fs.appendFileSync(this.fileName, message.trim() ? this.resources.getMessage(RESOURCES.warnFileLogTemplate, [date, message]) : '\n')
  }

  error(message: string, omitDate?: boolean) {
    message = message || "";
    const date = !omitDate && this.resources.getMessage(RESOURCES.formattedDateLogTemplate, [Common.formatDateTimeShort(new Date())]) || '';
    fs.appendFileSync(this.fileName, message.trim() ? this.resources.getMessage(RESOURCES.errorFileLogTemplate, [date, message]) : '\n');
  }

}


// ------ Logger --------//
// ----------------------//
export class Logger implements IAppLogger {

  private _commandFullName: string;
  private _jsonFlag: boolean;
  private _silentFlag: boolean;
  private _filelogFlag: boolean;
  private _startTime: Date;
  private _fileLogger: FileLogger;
  private _noWarningsFlag: boolean;
  private _commandOutputMode: boolean;
  private _printStackTrace = false;

  private _resources: IResourceBundle;
  private _commandMessages: IResourceBundle;

  private _uxLogger: IUxLogger;
  private _uxLogLevel: LOG_LEVEL;
  private _uxLogVerbosity: LOG_MESSAGE_VERBOSITY

  private _noPromptFlag: boolean;
  private _spinnerIsStarted = false;

  private _messageCache: string[] = [];


  constructor(
    resources: IResourceBundle,
    commandMessages: IResourceBundle,
    uxLogger: IUxLogger,
    command: ISfdmuCommand,
    logLevelFlag: string,
    rootPath: string,
    verboseFlag: boolean,
    conciseFlag: boolean,
    quietFlag: boolean,
    jsonFlag: boolean,
    noPromptFlag: boolean,
    noWarningsFlag: boolean,
    fileLogFlag: boolean,
    commandOutputMode: boolean) {

    this._resources = resources;
    this._commandMessages = commandMessages;
    this._uxLogger = uxLogger;

    this._jsonFlag = jsonFlag;
    this._filelogFlag = fileLogFlag;
    this._noPromptFlag = noPromptFlag;
    this._noWarningsFlag = noWarningsFlag;
    this._silentFlag = quietFlag;
    this._commandOutputMode = commandOutputMode;

    this._startTime = new Date();

    if (quietFlag) {
      this._uxLogVerbosity = LOG_MESSAGE_VERBOSITY.NONE;
    } else if (conciseFlag) {
      this._uxLogVerbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
    } else if (verboseFlag) {
      this._uxLogVerbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
    } else {
      this._uxLogVerbosity = LOG_MESSAGE_VERBOSITY.NORMAL;
    }

    this._uxLogLevel = (<any>LOG_LEVEL)[String(logLevelFlag).toUpperCase()];

    if (this._uxLogLevel == LOG_LEVEL.DEBUG
      || this._uxLogLevel == LOG_LEVEL.TRACE) {
      this._printStackTrace = this._uxLogLevel == LOG_LEVEL.TRACE
      this._uxLogLevel = LOG_LEVEL.INFO;
    }

    if (this._uxLogLevel == LOG_LEVEL.FATAL) {
      this._uxLogLevel = LOG_LEVEL.ERROR;
    }

    if (command) {
      let pinfo = Common.getPluginInfo(command);
      this._commandFullName = pinfo.pluginName + ":" + pinfo.commandName;
    } else {
      this._commandFullName = "unknown";
    }

    this._fileLogger = new FileLogger(
      this._resources,
      path.join(rootPath, CONSTANTS.FILE_LOG_SUBDIRECTORY),
      `${Common.formatFileDate(new Date())}.${CONSTANTS.FILE_LOG_FILEEXTENSION}`
    );

    this.commandStartMessage();

  }


  // ------ Logging methods --------//
  // ----------------------//
  log(message: string | object | ITableMessage,
    logMessageType?: LOG_MESSAGE_TYPE,
    verbosity?: LOG_MESSAGE_VERBOSITY,
    ...tokens: string[]
  ): void {

    logMessageType = logMessageType || LOG_MESSAGE_TYPE.STRING;

    const isSuccess = logMessageType == LOG_MESSAGE_TYPE.SUCCESS;
    const isFailure = logMessageType == LOG_MESSAGE_TYPE.FAILURE;
    const isStdoutOnly = logMessageType == LOG_MESSAGE_TYPE.STDOUT_ONLY;

    logMessageType = isSuccess || isFailure || isStdoutOnly ? LOG_MESSAGE_TYPE.STRING : logMessageType;

    verbosity = typeof verbosity == 'undefined' ? LOG_MESSAGE_VERBOSITY.NORMAL : verbosity;

    if (typeof message == "undefined" || message == null) {
      return;
    }
    message = typeof message == 'string' ? this.getResourceString.apply(this, [message, ...tokens]) : message;

    let allowWriteLogsToMessageCache = true;

    const allowWriteLogsToSTdOut = (
      (verbosity <= this._uxLogVerbosity || verbosity == LOG_MESSAGE_VERBOSITY.ALWAYS)
      && (
        !this._jsonFlag
        || this._jsonFlag && logMessageType == LOG_MESSAGE_TYPE.JSON
      ) && this._uxLogVerbosity != LOG_MESSAGE_VERBOSITY.NONE
    ) || isStdoutOnly;

    const allowWriteLogsToFile = this._filelogFlag
      && logMessageType >= this._uxLogLevel
      && (
        !this._jsonFlag
        || (this._jsonFlag && logMessageType == LOG_MESSAGE_TYPE.JSON)
      );

    const omitDateWhenWriteLogsToFile = true;

    const date = message && !isStdoutOnly ? this.getResourceString(RESOURCES.formattedDateLogTemplate, Common.formatDateTimeShort(new Date())) : '';
    let logMessage: string;
    let foreColor = "";

    switch (logMessageType) {
      default: foreColor = isSuccess ? "\x1b[32m" : isFailure ? "\x1b[35m" : "\x1b[36m"; break;
      case LOG_MESSAGE_TYPE.HEADER: foreColor = "\x1b[38m"; break;
      case LOG_MESSAGE_TYPE.ERROR: foreColor = "\x1b[31m"; break;
      case LOG_MESSAGE_TYPE.WARN: foreColor = "\x1b[33m"; break;
    }

    switch (logMessageType) {

      default:
        logMessage = this.getResourceString(RESOURCES.infoLogTemplate, date, message as string);
        allowWriteLogsToSTdOut && this._uxLogger.log(foreColor + logMessage);
        break;

      case LOG_MESSAGE_TYPE.ERROR:
        logMessage = this.getResourceString(RESOURCES.errorLogTemplate, date, message as string);
        allowWriteLogsToSTdOut && this._uxLogger.error(foreColor + logMessage);
        break;

      case LOG_MESSAGE_TYPE.WARN:
        logMessage = this.getResourceString(RESOURCES.warnLogTemplate, date, message as string);
        allowWriteLogsToSTdOut && !this._noWarningsFlag && this._uxLogger.warn(foreColor + logMessage);
        allowWriteLogsToMessageCache = !this._noWarningsFlag;
        break;

      case LOG_MESSAGE_TYPE.TABLE:
        logMessage = String(message);
        allowWriteLogsToSTdOut && this._uxLogger.table((message as ITableMessage).tableBody, {
          columns: (message as ITableMessage).tableColumns
        });
        break;

      case LOG_MESSAGE_TYPE.JSON:
        logMessage = JSON.stringify(message, null, 3);
        allowWriteLogsToSTdOut && this._uxLogger.styledJSON(message);
        allowWriteLogsToMessageCache = !this._jsonFlag;
        break;

      case LOG_MESSAGE_TYPE.OBJECT:
        logMessage = JSON.stringify(message, null, 3);
        allowWriteLogsToSTdOut && this._uxLogger.styledObject(message);
        break;

      case LOG_MESSAGE_TYPE.HEADER:
        logMessage = String(message).toUpperCase();
        allowWriteLogsToSTdOut && this._uxLogger.styledHeader(foreColor + message);
        break;

    }

    allowWriteLogsToFile && this._fileLogger.log(logMessage, omitDateWhenWriteLogsToFile);
    allowWriteLogsToMessageCache && this._messageCache.push(logMessage);

  }

  infoNormal(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
  }

  infoMinimal(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.MINIMAL, ...tokens]);
  }

  infoVerbose(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.STRING, LOG_MESSAGE_VERBOSITY.VERBOSE, ...tokens]);
  }

  headerMinimal(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.HEADER, LOG_MESSAGE_VERBOSITY.MINIMAL, ...tokens]);
  }

  headerNormal(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.HEADER, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
  }

  headerVerbose(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.HEADER, LOG_MESSAGE_VERBOSITY.VERBOSE, ...tokens]);
  }

  objectNormal(message: object): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.OBJECT, LOG_MESSAGE_VERBOSITY.NORMAL]);
  }

  objectMinimal(message: object): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.OBJECT, LOG_MESSAGE_VERBOSITY.MINIMAL]);
  }

  warn(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.WARN, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
  }

  error(message: string, ...tokens: string[]): void {
    this.log.apply(this, [message, LOG_MESSAGE_TYPE.ERROR, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens]);
  }

  // ------ Prompt --------//
  // ----------------------//
  async promptAsync(params: {
    message: string,
    options?: string,
    default?: string,
    nopromptDefault?: string,
    timeout?: number
  }, ...tokens: string[]
  ): Promise<string> {

    params.nopromptDefault = (typeof params.nopromptDefault == 'undefined' ? this.getResourceString(RESOURCES.defaultNopromptOption) : params.nopromptDefault || "").trim();

    const date = this.getResourceString(RESOURCES.formattedDateLogTemplate, Common.formatDateTimeShort(new Date()));

    params.options = (typeof params.options == 'undefined' ? this.getResourceString(RESOURCES.defaultPromptOptions) : params.options || "").trim();
    params.default = (typeof params.default == 'undefined' ? this.getResourceString(RESOURCES.defaultPromptNoOption) : params.default || "").trim();
    params.message = date + " " + (this.getResourceString.apply(this, [params.message, ...tokens]) || "").trim();
    params.timeout = params.timeout || (params.options ? CONSTANTS.DEFAULT_USER_PROMPT_TIMEOUT_MS : CONSTANTS.DEFAULT_USER_PROMT_TEXT_ENTER_TIMEOUT_MS);

    params.message = this.getResourceString(
      params.options ? RESOURCES.userConfirmTemplate : RESOURCES.userTextInputTemplate,
      params.message,
      params.options);

    let result = params.default;

    try {
      if (this._uxLogVerbosity == LOG_MESSAGE_VERBOSITY.NONE
        || this._noPromptFlag
        || this._jsonFlag
        || this._silentFlag) {
        this.infoNormal(params.message + ' ' + params.nopromptDefault);
        result = params.nopromptDefault;
      } else {
        this.stopSpinner();
        result = await this._uxLogger.prompt(
          "\x1b[32m" + params.message,
          {
            default: params.default,
            timeout: params.timeout
          });
      }
    } catch (ex) { }
    finally {
      this.startSpinner();
    }

    return result;

  }

  async yesNoPromptAsync(message: string, ...tokens: string[]): Promise<boolean> {
    return (await this.promptAsync.apply(this, [{
      message
    }, ...tokens])) != this.getResourceString(RESOURCES.defaultPromptNoOption);
  }

  async textPromptAsync(message: string, ...tokens: string[]): Promise<string> {
    return (await this.promptAsync.apply(this, [{
      default: "",
      options: "",
      message
    }, ...tokens]));
  }



  // ------ Start/Stop --------//
  // ----------------------//
  commandStartMessage(): void {
    this.startSpinner();
    this.log(
      this.getResourceString(RESOURCES.commandStartTemplate, this._commandFullName),
      LOG_MESSAGE_TYPE.STRING,
      LOG_MESSAGE_VERBOSITY.MINIMAL
    );
  }

  commandFinishMessage(message: string | object,
    status: COMMAND_EXIT_STATUSES,
    stack?: string,
    ...tokens: string[]
  ): void {

    this.stopSpinner();

    if (typeof message == "undefined" || message == null) {
      return;
    }

    this.log('');

    const printStackTrace = this._printStackTrace && status == COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR && stack;
    let statusString = COMMAND_EXIT_STATUSES[status].toString();
    let endTime = new Date();
    let timeElapsedString = Common.timeDiffString(this._startTime, endTime);
    message = this.getResourceString(message, ...tokens);
    const stackArr = printStackTrace && stack.split('\n');

    if (this._jsonFlag) {
      // Summarized command result as JSON to stdout
      this.log({
        command: this._commandFullName,
        cliCommandString: Common.getFullCommandLine(),
        endTime: Common.convertUTCDateToLocalDate(endTime),
        endTimeUTC: endTime,
        message: message,
        fullLog: this._messageCache,
        stack: printStackTrace ? stackArr : [],
        startTime: Common.convertUTCDateToLocalDate(this._startTime),
        startTimeUTC: this._startTime,
        status: status,
        statusString: statusString,
        timeElapsedString: timeElapsedString
      } as IFinishMessage,
        LOG_MESSAGE_TYPE.JSON,
        LOG_MESSAGE_VERBOSITY.ALWAYS,
        ...tokens);

    } else {

      // Command result stdout
      this.log(String(message),
        status == COMMAND_EXIT_STATUSES.SUCCESS ? LOG_MESSAGE_TYPE.SUCCESS : LOG_MESSAGE_TYPE.ERROR,
        LOG_MESSAGE_VERBOSITY.MINIMAL,
        ...tokens);

      // Stack trace to stdout on error
      if (printStackTrace) {
        this.log(
          this.getResourceString(
            RESOURCES.traceLogTemplate,
            stack),
          LOG_MESSAGE_TYPE.ERROR,
          LOG_MESSAGE_VERBOSITY.MINIMAL
        );
      }

      // "Command finished" to stdout
      this.log(
        this.getResourceString(
          RESOURCES.commandFinishTemplate,
          this._commandFullName,
          String(status),
          statusString),
        status == COMMAND_EXIT_STATUSES.SUCCESS ? LOG_MESSAGE_TYPE.SUCCESS : LOG_MESSAGE_TYPE.ERROR,
        LOG_MESSAGE_VERBOSITY.MINIMAL
      );

      // "Time elapsed" to stdout
      this.log(
        this.getResourceString(
          RESOURCES.timeElapsedLogTemplate,
          timeElapsedString),
        LOG_MESSAGE_TYPE.STRING,
        LOG_MESSAGE_VERBOSITY.MINIMAL
      );

    }

    this._uxLogger.log("\x1b[37m");

  }

  // ------ Spinner --------//
  // ----------------------//
  spinner(message?: string, ...tokens: string[]): void {
    message = this.getResourceString.apply(this, [message, ...tokens]);
    if (!message) {
      this._spinnerIsStarted = false;
      this._uxLogger.stopSpinner();
    } else if (!this._spinnerIsStarted) {
      this._uxLogger.startSpinner(message);
      this._spinnerIsStarted = true;
    } else {
      this._uxLogger.setSpinnerStatus(message);
    }
  }

  startSpinner() {
    if (!this._commandOutputMode) {
      this.spinner(RESOURCES.commandInProgress);
    }
  }

  stopSpinner() {
    this.spinner();
  }


  // ------ Resources --------//
  // ----------------------//
  getResourceString(message: any, ...tokens: string[]): any {
    if (!message || typeof message != "string") return message;
    try {
      let mes = this._resources.getMessage(String(message), tokens);
      return mes;
    } catch (ex) {
      try {
        let mes = this._commandMessages.getMessage(String(message), tokens);
        return mes;
      } catch (ex) {
        return message;
      }
    }
  }



  // ------ Common --------//
  // ----------------------//
  getStartTime(): Date {
    return this._startTime;
  }

}














