/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'fs';
import "reflect-metadata";
import "es6-shim";
import { plainToClass } from "class-transformer";
import {
    parseQuery,
    composeQuery,
    FieldType,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { MessageUtils, COMMON_RESOURCES, LOG_MESSAGE_VERBOSITY } from "../components/messages";
import * as models from '../models';
import { OPERATION } from '../components/statics';



/**
 * Tokens from the run.json resource file.
 * The tokens are used only by the current command.
 *
 * @enum {number}
 */
export enum RUN_RESOURCES {
    pluginVersion = "pluginVersion",
    newLine = "newLine",
    workingPathDoesNotExist = "workingPathDoesNotExist",
    packageFileDoesNotExist = "packageFileDoesNotExist",
    loadingPackageFile = "loadingPackageFile",
    objectWillBeExcluded = "objectWillBeExcluded",
    noObjectsDefinedInPackageFile = "noObjectsDefinedInPackageFile",
    sourceOrg = "sourceOrg",
    targetOrg = "targetOrg",
    scriptFile = "scriptFile",
    encryptionKey = "encryptionKey",
    invalidEncryptionKey = "invalidEncryptionKey",
    tryingToConnectCLI = "tryingToConnectCLI",
    successfullyConnected = "successfullyConnected",
    tryingToConnectCLIFailed = "tryingToConnectCLIFailed",
    sourceTargetCouldNotBeTheSame = "sourceTargetCouldNotBeTheSame",
    accessToSourceExpired = "accessToSourceExpired",
    accessToTargetExpired = "accessToTargetExpired",
    MalformedQuery = "MalformedQuery",
    MalformedDeleteQuery = "MalformedDeleteQuery",
    executingPackageScript = "executingPackageScript",
    preparing = "preparing",
    gettingOrgMetadata = "gettingOrgMetadata",
    noExternalKey = "noExternalKey",
    objectSourceDoesNotExist = "objectSourceDoesNotExist",
    objectTargetDoesNotExist = "objectTargetDoesNotExist",
    analysingOrgMetadata = "analysingOrgMetadata",
    processingSObject = "processingSObject",
    fieldSourceDoesNtoExist = "fieldSourceDoesNtoExist",
    fieldTargetDoesNtoExist = "fieldTargetDoesNtoExist",
    referencedFieldDoesNotExist = "referencedFieldDoesNotExist",
    dataMigrationProcessStarted = "dataMigrationProcessStarted",
    buildingMigrationStaregy = "buildingMigrationStaregy",
    executionOrder = "executionOrder",
    readingValuesMappingFile = "readingValuesMappingFile",
    validatingAndFixingSourceCSVFiles = "validatingAndFixingSourceCSVFiles",
    writingToCSV = "writingToCSV",
    noIssuesFoundDuringCSVValidation = "noIssuesFoundDuringCSVValidation",
    issuesFoundDuringCSVValidation = "issuesFoundDuringCSVValidation",
    continueTheJobPrompt = "continueTheJobPrompt",
    AbortedByTheUser = "AbortedByTheUser",
    csvFileIsEmpty = "csvFileIsEmpty",
    columnsMissingInCSV = "columnsMissingInCSV",
    csvFileForParentSObjectIsEmpty = "csvFileForParentSObjectIsEmpty",
    missingParentRecordForGivenLookupValue = "missingParentRecordForGivenLookupValue",
    invalidColumnFormat = "invalidColumnFormat",
    columnWillNotBeProcessed = "columnWillNotBeProcessed",
    csvFilesWereUpdated = "csvFilesWereUpdated",
    validationAndFixingsourceCSVFilesCompleted = "validationAndFixingsourceCSVFilesCompleted",
    deletingOldData = "deletingOldData",
    deletingTargetSObject = "deletingTargetSObject",
    queryingTargetSObject = "queryingTargetSObject",
    queryingTargetSObjectCompleted = "queryingTargetSObjectCompleted",
    deletingFromTheTargetNRecordsWillBeDeleted = "deletingFromTheTargetNRecordsWillBeDeleted",
    queryError = "queryError",
    deletingFromTheTargetCompleted = "deletingFromTheTargetCompleted",
    deletingOldDataCompleted = "deletingOldDataCompleted",
    deletingOldDataSkipped = "deletingOldDataSkipped",
    retrievingData = "retrievingData",
    mappingRawCsvValues = "mappingRawCsvValues",
    gettingRecordsCount = "gettingRecordsCount",
    totalRecordsAmount = "totalRecordsAmount",
    queryingAll = "queryingAll",
    queryingAllQueryString = "queryingAllQueryString",
    queryingIn = "queryingIn",
    queryingFinished = "queryingFinished",
    executingQuery = "executingQuery",
    retrievingDataCompleted = "retrievingDataCompleted",
    Step1 = "Step1",
    Step2 = "Step2",
    updatingTarget = "updatingTarget",
    writingToFile = "writingToFile",
    writingToFileCompleted = "writingToFileCompleted",
    updatingTargetObject = "updatingTargetObject",
    updatingTargetObjectCompleted = "updatingTargetObjectCompleted",
    fieldIsMissingInTheSourceRecords = "fieldIsMissingInTheSourceRecords",
    seeFileForTheDetails = "seeFileForTheDetails",
    missingParentLookupRecord = "missingParentLookupRecord",
    updatingTargetCompleted = "updatingTargetCompleted",
    finalizing = "finalizing"
}




/**
 * Class to process SFDMU:RUN CLI command
 *
 * @export
 * @class RunCommand
 */
export class RunCommand {

    logger: MessageUtils;
    basePath: string;
    targetUsername: string;
    sourceUsername: string;
    apiVersion: string;
    script: models.Script;

    /**
     *Creates an instance of RunCommand.
     * @param {MessageUtils} logger The MessageUtils instance
     * @param {string} basePath The absolute or relative path where the export.json file does exist (from the command line)
     * @param {string} sourceUsername The username/SFDX instance name of the source env (from the command line)
     * @param {string} targetUsername The username/SFDX instance name of the target env (from the command line)
     * @param {string} apiVersion The sf api version to use across all api operations (from the command line)
     * @memberof RunCommand
     */
    constructor(logger: MessageUtils,
        basePath: string,
        sourceUsername: string,
        targetUsername: string,
        apiVersion: string) {

        this.logger = logger;
        this.basePath = path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath.toString());
        this.basePath = this.basePath.replace(/([^"]+)(.*)/, "$1");
        this.targetUsername = targetUsername;
        this.sourceUsername = sourceUsername;
        this.apiVersion = apiVersion;
    }

    loadScript(){

        if (!fs.existsSync(this.basePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.workingPathDoesNotExist));
        }
        let filePath = path.join(this.basePath, 'export.json');

        if (!fs.existsSync(filePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.packageFileDoesNotExist));
        }

        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.loadingPackageFile);

        let json = fs.readFileSync(filePath, 'utf8');
        let jsonObject = JSON.parse(json);
        this.script = plainToClass(models.Script, jsonObject);
        if (this.apiVersion) {
            this.script.apiVersion = this.apiVersion;
        }
        this.script.objects = this.script.objects.filter(object => {
            let isIncluded = !object.excluded || object.operation == OPERATION.Readonly;
            if (!isIncluded) {
                this.logger.infoVerbose(RUN_RESOURCES.objectWillBeExcluded, object.name);
            }
            return isIncluded;
        });
        this.script.initialize(this.sourceUsername, this.targetUsername);
    }
    


}












