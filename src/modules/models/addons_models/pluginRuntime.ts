/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Script } from "..";
import { DATA_MEDIA_TYPE } from "../../components/common_components/statics";
import { Logger, LOG_MESSAGE_TYPE, LOG_MESSAGE_VERBOSITY } from "../../components/common_components/logger";
import { IPluginRuntime, ICommandRunInfo, ITableMessage, IPluginJob } from "./addonSharedPackage";
import PluginJob from "./pluginJob";
import { IPluginRuntimeSystem } from "../common_models/helper_interfaces";


export default class PluginRuntime implements IPluginRuntime, IPluginRuntimeSystem {

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
    $$setPluginJob(){
        this.pluginJob = new PluginJob(this.#script.job);      
    }
    

    /* -------- IPluginRuntime implementation ----------- */
    runInfo: ICommandRunInfo;
    pluginJob: IPluginJob;

    writeLogConsoleMessage(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE") {
        
        switch (messageType) {
            case "WARNING":
                this.#logger.warn(<string>message);
                break;

            case "ERROR":
                this.#logger.error(<string>message);
                break;

            case "OBJECT":
                this.#logger.objectNormal(<object>message);
                break;

            case "TABLE":
                this.#logger.log(<ITableMessage>message, LOG_MESSAGE_TYPE.TABLE, LOG_MESSAGE_VERBOSITY.VERBOSE);
                break;

            default:
                this.#logger.infoVerbose(<string>message);
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

}



