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
import { ADDON_MODULE_METHODS, CONSTANTS } from '../components/common_components/statics';
import { MigrationJob as Job } from '../models';
import { CommandInitializationError } from '../models/common_models/errors';
import { IPluginInfo } from '../models/common_models/helper_interfaces';



/**
 * SFDMU:RUN CLI command
 *
 * @export
 * @class RunCommand
 */
export class RunCommand {

    logger: Logger;
    pinfo: IPluginInfo;
    basePath: string;
    targetUsername: string;
    sourceUsername: string;
    apiVersion: string;
    script: models.Script;
    job: Job;

    /**
     * New instance of RunCommand.
     * @param {Logger} logger The MessageUtils instance
     * @param {string} basePath The absolute or relative path where the export.json file does exist (from the command line)
     * @param {string} sourceUsername The username/SFDX instance name of the source env (from the command line)
     * @param {string} targetUsername The username/SFDX instance name of the target env (from the command line)
     * @param {string} apiVersion The sf api version to use across all api operations (from the command line)
     * @memberof RunCommand
     */
    constructor(
        pinfo: IPluginInfo,
        logger: Logger,
        basePath: string,
        sourceUsername: string,
        targetUsername: string,
        apiVersion: string) {

        this.pinfo = pinfo;
        this.logger = logger;
        this.basePath = (path.isAbsolute(basePath) ? basePath : path.join(process.cwd(), basePath.toString())).replace(/([^"]+)(.*)/, "$1");
        this.targetUsername = targetUsername;
        this.sourceUsername = sourceUsername;
        this.apiVersion = apiVersion;
    }



    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup the Command
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

        let json: string;
        try {
            json = fs.readFileSync(filePath, 'utf8');
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }

        try {
            let jsonObject = JSON.parse(json);
            this.script = plainToClass(models.Script, jsonObject);
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONFormatError, ex.message));
        }

        // Setup script object
        await this.script.setupAsync(this.pinfo, this.logger, this.sourceUsername, this.targetUsername, this.basePath, this.apiVersion);

        this.logger.objectMinimal({
            [this.logger.getResourceString(RESOURCES.source)]: this.logger.getResourceString(RESOURCES.sourceOrg, this.script.sourceOrg.name),
            [this.logger.getResourceString(RESOURCES.target)]: this.logger.getResourceString(RESOURCES.targetOrg, this.script.targetOrg.name),
            [this.logger.getResourceString(RESOURCES.packageScript)]: this.logger.getResourceString(RESOURCES.scriptFile, filePath)
        });

        // Load mapping configuration
        this.script.loadFieldMappingConfiguration();
        await this.script.loadFieldMappingConfigurationFileAsync();

        // Describe sobjects
        await this.script.processObjectsMetadataAsync();

        // Vaidate orgs
        this.script.verifyOrgs();

    }

    /**
     * Create an optimised list of migration tasks
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async createJobAsync(): Promise<void> {

        this.logger.infoMinimal(RESOURCES.newLine);
        this.logger.headerMinimal(RESOURCES.dataMigrationProcessStarted);

        this.logger.infoNormal(RESOURCES.buildingMigrationStaregy);

        this.job = new Job({
            script: this.script
        });

        this.job.setup();
    }

    /**
     * Process and fix the CSV files including configuration CSV
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async processCSVFilesAsync(): Promise<void> {
        await this.job.processCSVFilesAsync();
    }

    /**
    * Prepare the migration job
    * 
    * @returns {Promise<void>}
    * @memberof RunCommand
    */
    async prepareJobAsync(): Promise<void> {
        this.logger.infoNormal(RESOURCES.preparingJob);
        this.job.prepareJob();   
        await this.job.getTotalRecordsCountAsync();    
    }

    /**
     * Execute the migration job
     *
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async executeJobAsync(): Promise<void> {

        this.logger.infoNormal(RESOURCES.executingJob);
      
        await this.job.deleteOldRecordsAsync();
        await this.job.retrieveRecordsAsync();
        await this.job.updateRecordsAsync();

        this.logger.infoMinimal(RESOURCES.newLine);
    }

    /**
     * Executes global addon event
     *
     * @param {ADDON_MODULE_METHODS} method The method to execute
     * @returns {Promise<void>}
     * @memberof RunCommand
     */
    async runAddonEvent(method: ADDON_MODULE_METHODS): Promise<void> {
        this.logger.infoNormal(RESOURCES.runAddonGlobalMethod, method.toString());
        await this.script.addonManager.triggerAddonModuleMethodAsync(method);
    }

}












