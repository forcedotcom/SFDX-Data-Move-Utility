/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommonUtils } from "../components/commonUtils";
import { ScriptObject } from ".";



/**
 * Description of the sobject field
 *
 * @export
 * @class SFieldDescribe
 */
export default class SFieldDescribe {

    constructor(init?: Partial<SFieldDescribe>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    objectName: string = "";
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

    /**
     * This ScriptObject
     */
    scriptObject: ScriptObject;

    /**
     * Parent ScriptObject for reference field
     */
    parentScriptObject: ScriptObject;

    /**
     * If it is the externalId field -> is the list of the child
     *    __r fields from other ScriptObjects, which are linked to this field
     *  For ex. if the current field is "|Account|Name" : 
     *          [ "|Case|Account__r.Name", "|Lead|ConvertedAccount.Name", "|CustomObject__c|MyAccount__r.Name", ... ]
     */
    child__rSFields: SFieldDescribe[] = new Array<SFieldDescribe>();

    /**
     * Account__r.Name
     */
    __rSField: SFieldDescribe;

    /**
     * Account__c
     */
    idSField: SFieldDescribe;

    get is__r(): boolean {
        return !!this.idSField;
    }

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

    get isComplex(): boolean {
        return CommonUtils.isComplexField(this.name);
    }

    get isSelfReference(): boolean {
        return this.referencedObjectType == this.objectName;
    }

    get name__r(): string {
        if (this.custom) {
            return this.name.replace("__pc", "__pr").replace("__c", "__r");
        } else {
            return CommonUtils.trimEndStr(this.name, "Id");
        }
    }



}

