/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from "../../components/common_components/common";
import { DATA_MEDIA_TYPE } from "../../components/common_components/statics";
import { RESOURCES } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
import { Script, OrgInfo, SObjectDescribe } from "..";
import { CommandInitializationError } from "../common_models/errors";
import { IOrgConnectionData } from "../common_models/helper_interfaces";


/**
 * Parsed org object 
 * from the script file 
 *
 * @export
 * @class ScriptOrg
 */
export default class ScriptOrg {

    // ------------- JSON --------------

    /**
     * Org Username                 : if org section is specified in the export.json
     * Org username/SFDX user alias : if org section is missing but the SFDX CLI connection is used
     */
    name: string = "";

    /**
     * Always the Org Username
     */
    orgUserName: string = "";

    instanceUrl: string = "";
    accessToken: string = "";


    // -----------------------------------
    script: Script;
    media: DATA_MEDIA_TYPE = DATA_MEDIA_TYPE.Org;
    isSource: boolean = false;
    isPersonAccountEnabled: boolean = false;
    orgDescribe: Map<string, SObjectDescribe> = new Map<string, SObjectDescribe>();

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

    get isDescribed(): boolean {
        return this.orgDescribe.size > 0;
    }

    get objectNamesList(): Array<string> {
        return [...this.orgDescribe.keys()];
    }


    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup this object
     *
     * @returns {Promise<void>}
     * @memberof ScriptOrg
     */
    async setupAsync(isSource: boolean): Promise<void> {
        // Setup variables
        this.isSource = isSource;

        // Setup and verify org connection
        await this._setupConnection();

        // Get org describtion
        await this._describeOrg();
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
                // Normally, each SF user must have an access ot his own User record.
                let records = await apiSf.queryAsync(`SELECT Id FROM User WHERE Username = '${this.orgUserName}'`, false);
                if (records.records.length == 0) {
                    throw new Error();
                }
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

            // By default the org username has the same value as the name
            this.orgUserName = this.name;

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
                        instanceUrl: orgInfo.InstanceUrl,
                        orgUserName: orgInfo.Username
                    });
                }
            }

            // Validate connection and check person account availability
            await this._validateAccessTokenAsync();
            this.script.logger.infoNormal(RESOURCES.successfullyConnected, this.name);
        }
    }

    private async _describeOrg(): Promise<void> {
        try {
            let apiSf = new Sfdx(this);
            this.orgDescribe = (await apiSf.describeOrgAsync()).reduce((acc, describe) => {
                acc.set(describe.name, describe);
                return acc;
            }, new Map<string, SObjectDescribe>());
        } catch (ex) { }
    }

}


