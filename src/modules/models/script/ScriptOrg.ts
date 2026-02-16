/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../../common/Common.js';
import { DATA_MEDIA_TYPE, OPERATION } from '../../common/Enumerations.js';
import { MAX_PARALLEL_REQUESTS } from '../../constants/Constants.js';
import CjsDependencyAdapters from '../../dependencies/CjsDependencyAdapters.js';
import OrgConnectionAdapter from '../../org/OrgConnectionAdapter.js';
import { CommandAbortedByUserError } from '../common/CommandAbortedByUserError.js';
import { CommandInitializationError } from '../common/CommandInitializationError.js';
import type SObjectDescribe from '../sf/SObjectDescribe.js';
import type Script from './Script.js';

type OrgConnectionDataType = {
  instanceUrl: string;
  accessToken: string;
  apiVersion: string;
  proxyUrl: string;
};

type OrgConnectionType = Connection & {
  accessToken?: string;
  instanceUrl?: string;
  baseUrl?: () => string;
  getAuthInfoFields?: () => { username?: string; instanceUrl?: string; orgId?: string };
  singleRecordQuery?: <T>(query: string) => Promise<T>;
  query?: <T>(query: string) => Promise<{ records: T[] }>;
};

type OrgInfoQueryResultType = {
  Id?: string;
  OrganizationType?: string;
  IsSandbox?: boolean;
};

/**
 * Org definition from export.json.
 */
export default class ScriptOrg {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Org username/alias or `csvfile` marker.
   */
  public name = '';

  /**
   * Resolved org username.
   */
  public orgUserName = '';

  /**
   * Salesforce org identifier.
   */
  public orgId = '';

  /**
   * Org instance URL.
   * May be provided manually in export.json for direct token-based auth.
   */
  public instanceUrl = '';

  /**
   * Access token for the org.
   * May be provided manually in export.json for direct token-based auth.
   */
  public accessToken = '';

  /**
   * Flag indicating Person Account support.
   */
  public isPersonAccountEnabled = false;

  /**
   * Media type for this org entry.
   */
  public media: DATA_MEDIA_TYPE = DATA_MEDIA_TYPE.Org;

  /**
   * Indicates the org is the source.
   */
  public isSource = false;

  /**
   * Script instance owning this org.
   */
  public script?: Script;

  /**
   * Cached org describe map.
   */
  public orgDescribe: Map<string, SObjectDescribe> = new Map();

  /**
   * Organization type reported by the org.
   */
  public organizationType = 'Developer Edition';

  /**
   * True when the org is a sandbox.
   */
  public isSandbox = false;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Cached org connection.
   */
  private _connection?: OrgConnectionType;

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns connection details for org API clients.
   *
   * @returns Connection settings.
   */
  public get connectionData(): OrgConnectionDataType {
    return {
      instanceUrl: this.instanceUrl,
      accessToken: this.accessToken,
      apiVersion: this.script?.apiVersion ?? '',
      proxyUrl: this.script?.proxyUrl ?? '',
    };
  }

  /**
   * Returns true when an access token is available.
   * For file media this is always false.
   *
   * @returns True when connected.
   */
  public get isConnected(): boolean {
    return Boolean(this.accessToken);
  }

  /**
   * Returns true when this org represents CSV file media.
   *
   * @returns True when file media.
   */
  public get isFileMedia(): boolean {
    return this.media === DATA_MEDIA_TYPE.File;
  }

  /**
   * Returns true when this org represents Salesforce org media.
   *
   * @returns True when org media.
   */
  public get isOrgMedia(): boolean {
    return this.media === DATA_MEDIA_TYPE.Org;
  }

  /**
   * Returns true when org metadata has been described.
   *
   * @returns True when described.
   */
  public get isDescribed(): boolean {
    return this.orgDescribe.size > 0;
  }

  /**
   * Returns the list of described object names.
   *
   * @returns Object API names.
   */
  public get objectNamesList(): string[] {
    return [...this.orgDescribe.keys()];
  }

  /**
   * Returns true when the org is a production instance.
   *
   * @returns True when production.
   */
  public get isProduction(): boolean {
    return !this.isSandbox && this.organizationType !== 'Developer Edition';
  }

  /**
   * Returns true when the org is a developer edition.
   *
   * @returns True when developer edition.
   */
  public get isDeveloper(): boolean {
    return this.organizationType === 'Developer Edition';
  }

