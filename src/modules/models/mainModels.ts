/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import { Query } from 'soql-parser-js';
import { CommonUtils } from "../components/commonUtils";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../components/statics";
import { MessageUtils, RESOURCES } from "../components/messages";
import { CommandInitializationError } from "./errorsModels";
import { ApiSf } from "../components/apiSf";
var jsforce = require("jsforce");




// --------------------  Script ------------------------------// 
/**
 * The script object which is parsed from the script file
 *
 * @export
 * @class Script
 */
export class Script {

    @Type(() => ScriptOrg)
    orgs: ScriptOrg[] = new Array<ScriptOrg>();

    @Type(() => ScriptObject)
    objects: ScriptObject[] = new Array<ScriptObject>();

    pollingIntervalMs: number = CONSTANTS.DEFAULT_POLLING_INTERVAL_MS;
    bulkThreshold: number = CONSTANTS.DEFAULT_BULK_API_THRESHOLD_RECORDS;
    bulkApiVersion: string = CONSTANTS.DEFAULT_BULK_API_VERSION;
    bulkApiV1BatchSize: number = CONSTANTS.DEFAULT_BULK_API_V1_BATCH_SIZE;
    allOrNone: boolean = false;
    promptOnUpdateError: boolean = true;
    promptOnMissingParentObjects: boolean = true;
    validateCSVFilesOnly: boolean = false;
    encryptDataFiles: boolean = false;
    apiVersion: string = CONSTANTS.DEFAULT_API_VERSION;
    createTargetCSVFiles: boolean = true;
    importCSVFilesAsIs = false;


    // -----------------------------------
    logger: MessageUtils;
    sourceOrg: ScriptOrg;
    targetOrg: ScriptOrg;
    basePath: string = "";


    async initializeAsync(logger: MessageUtils, sourceUsername: string, targetUsername: string, basePath: string, apiVersion: string): Promise<any> {

        this.logger = logger;
        this.basePath = basePath;
        this.sourceOrg = this.orgs.filter(x => x.name == sourceUsername)[0] || new ScriptOrg();
        this.targetOrg = this.orgs.filter(x => x.name == targetUsername)[0] || new ScriptOrg();
        this.apiVersion = apiVersion || this.apiVersion;

        this.objects = this.objects.filter(object => {
            let isIncluded = !object.excluded || object.operation == OPERATION.Readonly;
            if (!isIncluded) {
                this.logger.infoVerbose(RESOURCES.objectWillBeExcluded, object.name);
            }
            return isIncluded;
        });

        if (this.objects.length == 0) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.noObjectsDefinedInPackageFile));
        }

        this.objects.forEach(object => {
            if ((typeof object.operation == "string") == true) {
                object.operation = OPERATION[object.operation.toString()];
            }
        });

        Object.assign(this.sourceOrg, {
            script: this,
            name: sourceUsername,
            isSource: true,
            media: sourceUsername.toLowerCase() == "csvfile" ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
        });
        Object.assign(this.targetOrg, {
            script: this,
            name: targetUsername,
            media: targetUsername.toLowerCase() == "csvfile" ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
        });

        await this.sourceOrg.initializeAsync();
        await this.targetOrg.initializeAsync();

    }
}




/**
 * The org object which is parsed from the script file 
 *
 * @export
 * @class ScriptOrg
 */
export class ScriptOrg {

    name: string = "";
    instanceUrl: string = "";
    accessToken: string = "";


    // -----------------------------------
    script: Script;
    media: DATA_MEDIA_TYPE.File;
    isSource: boolean = false;
    isPersonAccountEnabled: boolean = false;

    getConnection(): any {
        return new jsforce.Connection({
            instanceUrl: this.instanceUrl,
            accessToken: this.accessToken,
            version: this.script.apiVersion,
            maxRequest: CONSTANTS.MAX_CONCURRENT_PARALLEL_REQUESTS
        });
    }

    get isConnected(): boolean {
        return !!this.accessToken;
    }

    get isFileMedia(): boolean {
        return this.media == DATA_MEDIA_TYPE.File;
    }

    async initializeAsync(): Promise<any> {
        await this._verifyConnectionAsync();
    }




    // ---------------- Private members ---------------------------//
    // ------------------------------------------------------------//
    private _parseForceOrgDisplayResult(commandResult: String): OrgInfo {
        if (!commandResult) return null;
        let lines = commandResult.split('\n');
        let output: OrgInfo = new OrgInfo();
        lines.forEach(line => {
            if (line.startsWith("Access Token"))
                output.AccessToken = line.split(' ').pop();
            if (line.startsWith("Client Id"))
                output.ClientId = line.split(' ').pop();
            if (line.startsWith("Connected Status"))
                output.ConnectedStatus = line.split(' ').pop();
            if (line.startsWith("Status"))
                output.Status = line.split(' ').pop();
            if (line.startsWith("Id"))
                output.OrgId = line.split(' ').pop();
            if (line.startsWith("Instance Url"))
                output.InstanceUrl = line.split(' ').pop();
            if (line.startsWith("Username"))
                output.Username = line.split(' ').pop();
        });
        return output;
    };


