/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from "../../components/common_components/common";
import { RESOURCES } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
import { Script, OrgInfo, SObjectDescribe } from "..";
import { CommandAbortedByUserError, CommandInitializationError } from "../common_models/errors";
import { IOrgConnectionData } from "../common_models/helper_interfaces";
import { DATA_MEDIA_TYPE } from "../../components/common_components/enumerations";
import { ISfdmuRunCustomAddonScriptOrg } from "../../../addons/modules/sfdmu-run/custom-addons/package";
import { IAppScriptOrg } from "../../app/appModels";



/**
 * Parsed org object
 * from the script file
 *
 * @export
 * @class ScriptOrg
 */
export default class ScriptOrg implements IAppScriptOrg, ISfdmuRunCustomAddonScriptOrg {

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
  organizationType: "Developer Edition";
  isSandbox: boolean = false;

  get connectionData(): IOrgConnectionData {
    return {
      instanceUrl: this.instanceUrl,
      accessToken: this.accessToken,
      apiVersion: this.script.apiVersion,
      proxyUrl: this.script.proxyUrl
    };
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

  get isProduction(): boolean {
    return !this.isSandbox && this.organizationType != "Developer Edition";
  }

  get isDeveloper(): boolean {
    return this.organizationType == "Developer Edition";
  }

  get instanceDomain(): string {
    return Common.extractDomainFromUrlString(this.instanceUrl) || "";
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

  /**
   * If it is production environment prompts user for the
   * "I know what I do"
   *
   * @return {*}  {Promise<void>}
   * @memberof ScriptOrg
   */
  async promptUserForProductionModificationAsync(): Promise<void> {
    // Prompt user if it is production target
    let domain = this.instanceDomain.toLowerCase();
    if (
      !this.isFileMedia                                                               // It's Org, not File +
      && this.isProduction                                                            // It's Production +
      && this.script.canModify.toLowerCase() != domain                                // There is no --canmodify flag passed with the CLI command +
      && (
        !this.isSource                                                              // It's the Target org ...
        || this.isSource && this.script.hasDeleteFromSourceObjectOperation          // ... or its the Source org but delete from source is now in progress
      )
    ) {
      // Prompt the user to allow production modifications
      let promptMessage = this.script.logger.getResourceString(RESOURCES.productionModificationApprovalPrompt, domain);
      let response = (await this.script.logger.textPromptAsync(promptMessage, null, '')).toLowerCase();
      if (response != domain) {
        // Abort the job
        throw new CommandAbortedByUserError(this.script.logger.getResourceString(RESOURCES.actionIsNotPermitted));
      }
    }
  }

  getConnection(): any {
    return Sfdx.createOrgConnection(this.connectionData);
  }


  // ----------------------- Private members -------------------------------------------
  private _parseForceOrgDisplayResult(commandResult: string): OrgInfo {
    if (!commandResult) return null;

    const jsonObj = JSON.parse(commandResult.replace(/\n/g, ' '));
    if (jsonObj.status || !jsonObj.result) {
      return null;
    }

    let output: OrgInfo = new OrgInfo();
    Object.assign(output, {
      AccessToken: jsonObj.result.accessToken,
      ClientId: jsonObj.result.clientId,
      ConnectedStatus: jsonObj.result.connectedStatus,
      Status: jsonObj.result.status,
      OrgId: jsonObj.result.id,
      InstanceUrl: jsonObj.result.instanceUrl,
      Username: jsonObj.result.username,
    });

    return output;
  };

  private async _validateOrgAsync(): Promise<void> {

    let apiSf = new Sfdx(this);
    if (!this.isFileMedia) {

      try {
        await apiSf.identityAsync();
      } catch (ex) {
        throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.accessToOrgExpired, this.name));
      }

      // Get org info
      let ret = await apiSf.queryOrgAsync("SELECT OrganizationType, IsSandbox FROM Organization LIMIT 1", false);
      this.isSandbox = ret[0]["IsSandbox"];
      this.organizationType = ret[0]["OrganizationType"];

      // Check person account availability
      try {
        await apiSf.queryOrgAsync("SELECT IsPersonAccount FROM Account LIMIT 1", false);
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
        let processResult = Common.execSfdx("force:org:display --json", this.name);
        let orgInfo = this._parseForceOrgDisplayResult(processResult);
        if (!orgInfo || !orgInfo.isConnected) {
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
      await this._validateOrgAsync();

      this.script.logger.infoNormal(RESOURCES.successfullyConnected, this.name);
    }
  }

  private async _describeOrg(): Promise<void> {
    try {
      if (this.media == DATA_MEDIA_TYPE.Org) {
        let apiSf = new Sfdx(this);
        this.orgDescribe = (await apiSf.describeOrgAsync()).reduce((acc, describe) => {
          acc.set(describe.name, describe);
          return acc;
        }, new Map<string, SObjectDescribe>());
      }
    } catch (ex) { }
  }

}


