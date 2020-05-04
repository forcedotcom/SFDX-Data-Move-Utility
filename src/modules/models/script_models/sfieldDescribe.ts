/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { CommonUtils } from "../../components/common_components/commonUtils";
import { ScriptObject } from "..";


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
     * Parent lookup ScriptObject for reference field
     */
    parentLookupObject: ScriptObject;

    /**
     * For the externalId field -> holds the list of all the child __r sfields
     * 
     *  For example, if the current sfield is externalId "|Account|Name", 
     *  so this property will return a list of all the child lookup  __r  sfields, which point to this externalId field, as following:
     *  [ "|Case|Account__r.Name", "|Lead|ConvertedAccount.Name", "|CustomObject__c|MyAccount__r.Name", ... ]
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

    /**
     * Account__c => Account__r
     *
     * @readonly
     * @type {string}
     * @memberof SFieldDescribe
     */
    get name__r(): string {
        let name = this.name.split('.')[0];
        if (this.custom) {
            return name.replace("__pc", "__pr").replace("__c", "__r");
        } else {
            return CommonUtils.trimEndStr(name, "Id");
        }
    }

     /**
     * Account__r.Name => Account__c
     *
     * @readonly
     * @type {string}
     * @memberof SFieldDescribe
     */
    get nameId(): string {
        let parts = this.name.split('.');
        if (!this.is__r || parts.length < 2) {
            return this.name;
        }
        if (this.custom) {
            return parts[0].replace("__pr", "__pc").replace("__r", "__c");
        } else {
            return parts[0] + "Id";
        }
    }

    /**
     * Account__c => Account__r.Id 
     * ("Id" is current external id for Account)
     *
     * @readonly
     * @type {string}
     * @memberof SFieldDescribe
     */
    get fullName__r(): string {
        if (this.isReference) {
            return this.name__r + "." + CommonUtils.getComplexField(this.parentLookupObject.externalId);
        } else {
            return this.name__r;
        }
    }

    /**
     * Account__c => Account__r.Name 
     * ("Name" is the original external id for Account defained in the script)
     *
     * @readonly
     * @type {string}
     * @memberof SFieldDescribe
     */
    get fullOriginalName__r(): string {
        if (this.isReference) {
            return this.name__r + "." + CommonUtils.getComplexField(this.parentLookupObject.originalExternalId);
        } else {
            return this.name__r;
        }
    }

     /**
     * Account__c => Account__r.Id 
     * ("Name" is the original external id for Account defained in the script)
     *
     * @readonly
     * @type {string}
     * @memberof SFieldDescribe
     */
    get fullIdName__r(): string {
        if (this.isReference) {
            return this.name__r + ".Id";
        } else {
            return this.name__r;
        }
    }

   

}

