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
import { ApiSf } from "../components/apiSf";
var jsforce = require("jsforce");
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError, OrgMetadataError, ScriptOrg, ScriptObject, MigrationJob as Job } from ".";
import SFieldDescribe from "./sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';


export default class MigrationJobTask {

    scriptObject: ScriptObject;
    job: Job;

    constructor(init: Partial<MigrationJobTask>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    get sObjectName(): string {
        return this.scriptObject && this.scriptObject.name;
    }
    
    
    /**
     * Returns CSV filename for the current task
     *
     * @returns {string}
     * @memberof MigrationJobTask
     */
    getCSVFilename(): string {
        let filepath = path.join(this.scriptObject.script.basePath, this.sObjectName);
        if (this.sObjectName == "User" || this.sObjectName == "Group") {
            filepath = path.join(this.scriptObject.script.basePath, CONSTANTS.USER_AND_GROUP_FILENAME);
        }
        filepath += ".csv";
        return filepath;
    }


}