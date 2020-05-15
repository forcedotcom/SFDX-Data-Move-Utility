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
import { Logger, RESOURCES } from "../components/common_components/logger";
import * as models from '../models';
import { CONSTANTS } from '../components/common_components/statics';
import { MigrationJob as Job } from '../models';
import { CommandInitializationError } from '../models/common_models/errors';



/**
 * Class to process SFDMU:RUN CLI command
 *
 * @export
 * @class RunCommand
 */
export class RunCommand {

    logger: Logger;
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
     * @param {Logger} logger The MessageUtils instance
     * @param {string} basePath The absolute or relative path where the export.json file does exist (from the command line)
     * @param {string} sourceUsername The username/SFDX instance name of the source env (from the command line)
     * @param {string} targetUsername The username/SFDX instance name of the target env (from the command line)
     * @param {string} apiVersion The sf api version to use across all api operations (from the command line)
     * @memberof RunCommand
     */
    constructor(logger: Logger,
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


    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup the command
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async setupAsync(): Promise<void> {

        // Load script file
        if (!fs.existsSync(this.basePath)) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.workingPathDoesNotExist));
        }
        let filePath = path.join(this.basePath, CONSTANTS.SCRIPT_FILE_NAME);

        if (!fs.existsSync(filePath)) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.packageFileDoesNotExist));
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

        // Vaidate orgs
        this.script.verifyOrgs();

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
        });

        this.job.setup();
    }

    /**
     * Validate and fix the CSV files if 
     * CSV files are set as the data source
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async validateCSVFiles(): Promise<void> {
        await this.job.validateCSVFiles();
    }

    /**
    * Prepare the migration job
    * 
    * @returns {Promise<void>}
    * @memberof RunCommand
    */
    async prepareJob(): Promise<void> {
        this.job.deleteTargetCSVDirectory();
        await this.job.getTotalRecordsCount();
        await this.job.deleteOldRecords();
    }

    /**
     * Execute the migration job
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async executeJob(): Promise<void> {
        await this.job.retrieveRecords();
        await this.job.updateRecords();
        this.logger.infoMinimal(RESOURCES.newLine);
    }

}