    private async _validateAccessTokenAsync(): Promise<void> {
        let apiSf = new ApiSf(this);
        if (!this.isFileMedia) {
            try {
                await apiSf.queryAsync("SELECT Id FROM Account LIMIT 1", false);
            } catch (ex) {
                throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.accessToOrgExpired, this.name));
            }
            try {
                await apiSf.queryAsync("SELECT IsPersonAccount FROM Account LIMIT 1", false);
                this.isPersonAccountEnabled = true;
            } catch (ex) {
                this.isPersonAccountEnabled = false;
            }
        }
    }


    private async _verifyConnectionAsync(): Promise<void> {
        if (!this.isFileMedia) {
            if (!this.isConnected) {
                this.script.logger.infoNormal(RESOURCES.tryingToConnectCLI, this.name);
                let processResult = CommonUtils.execSfdx("force:org:display", this.name);
                let orgInfo = this._parseForceOrgDisplayResult(processResult);
                if (!orgInfo.isConnected) {
                    throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.tryingToConnectCLIFailed, this.name));
                } else {
                    Object.assign(this, {
                        accessToken: orgInfo.AccessToken,
                        instanceUrl: orgInfo.InstanceUrl
                    });
                }
            }

            await this._validateAccessTokenAsync();
            this.script.logger.infoNormal(RESOURCES.successfullyConnected, this.name);
        }
    }

}




/**
 * Parsed object from the script file 
 *
 * @export
 * @class ScriptObject
 */
export class ScriptObject {

    @Type(() => ScriptMockField)
    mockFields: ScriptMockField[] = new Array<ScriptMockField>();

    name: string = "";
    query: string = "";
    deleteQuery: string = "";
    operation: OPERATION = OPERATION.Readonly;
    externalId: string = "Name";
    deleteOldData: boolean = false;
    updateWithMockData: boolean = false;
    mockCSVData: boolean = false;
    targetRecordsFilter: string = "";
    excluded: boolean = false;
    useCSVValuesMapping: boolean = false;
    allRecords: boolean = true;


    // -----------------------------------
    sObjectDescribeSource = new SObjectDescribe();
    sObjectDescribeTarget = new SObjectDescribe();
    sourceFieldsMap = new Map<string, SFieldDescribe>();
    targetFieldsMap = new Map<string, SFieldDescribe>();

    initialize() {
        if ((typeof this.operation == "string") == true) {
            this.operation = <OPERATION>OPERATION[this.operation.toString()];
        }
    }
}




/**
 * Parsed mock field object from the script file
 *
 * @export
 * @class ScriptMockField
 */
export class ScriptMockField {
    name: string = "";
    pattern: string = "";
    excludedRegex: string = "";
    includedRegex: string = "";
}





// --------------------  Metadata Descriptions ------------------------------// 
/**
 * Description of the sobject
 *
 * @export
 * @class SObjectDescribe
 */
export class SObjectDescribe {
    name: string = "";
    label: string = "";
    updateable: boolean = false;
    createable: boolean = false;
    custom: boolean = false;
}



/**
 * Description of the sobject field
 *
 * @export
 * @class SFieldDescribe
 */
export class SFieldDescribe {

    name: string = "";
    type: string = "";
    label: string = "";
    updateable: boolean = false;
    creatable: boolean = false;
    cascadeDelete: boolean = false;
    autoNumber: boolean = false;
    custom: boolean = false;
    calculated: boolean = false;

    isReference: boolean = false;
    referencedObjectType: string = "";

    get isMasterDetail() {
        return this.isReference && (!this.updateable || this.cascadeDelete);
    }

    get isFormula() {
        return this.calculated;
    }

    get isReadonly() {
        return !(this.creatable && !this.isFormula && !this.autoNumber);
    }

    get isBoolean() {
        return this.type == "boolean";
    }

}



/**
 * Force:org:display command response 
 *
 * @export
 * @class OrgInfo
 */
export class OrgInfo {
    AccessToken: string;
    ClientId: string;
    ConnectedStatus: string;
    Status: string;
    OrgId: string;
    UserId: string;
    InstanceUrl: string;
    Username: string;

    get isConnected() {
        return this.ConnectedStatus == "Connected" || this.Status == "Active";
    }
}

