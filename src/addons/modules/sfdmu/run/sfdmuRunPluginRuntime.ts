/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Script } from "../../../../modules/models";

import { Logger, LOG_MESSAGE_TYPE, LOG_MESSAGE_VERBOSITY } from "../../../../modules/components/common_components/logger";
import { DATA_MEDIA_TYPE, ICommandRunInfo, ITableMessage } from "../../../components/shared_packages/commonComponents";
import SfdmuRunPluginJob from "./sfdmuRunPluginJob";
import { IPluginRuntimeSystemBase } from "../../../../modules/models/common_models/helper_interfaces";
import { Common } from "../../../../modules/components/common_components/common";
import { Sfdx } from "../../../../modules/components/common_components/sfdx";
import { ISfdmuRunPluginJob, ISfdmuRunPluginRuntime } from "../../../components/shared_packages/sfdmuRunAddonComponents";


export interface ISfdmuRunPluginRuntimeSystem extends IPluginRuntimeSystemBase {
    $$setPluginJob(): void
}


export default class SfdmuRunPluginRuntime implements ISfdmuRunPluginRuntime, ISfdmuRunPluginRuntimeSystem {

    // Hidden properties to not expose them to the Addon code.
    // The Addon can access only the members of IPluginRuntime.
    #script: Script;
    #logger: Logger;

    constructor(script: Script) {
        this.#script = script;
        this.#logger = script.logger;
        this.runInfo = script.runInfo;
    }



    /* -------- System Functions (for direct access) ----------- */
    $$setPluginJob() {
        this.pluginJob = new SfdmuRunPluginJob(this.#script.job);
    }


    /* -------- IPluginRuntime implementation ----------- */
    runInfo: ICommandRunInfo;
    pluginJob: ISfdmuRunPluginJob;

    writeLogConsoleMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE", ...tokens: string[]) {

        switch (messageType) {
            case "WARNING":
                this.#logger.warn(<string>message, ...tokens);
                break;

            case "ERROR":
                this.#logger.error(<string>message, ...tokens);
                break;

            case "OBJECT":
                this.#logger.objectNormal(<object>message);
                break;

            case "TABLE":
                this.#logger.log(<ITableMessage>message, LOG_MESSAGE_TYPE.TABLE, LOG_MESSAGE_VERBOSITY.VERBOSE, ...tokens);
                break;

            default:
                this.#logger.infoVerbose(<string>message, ...tokens);
                break;
        }
    }

    getConnection(isSource: boolean) {
        return isSource ? this.#script.sourceOrg.getConnection() : this.#script.targetOrg.getConnection();
    }

    getOrgInfo(isSource: boolean): {
        instanceUrl: string;
        accessToken: string;
        apiVersion: string;
        isFile: boolean;
    } {
        return isSource ? Object.assign(this.#script.sourceOrg.connectionData, {
            isFile: this.#script.sourceOrg.media == DATA_MEDIA_TYPE.File
        }) : Object.assign(this.#script.targetOrg.connectionData, {
            isFile: this.#script.targetOrg.media == DATA_MEDIA_TYPE.File
        });
    }

    async queryAsync(isSource: boolean, soql: string, useBulkQueryApi: boolean): Promise<any[]> {
        let apiSf = new Sfdx(isSource ? this.#script.sourceOrg : this.#script.targetOrg);
        let ret = await apiSf.queryAsync(soql, useBulkQueryApi);
        return ret.records;
    }

    async queryMultiAsync(isSource: boolean, soqls: string[], useBulkQueryApi: boolean): Promise<any[]> {
        let records = [];
        for (let index = 0; index < soqls.length; index++) {
            const soql = soqls[index];
            records = records.concat(await this.queryAsync(isSource, soql, useBulkQueryApi));
        }
        return records;
    }

    /**
     * Constructs array of SOQL-IN queries based on the provided values.
     * Keeps aware of the query length limitation according to the documentation:
     * (https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_soslsoql.htm)
     *
     *
     * @param {string[]} selectFields The fields to include into the SELECT statement in each query
     * @param {string} [fieldName="Id"] The field of the IN clause
     * @param {string} sObjectName The object api name to select 
     * @param {string[]} valuesIN The array of values to use in the IN clause
     * @returns {string[]} The array of SOQLs depend on the given values to include all of them
     */
    createFieldInQueries(selectFields: string[], fieldName: string = "Id", sObjectName: string, valuesIN: string[]): string[] {
        return Common.createFieldInQueries(selectFields, fieldName, sObjectName, valuesIN);
    }



}






