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
import { OPERATION, CONSTANTS, DATA_MEDIA_TYPE } from '../components/statics';
import { MigrationJobTask as Task, MigrationJob as Job } from '../models';



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
     * Holds the current MigrationJob object instance
     *
     * @type {Job}
     * @memberof RunCommand
     */
    job: Job;

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



    /**
     * Setup the command
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async setupAsync(): Promise<void> {

        // Load script file
        if (!fs.existsSync(this.basePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RESOURCES.workingPathDoesNotExist));
        }
        let filePath = path.join(this.basePath, CONSTANTS.SCRIPT_FILE_NAME);

        if (!fs.existsSync(filePath)) {
            throw new models.CommandInitializationError(this.logger.getResourceString(RESOURCES.packageFileDoesNotExist));
        }

        this.logger.infoMinimal(RESOURCES.newLine);
        this.logger.headerMinimal(RESOURCES.loadingPackageFile);

        let json = fs.readFileSync(filePath, 'utf8');
        let jsonObject = JSON.parse(json);
        this.script = plainToClass(models.Script, jsonObject);

        // Setup script object
        await this.script.setupAsync(this.logger, this.sourceUsername, this.targetUsername, this.basePath, this.apiVersion);

        this.logger.objectMinimal({
            [this.logger.getResourceString(RESOURCES.source)]: this.logger.getResourceString(RESOURCES.sourceOrg, this.script.sourceOrg.name),
            [this.logger.getResourceString(RESOURCES.target)]: this.logger.getResourceString(RESOURCES.targetOrg, this.script.targetOrg.name),
            [this.logger.getResourceString(RESOURCES.packageScript)]: this.logger.getResourceString(RESOURCES.scriptFile, filePath)
        });

        // Describe sobjects
        await this.script.processObjectsMetadataAsync();

    }



    /**
     * Analyse the current script structure and create 
     * the optimised list of tasks
     * to perform during the migration process
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async createJobAsync(): Promise<void> {

        this.logger.infoMinimal(RESOURCES.newLine);
        this.logger.headerMinimal(RESOURCES.dataMigrationProcessStarted);
        this.logger.infoVerbose(RESOURCES.buildingMigrationStaregy);

        this.job = new Job({
            script: this.script
        })

        let lowerIndexForAnyObjects = 0;
        let lowerIndexForReadonlyObjects = 0;

        // Create task chain in the optimized order
        // to put parent related objects before their children
        this.script.objects.forEach(newObject => {

            // New task object to insert into the task chain
            let newTask: Task = new Task({
                scriptObject: newObject,
                job: this.job
            });

            if (newObject.name == "RecordType") {
                // RecordType object is always at the beginning 
                //   of the task chain
                this.job.tasks.unshift(newTask);
                lowerIndexForAnyObjects++;
                lowerIndexForReadonlyObjects++;
            } else if (newObject.isReadonlyObject) {
                // Readonly objects are always at the beginning 
                //   of the task chain 
                //   but after RecordType
                this.job.tasks.splice(lowerIndexForReadonlyObjects, 0, newTask);
                lowerIndexForAnyObjects++;
            } else if (this.job.tasks.length == 0) {
                // First object in the task chain
                this.job.tasks.push(newTask);
            } else {
                // The index where to insert the new object
                let indexToInsert: number = this.job.tasks.length;
                for (var existedTaskIndex = this.job.tasks.length - 1; existedTaskIndex >= lowerIndexForAnyObjects; existedTaskIndex--) {
                    var existedTask = this.job.tasks[existedTaskIndex];
                    // Check if the new object is parent lookup to the existed task
                    let isNewObject_ParentLookup = existedTask.scriptObject.parentLookupObjects.some(x => x.name == newObject.name);
                    // Check if the existed task is parent master-detail to the new object
                    let isExistedTask_ParentMasterDetail = newObject.parentMasterDetailObjects.some(x => x.name == existedTask.scriptObject.name);
                    if (isNewObject_ParentLookup && !isExistedTask_ParentMasterDetail) {
                        // The new object is the parent lookup, but it is not a child master-detail 
                        //                  => it should be before BEFORE the existed task (replace existed task with it)
                        indexToInsert = existedTaskIndex;
                    }
                    // The existed task is the parent lookup or the parent master-detail 
                    //                      => it should be AFTER the exited task (continue as is)
                }
                // Insert the new object 
                //   into the task chain
                //   at the calculated index
                this.job.tasks.splice(indexToInsert, 0, newTask);
            }
        });

        this.logger.objectMinimal({
            [this.logger.getResourceString(RESOURCES.executionOrder)]: this.job.tasks.map(x => x.sObjectName).join("; ")
        });

    }



    /**
     * Validate and fix the CSV files if 
     * CSV files are set as the data source
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async validateCSVFiles(): Promise<void> {

        if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.File) {

            this.logger.infoMinimal(RESOURCES.validatingAndFixingSourceCSVFiles);

            await this.job.readCSVValueMappingFileAsync();
            await this.job.mergeUserGroupCSVfiles();
            await this.job.validateAndFixSourceCSVFiles();

            this.logger.infoVerbose(RESOURCES.validationAndFixingsourceCSVFilesCompleted);
        }
    }






}












