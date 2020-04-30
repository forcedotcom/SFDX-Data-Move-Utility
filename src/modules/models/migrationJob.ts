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
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError, OrgMetadataError, ScriptOrg, ScriptObject, MigrationJobTask as Task } from ".";
import SFieldDescribe from "./sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';

export default class MigrationJob {

    script: Script;
    tasks: Task[] = new Array<Task>();
    csvValuesMapping: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();

    constructor(init: Partial<MigrationJob>) {
        if (init) {
            Object.assign(this, init);
        }
    }


    
    /**
     * Reads CSVValues mapping definition file
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async readCSVValueMappingFileAsync(): Promise<void> {
        let valueMappingFilePath = path.join(this.script.basePath, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
        let csvRows = await CommonUtils.readCsvFileAsync(valueMappingFilePath);
        if (csvRows.length > 0) {
            this.script.logger.infoVerbose(RESOURCES.readingValuesMappingFile, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
            csvRows.forEach(row => {
                if (row["ObjectName"] && row["FieldName"]) {
                    let key = String(row["ObjectName"]).trim() + String(row["FieldName"]).trim();
                    if (!this.csvValuesMapping.has(key)) {
                        this.csvValuesMapping.set(key, new Map<string, string>());
                    }
                    this.csvValuesMapping.get(key).set(String(row["RawValue"]).trim(), (String(row["Value"]) || "").trim());
                }
            });
        }
    }



    /**
     * Merges User.csv and Group.csv into single file
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async mergeUserGroupfiles(): Promise<void> {
        let filepath1 = path.join(this.script.basePath, "User.csv");
        let filepath2 = path.join(this.script.basePath, "Group.csv");
        let filepath3 = path.join(this.script.basePath, CONSTANTS.USER_AND_GROUP_FILENAME + ".csv");
        await CommonUtils.mergeCsvFilesAsync(filepath1, filepath2, filepath3, true, "Id", "Name");
    }



}