/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var jsforce = require("jsforce");
import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import * as SfdmModels from "../models";
import { CONSTANTS } from "../models";


/**
 * Class that represents Salesforce organization
 *
 * @export
 * @class SOrg
 */
export class SOrg {

    constructor(name: string, accessToken: string, instanceUrl: string, basePath: string, mediaType: SfdmModels.Enums.DATA_MEDIA_TYPE, isSource: boolean) {

        this.name = name;
        this.accessToken = accessToken;
        this.instanceUrl = instanceUrl;
        this.basePath = basePath;
        this.mediaType = mediaType;
        this.isSource = isSource;

        this.sObjectsMap = new Map<string, SObjectDescribe>();
    }

    accessToken: string;
    name: string;
    instanceUrl: string;
    version: string;
    maxRequest: number = 1000000;

    pollingIntervalMs: number;
    bulkApiVersion: string;
    bulkThreshold: number;
    bulkApiV1BatchSize: number;
    allOrNone: boolean;

    @Type(() => SObjectDescribe)
    sObjectsMap: Map<string, SObjectDescribe>;

    basePath: string;
    isSource: boolean;


    mediaType: SfdmModels.Enums.DATA_MEDIA_TYPE = SfdmModels.Enums.DATA_MEDIA_TYPE.Org;

    isPersonAccountEnabled: boolean = false;

    createTargetCSVFiles : boolean;

    getConnection(): any {
        return new jsforce.Connection({
            instanceUrl: this.instanceUrl,
            accessToken: this.accessToken,
            version: this.version,
            maxRequest: this.maxRequest
        });
    }

    isEquals(anotherOrg: SOrg) {
        if (this.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org
            && anotherOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org)
            return this.name == anotherOrg.name;
        return this.mediaType == anotherOrg.mediaType;
    }

}



/**
 * Class that represents sObject
 *
 * @export
 * @class SObjectDescribe
 */
export class SObjectDescribe {

    constructor(init?: Partial<SObjectDescribe>) {
        Object.assign(this, init);
        this.fieldsMap = new Map<string, SFieldDescribe>();
    }

    name: string;
    label: string;
    updateable: boolean;
    createable: boolean;
    custom: boolean;

    @Type(() => SFieldDescribe)
    fieldsMap: Map<string, SFieldDescribe>;


    get initialized() {
        return this.fieldsMap.size > 0;
    }


    get availableExternalIdFields(): Array<IExternalIdField> {
        return [...this.fieldsMap.values()].filter(f => (f.creatable && f.updateable || f.autoNumber || f.isFormula)
            && CONSTANTS.FIELD_NOT_FOR_EXTERNAL_ID.indexOf(f.name) < 0).map(f => {
                return {
                    value: f.name,
                    label: `${f.label} (${f.name})${f.autoNumber ? " *Auto-number" : ""}${f.isFormula ? " *Formula" : ""}`,
                    isReference: f.isReference,
                    isAutoNumber: f.autoNumber,
                    isFormula: f.isFormula,
                    objectName: this.name
                }
            });
    }

}



/**
 * Class that represents sObject field
 *
 * @export
 * @class SFieldDescribe
 */
export class SFieldDescribe {

    constructor(init?: Partial<SFieldDescribe>) {
        Object.assign(this, init);
    }

    name: string;
    type: string;
    label: string;
    updateable: boolean;
    creatable: boolean;
    cascadeDelete: boolean;
    autoNumber: boolean;
    custom: boolean;
    calculated: boolean;

    isReference: boolean;
    referencedObjectType: string;

    get isMasterDetail() {
        return this.isReference && (!this.updateable || this.cascadeDelete);
    }

    get isFormula() {
        return this.calculated;
    }

    get isReadonly() {
        return !(this.creatable && !this.isFormula && !this.autoNumber);
    }

    get isBoolean(){
        return this.type == "boolean";
    }

}



/**
 * Interface represents External id field definition
 *
 * @export
 * @interface IExternalIdField
 */
export interface IExternalIdField {
    value: string;
    label: string;
    isReference: boolean;
    isAutoNumber: boolean;
    isFormula: boolean;
    objectName: string;
}