  /**
   * Returns the instance domain name.
   *
   * @returns Domain name or empty string.
   */
  public get instanceDomain(): string {
    return Common.extractDomainFromUrlString(this.instanceUrl) ?? '';
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Initializes org connection and metadata details.
   *
   * @param isSource - True when this org is the source.
   */
  public async setupAsync(isSource: boolean): Promise<void> {
    this.isSource = isSource;
    if (this.isFileMedia) {
      this.orgUserName = this.name;
      return;
    }
    await this._setupConnectionAsync();
  }

  /**
   * Returns an initialized org connection.
   *
   * @returns Org connection instance.
   */
  public async getConnectionAsync(): Promise<Connection> {
    if (this.isFileMedia) {
      throw new CommandInitializationError('Org connection is not available for file media.');
    }
    if (this._connection) {
      return this._connection;
    }
    if (this._hasManualCredentials()) {
      this._connection = this._createManualConnection();
      return this._connection;
    }
    this._connection = (await OrgConnectionAdapter.getConnectionForAliasAsync(
      this.name,
      this.script?.apiVersion
    )) as OrgConnectionType;
    return this._connection;
  }

  /**
   * Prompts the user before allowing production modifications.
   * The prompt is required for target production orgs and for source production orgs
   * when delete-from-source operations are present.
   */
  public async promptUserForProductionModificationAsync(): Promise<void> {
    if (this.isFileMedia || !this.script || !this.isProduction) {
      return;
    }

    const canModify = this.script.canModify?.toLowerCase().trim();
    const domain = this.instanceDomain.toLowerCase();
    if (canModify && canModify === domain) {
      return;
    }

    const requiresPrompt = !this.isSource || this._hasDeleteFromSourceOperation();
    if (!requiresPrompt) {
      return;
    }

    const logger = this.script.logger;
    const response = (await logger?.textPromptAsync(logger?.getMessage('canModifyPrompt', domain) ?? ''))?.trim();
    if (response !== domain) {
      logger?.warn('instanceUrlMismatch', response ?? '', domain);
      const message = logger?.getMessage('actionNotPermitted') ?? 'The action is not permitted.';
      throw new CommandAbortedByUserError(message);
    }
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Establishes the org connection and validates metadata.
   */
  private async _setupConnectionAsync(): Promise<void> {
    const logger = this.script?.logger;
    try {
      logger?.info('connectingToOrgSf', this.name);
      this._connection = (await this.getConnectionAsync()) as OrgConnectionType;
    } catch (error) {
      const message = logger?.getMessage('connectingFailed', this.name) ?? 'Connection failed.';
      throw new CommandInitializationError(message);
    }

    if (!this._connection) {
      const message = logger?.getMessage('connectingFailed', this.name) ?? 'Connection failed.';
      throw new CommandInitializationError(message);
    }

    const authFields = this._connection.getAuthInfoFields?.() ?? {};
    const fallbackOrgUserName = this.orgUserName.length > 0 ? this.orgUserName : this.name;
    this.orgUserName = authFields.username ?? fallbackOrgUserName;
    this.orgId = authFields.orgId ?? this.orgId;
    const instanceUrl =
      authFields.instanceUrl ?? this._connection.instanceUrl ?? this._connection.baseUrl?.() ?? this.instanceUrl;
    this.instanceUrl = instanceUrl ?? this.instanceUrl;
    this.accessToken = this._connection.accessToken ?? this.accessToken;

    await this._validateOrgAsync();

    logger?.info('successfullyConnected', this.name);
  }

  /**
   * Returns true when manual auth data is present in export.json.
   *
   * @returns True when manual auth data is available.
   */
  private _hasManualCredentials(): boolean {
    return Boolean(this.instanceUrl?.trim()) && Boolean(this.accessToken?.trim());
  }

  /**
   * Creates a jsforce connection from manual auth data.
   *
   * @returns Org connection instance.
   */
  private _createManualConnection(): OrgConnectionType {
    const jsforceModule = CjsDependencyAdapters.getJsforceNode() as {
      Connection?: new (options: {
        instanceUrl: string;
        accessToken: string;
        version?: string;
        maxRequest: number;
        proxyUrl?: string;
      }) => Connection;
    };
    const ConnectionCtor = jsforceModule.Connection;
    if (!ConnectionCtor) {
      throw new CommandInitializationError('Unable to create org connection from manual credentials.');
    }
    return new ConnectionCtor({
      instanceUrl: this.instanceUrl,
      accessToken: this.accessToken,
      version: this.script?.apiVersion ?? undefined,
      maxRequest: MAX_PARALLEL_REQUESTS,
      proxyUrl: this.script?.proxyUrl ?? undefined,
    }) as OrgConnectionType;
  }

  /**
   * Validates org access and detects person account support.
   */
  private async _validateOrgAsync(): Promise<void> {
    if (!this._connection) {
      return;
    }

    const logger = this.script?.logger;
    try {
      const info = await this._querySingleRecordAsync<OrgInfoQueryResultType>(
        'SELECT Id, OrganizationType, IsSandbox FROM Organization LIMIT 1'
      );
      if (!this.orgId) {
        this.orgId = info.Id ?? this.orgId;
      }
      this.organizationType = info.OrganizationType ?? this.organizationType;
      this.isSandbox = Boolean(info.IsSandbox);
    } catch (error) {
      const message = logger?.getMessage('accessTokenExpired', this.name) ?? 'Access token expired.';
      throw new CommandInitializationError(message);
    }

    try {
      await this._querySingleRecordAsync<{ IsPersonAccount?: boolean }>('SELECT IsPersonAccount FROM Account LIMIT 1');
      this.isPersonAccountEnabled = true;
    } catch {
      this.isPersonAccountEnabled = false;
    }
  }

  /**
   * Executes a query and returns the first record.
   *
   * @param query - SOQL query string.
   * @returns First record in the response.
   */
  private async _querySingleRecordAsync<T>(query: string): Promise<T> {
    if (!this._connection) {
      throw new Error('Missing org connection.');
    }
    if (this._connection.singleRecordQuery) {
      return this._connection.singleRecordQuery<T>(query);
    }
    if (this._connection.query) {
      const result = await this._connection.query<T>(query);
      const record = result.records?.[0];
      if (!record) {
        throw new Error('No records returned.');
      }
      return record;
    }
    throw new Error('Connection does not support queries.');
  }

  /**
   * Returns true when source deletion is requested.
   *
   * @returns True when delete-from-source is active.
   */
  private _hasDeleteFromSourceOperation(): boolean {
    const script = this.script;
    if (!script) {
      return false;
    }
    return script.getAllObjects().some((object) => object.operation === OPERATION.DeleteSource);
  }
}
