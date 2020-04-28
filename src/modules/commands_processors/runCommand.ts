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
import { MessageUtils, RESOURCES, LOG_MESSAGE_VERBOSITY } from "../components/messages";
import * as models from '../models';
import { OPERATION } from '../components/statics';



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
        this.basePath = (path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath.toString())).replace(/([^"]+)(.*)/, "$1");
        this.targetUsername = targetUsername;
        this.sourceUsername = sourceUsername;
        this.apiVersion = apiVersion;
    }

    async loadScriptAsync(): Promise<any> {

        if (!fs.existsSync(this.basePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RESOURCES.workingPathDoesNotExist));
        }
        let filePath = path.join(this.basePath, 'export.json');

        if (!fs.existsSync(filePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RESOURCES.packageFileDoesNotExist));
        }

        this.logger.infoMinimal(RESOURCES.newLine);
        this.logger.headerMinimal(RESOURCES.loadingPackageFile);

        let json = fs.readFileSync(filePath, 'utf8');
        let jsonObject = JSON.parse(json);
        this.script = plainToClass(models.Script, jsonObject);
       
        await this.script.initializeAsync(this.logger, this.sourceUsername, this.targetUsername, this.basePath, this.apiVersion);

        this.logger.objectMinimal({
            [this.logger.getResourceString(RESOURCES.source)]: this.logger.getResourceString(RESOURCES.sourceOrg, this.script.sourceOrg.name),
            [this.logger.getResourceString(RESOURCES.target)]: this.logger.getResourceString(RESOURCES.targetOrg, this.script.targetOrg.name),
            [this.logger.getResourceString(RESOURCES.packageScript)]: this.logger.getResourceString(RESOURCES.scriptFile, filePath)
        });

        //console.log(this.script.sourceOrg.accessToken);
        //console.log(this.script.targetOrg.accessToken);
    }



}












