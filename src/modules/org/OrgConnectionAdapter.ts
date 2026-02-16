/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Org } from '@salesforce/core';
import type { Connection } from '@jsforce/jsforce-node';
import { CSV_FILE_ORG_NAME, ORG_INFO_QUERY } from '../constants/Constants.js';
import type { OrgConnectionInfoType } from './models/OrgConnectionInfoType.js';
import type { OrgConnectionPairType } from './models/OrgConnectionPairType.js';

/**
 * Auth fields returned by the connection.
 */
type AuthInfoFieldsType = {
  username?: string;
  orgId?: string;
  instanceUrl?: string;
};

/**
 * Connection facade with the methods used by the adapter.
 */
type OrgConnectionType = Connection & {
  getAuthInfoFields: () => AuthInfoFieldsType;
  singleRecordQuery: <T>(query: string) => Promise<T>;
  baseUrl: () => string;
  getApiVersion: () => string;
};

/**
 * Adapter for resolving org aliases and creating connections.
 */
export default class OrgConnectionAdapter {
  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Resolve an alias or username into an org instance.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @returns The resolved org instance.
   */
  public static async resolveOrgAsync(aliasOrUsername: string): Promise<Org> {
    return Org.create({ aliasOrUsername });
  }

  /**
   * Resolve source and target orgs from CLI flags.
   *
   * @param sourceAliasOrUsername - Source org alias or username.
   * @param targetAliasOrUsername - Target org alias or username.
   * @returns The resolved orgs for the run command.
   */
  public static async resolveOrgPairAsync(
    sourceAliasOrUsername?: string,
    targetAliasOrUsername?: string
  ): Promise<OrgConnectionPairType> {
    const resolved = this._normalizeOrgNames(sourceAliasOrUsername, targetAliasOrUsername);
    const sourceOrg = await this._resolveOptionalOrgAsync(resolved.source);
    const targetOrg = await this._resolveOptionalOrgAsync(resolved.target);

    return { sourceOrg, targetOrg };
  }

  /**
   * Get a jsforce connection for an org instance.
   *
   * @param org - Resolved org instance.
   * @param apiVersion - Optional API version override.
   * @returns Connection instance for the org.
   */
  public static getConnectionAsync(org: Org, apiVersion?: string): Promise<Connection> {
    return Promise.resolve(org.getConnection(apiVersion));
  }

  /**
   * Resolve a connection from an alias or username.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @param apiVersion - Optional API version override.
   * @returns Connection instance for the org.
   */
  public static async getConnectionForAliasAsync(aliasOrUsername: string, apiVersion?: string): Promise<Connection> {
    const org = await this.resolveOrgAsync(aliasOrUsername);
    return this.getConnectionAsync(org, apiVersion);
  }

  /**
   * Resolve basic org info by establishing a connection.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @param apiVersion - Optional API version override.
   * @returns Basic org connection info.
   */
  public static async getOrgInfoAsync(aliasOrUsername: string, apiVersion?: string): Promise<OrgConnectionInfoType> {
    const org = await this.resolveOrgAsync(aliasOrUsername);
    const connection = (await this.getConnectionAsync(org, apiVersion)) as OrgConnectionType;
    const authFields = connection.getAuthInfoFields();

    const orgRecord = await connection.singleRecordQuery<{ Id: string }>(ORG_INFO_QUERY);
    const username = authFields.username ?? aliasOrUsername;
    const orgId = authFields.orgId ?? orgRecord.Id;
    const instanceUrl = authFields.instanceUrl ?? connection.baseUrl();

    return {
      aliasOrUsername,
      username,
      orgId,
      instanceUrl,
      apiVersion: connection.getApiVersion(),
    };
  }

  /**
   * Test connectivity for an alias or username and return basic info.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @param apiVersion - Optional API version override.
   * @returns Basic org connection info.
   */
  public static async testConnectionAsync(
    aliasOrUsername: string,
    apiVersion?: string
  ): Promise<OrgConnectionInfoType> {
    return this.getOrgInfoAsync(aliasOrUsername, apiVersion);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Resolve an optional org alias if it is not a CSV marker.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @returns The resolved org or undefined when not applicable.
   */
  private static async _resolveOptionalOrgAsync(aliasOrUsername?: string): Promise<Org | undefined> {
    if (!aliasOrUsername) {
      return undefined;
    }

    if (this._isCsvFileAlias(aliasOrUsername)) {
      return undefined;
    }

    return this.resolveOrgAsync(aliasOrUsername);
  }

  /**
   * Normalize source and target org names using legacy fallback rules.
   *
   * @param sourceAliasOrUsername - Source org alias or username.
   * @param targetAliasOrUsername - Target org alias or username.
   * @returns Normalized source and target values.
   */
  private static _normalizeOrgNames(
    sourceAliasOrUsername?: string,
    targetAliasOrUsername?: string
  ): { source?: string; target?: string } {
    let source = sourceAliasOrUsername;
    let target = targetAliasOrUsername;

    if (!source && target) {
      source = target;
    } else if (source && !target) {
      target = source;
    }

    return { source, target };
  }

  /**
   * Determine whether the alias represents CSV-based input/output.
   *
   * @param aliasOrUsername - Alias or username configured in the SF CLI.
   * @returns True when CSV files are used instead of an org.
   */
  private static _isCsvFileAlias(aliasOrUsername: string): boolean {
    return aliasOrUsername.trim().toLowerCase() === CSV_FILE_ORG_NAME;
  }
}
