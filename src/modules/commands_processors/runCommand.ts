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




}












