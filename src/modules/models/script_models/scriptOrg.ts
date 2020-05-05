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
import { Common } from "../../components/common_components/common";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../../components/common_components/statics";
import { Logger, RESOURCES } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
var jsforce = require("jsforce");
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { Script, OrgInfo } from "..";
import { IOrgConnectionData } from "../common_models/interfaces";
import { CommandInitializationError } from "../common_models/errors";


/**
 * The org object which is parsed from the script file 
 *
 * @export
 * @class ScriptOrg
 */
export default class ScriptOrg {

    // ------------- JSON --------------
    name: string = "";
    instanceUrl: string = "";
    accessToken: string = "";

    // -----------------------------------
    script: Script;
    media: DATA_MEDIA_TYPE = DATA_MEDIA_TYPE.Org;
    isSource: boolean = false;
    isPersonAccountEnabled: boolean = false;

    get connectionData(): IOrgConnectionData {
        return {
            instanceUrl: this.instanceUrl,
            accessToken: this.accessToken,
            apiVersion: this.script.apiVersion
        };
    }

    getConnection(): any {
        return Sfdx.createOrgConnection(this.connectionData);
    }

    get isConnected(): boolean {
        return !!this.accessToken;
    }

    get isFileMedia(): boolean {
        return this.media == DATA_MEDIA_TYPE.File;
    }



    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup this object
     *
     * @returns {Promise<void>}
     * @memberof ScriptOrg
     */
    async setupAsync(): Promise<void> {
        // Setup and verify org connection
        await this._setupConnection();
    }



    // ----------------------- Private members -------------------------------------------    
    private _parseForceOrgDisplayResult(commandResult: String): OrgInfo {
        if (!commandResult) return null;
        let lines = commandResult.split('\n');
        let output: OrgInfo = new OrgInfo();
        lines.forEach(line => {
            if (line.startsWith("Access Token"))
                output.AccessToken = line.split(' ').pop();
            if (line.startsWith("Client Id"))
                output.ClientId = line.split(' ').pop();
            if (line.startsWith("Connected Status"))
                output.ConnectedStatus = line.split(' ').pop();
            if (line.startsWith("Status"))
                output.Status = line.split(' ').pop();
            if (line.startsWith("Id"))
                output.OrgId = line.split(' ').pop();
            if (line.startsWith("Instance Url"))
                output.InstanceUrl = line.split(' ').pop();
            if (line.startsWith("Username"))
                output.Username = line.split(' ').pop();
        });
        return output;
    };

    private async _validateAccessTokenAsync(): Promise<void> {
        let apiSf = new Sfdx(this);
        if (!this.isFileMedia) {
            try {
                // Validate access token
                await apiSf.queryAsync("SELECT Id FROM Account LIMIT 1", false);
            } catch (ex) {
                throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.accessToOrgExpired, this.name));
            }
            try {
                // Check person account availability
                await apiSf.queryAsync("SELECT IsPersonAccount FROM Account LIMIT 1", false);
                this.isPersonAccountEnabled = true;
            } catch (ex) {
                this.isPersonAccountEnabled = false;
            }
        }
    }

    private async _setupConnection(): Promise<void> {
        if (!this.isFileMedia) {
            if (!this.isConnected) {
                // Connect with SFDX
                this.script.logger.infoNormal(RESOURCES.tryingToConnectCLI, this.name);
                let processResult = Common.execSfdx("force:org:display", this.name);
                let orgInfo = this._parseForceOrgDisplayResult(processResult);
                if (!orgInfo.isConnected) {
                    throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.tryingToConnectCLIFailed, this.name));
                } else {
                    Object.assign(this, {
                        accessToken: orgInfo.AccessToken,
                        instanceUrl: orgInfo.InstanceUrl
                    });
                }
            }

            // Validate connection and check person account availability
            await this._validateAccessTokenAsync();
            this.script.logger.infoNormal(RESOURCES.successfullyConnected, this.name);
        }
    }

}


