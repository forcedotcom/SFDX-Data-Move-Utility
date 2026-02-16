/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../common/Common.js';
import { DATA_MEDIA_TYPE } from '../common/Enumerations.js';
import {
  CSV_FILE_ORG_NAME,
  POLYMORPHIC_FIELD_DEFINITION_QUERY_TEMPLATE,
  REFERENCED_FIELDS_MAP,
  REFERENCED_SOBJECT_TYPE_MAP,
} from '../constants/Constants.js';
import { CommandInitializationError } from '../models/common/CommandInitializationError.js';
import type { IMetadataProvider } from '../models/job/IMetadataProvider.js';
import Script from '../models/script/Script.js';
import ScriptOrg from '../models/script/ScriptOrg.js';
import SFieldDescribe from '../models/sf/SFieldDescribe.js';
import SObjectDescribe from '../models/sf/SObjectDescribe.js';
import OrgDataService from './OrgDataService.js';

type DescribeFieldType = {
  name: string;
  label?: string;
  type?: string;
  nameField?: boolean;
  externalId?: boolean;
  unique?: boolean;
  custom?: boolean;
  updateable?: boolean;
  createable?: boolean;
  calculated?: boolean;
  cascadeDelete?: boolean;
  referenceTo?: string[];
  length?: number;
  autoNumber?: boolean;
};

type DescribeObjectType = {
  name: string;
  label?: string;
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
  custom?: boolean;
  fields: DescribeFieldType[];
};

export type OrgMetadataCacheType = {
  sourceDescribeCache?: Map<string, SObjectDescribe>;
  targetDescribeCache?: Map<string, SObjectDescribe>;
  polymorphicCache?: Map<string, string[]>;
};

type OrgMetadataProviderOptionsType = {
  script: Script;
  orgDataService?: OrgDataService;
  caches?: OrgMetadataCacheType;
};

type OrgConnectionType = Omit<Connection, 'sobject'> & {
  sobject: (name: string) => {
    describe: () => Promise<DescribeObjectType>;
  };
};

/**
 * Determines whether a value is a describe promise.
 *
 * @param value - Value to test.
 * @returns True when the value is promise-like.
 */
const isPromiseLike = (value: unknown): value is Promise<DescribeObjectType> =>
  typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';

/**
 * Describes a Salesforce object using the org connection.
 *
 * @param connection - Org connection.
 * @param objectName - Object API name.
 * @returns Describe result.
 */
const describeSObjectAsync = async (connection: OrgConnectionType, objectName: string): Promise<DescribeObjectType> => {
  if (!connection?.sobject) {
    throw new CommandInitializationError('Org connection does not support describe.');
  }

  const sobject = connection.sobject(objectName);
  const describeCall = sobject.describe();
  if (!isPromiseLike(describeCall)) {
    throw new CommandInitializationError('Describe did not return a promise.');
  }

  try {
    return await describeCall;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Common.logger.warn(`Describe failed for {${objectName}}: ${message}`);
    throw error;
  }
};

/**
 * Maps a describe response to the internal model.
 *
 * @param objectName - Object API name.
 * @param describe - Describe result.
 * @returns Mapped describe model.
 */
const mapDescribe = (objectName: string, describe: DescribeObjectType): SObjectDescribe => {
  const sObjectDescribe = new SObjectDescribe({
    name: objectName,
    label: describe.label ?? objectName,
    createable: Boolean(describe.createable),
    updateable: Boolean(describe.updateable),
    deletable: Boolean(describe.deletable),
    custom: Boolean(describe.custom),
  });

  describe.fields.forEach((field) => {
    const sField = new SFieldDescribe({
      objectName,
      name: field.name,
      label: field.label ?? field.name,
      type: field.type ?? 'string',
      nameField: Boolean(field.nameField),
      isExternalIdInMetadata: Boolean(field.externalId),
      unique: Boolean(field.unique),
      custom: Boolean(field.custom),
      updateable: Boolean(field.updateable),
      creatable: Boolean(field.createable),
      calculated: Boolean(field.calculated),
      cascadeDelete: Boolean(field.cascadeDelete),
      autoNumber: Boolean(field.autoNumber),
      length: Number(field.length ?? 0),
      isDescribed: true,
    });

    const referenceTo = field.referenceTo ?? [];
    sField.referenceTo = [...referenceTo];
    sField.lookup = referenceTo.length > 0;
    let referencedObjectType = REFERENCED_SOBJECT_TYPE_MAP.get(objectName)?.[sField.name];
    referencedObjectType = REFERENCED_FIELDS_MAP.get(sField.name) ?? referencedObjectType;
    sField.referencedObjectType = referencedObjectType ?? referenceTo[0] ?? '';
    sField.originalReferencedObjectType = sField.referencedObjectType;

    sObjectDescribe.addField(sField);
  });

  return sObjectDescribe;
};

/**
 * Metadata provider backed by Salesforce org describes.
 */
export default class OrgMetadataProvider implements IMetadataProvider {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Script configuration for the run.
   */
  private readonly _script: Script;

  /**
   * Org data service for FieldDefinition queries.
   */
  private readonly _orgDataService: OrgDataService;

  /**
   * Source describe cache keyed by object name.
   */
  private readonly _sourceDescribeCache: Map<string, SObjectDescribe>;

  /**
   * Target describe cache keyed by object name.
   */
  private readonly _targetDescribeCache: Map<string, SObjectDescribe>;

  /**
   * Cached polymorphic field names.
   */
  private readonly _polymorphicCache: Map<string, string[]>;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new metadata provider.
   *
   * @param options - Provider options.
   */
  public constructor(options: OrgMetadataProviderOptionsType) {
    this._script = options.script;
    this._orgDataService = options.orgDataService ?? new OrgDataService(options.script);
    this._sourceDescribeCache = options.caches?.sourceDescribeCache ?? new Map<string, SObjectDescribe>();
    this._targetDescribeCache = options.caches?.targetDescribeCache ?? new Map<string, SObjectDescribe>();
    this._polymorphicCache = options.caches?.polymorphicCache ?? new Map<string, string[]>();
    this._ensureScriptOrgs();
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Describes an sObject by name.
   *
   * @param objectName - Object API name.
   * @param isSource - True for source org metadata.
   * @returns Object description.
   */
  public async describeSObjectAsync(objectName: string, isSource: boolean): Promise<SObjectDescribe> {
    const trimmed = objectName?.trim();
    if (!trimmed) {
      throw new CommandInitializationError('Missing sObject name.');
    }

    const cache = isSource ? this._sourceDescribeCache : this._targetDescribeCache;
    const cached = cache.get(trimmed);
    if (cached) {
      return cached;
    }

    const org = this._resolveOrg(isSource);
    const existing = org.orgDescribe.get(trimmed);
    if (existing) {
      cache.set(trimmed, existing);
      return existing;
    }

    const connection = await this._getConnectionAsync(org);
    this._logDescribeStart(trimmed, org.name);
    const describeResult = await describeSObjectAsync(connection, trimmed);
    const describe = mapDescribe(trimmed, describeResult);

    org.orgDescribe.set(trimmed, describe);
    cache.set(trimmed, describe);
    return describe;
  }

  /**
   * Returns polymorphic field names for the given object.
   *
   * @param objectName - Object API name.
   * @returns List of polymorphic field API names.
   */
  public async getPolymorphicObjectFieldsAsync(objectName: string): Promise<string[]> {
    const trimmed = objectName?.trim();
    if (!trimmed) {
      return [];
    }

    const cached = this._polymorphicCache.get(trimmed);
    if (cached) {
      return cached;
    }

    const org = this._resolvePolymorphicOrg();
    if (!org || org.isFileMedia) {
      return [];
    }

    const query = Common.formatStringLog(POLYMORPHIC_FIELD_DEFINITION_QUERY_TEMPLATE, trimmed);
    const records = await this._orgDataService.queryOrgAsync(query, org);
    const fields = records
      .map((record) => String(record['QualifiedApiName'] ?? '').trim())
      .filter((value) => value.length > 0);

    this._polymorphicCache.set(trimmed, fields);
    return fields;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Ensures source and target org placeholders exist.
   */
  private _ensureScriptOrgs(): void {
    const script = this._script;
    if (!script.sourceOrg && script.runInfo?.sourceUsername) {
      script.sourceOrg = this._createOrgPlaceholder(script.runInfo.sourceUsername);
    }
    if (!script.targetOrg && script.runInfo?.targetUsername) {
      script.targetOrg = this._createOrgPlaceholder(script.runInfo.targetUsername);
    }
  }

  /**
   * Logs the describe operation for visibility.
   *
   * @param objectName - Object API name.
   * @param orgName - Org display name.
   */
  private _logDescribeStart(objectName: string, orgName: string): void {
    this._script.logger?.log('retrievingObjectMetadata', objectName, orgName);
  }

  /**
   * Resolves org based on source/target selector.
   *
   * @param isSource - True when source org.
   * @returns Script org.
   */
  private _resolveOrg(isSource: boolean): ScriptOrg {
    const org = isSource ? this._script.sourceOrg : this._script.targetOrg;
    if (!org || org.isFileMedia) {
      throw new CommandInitializationError('Org metadata is not available for file media.');
    }
    return org;
  }

  /**
   * Resolves org to use for polymorphic detection.
   *
   * @returns Script org or undefined.
   */
  private _resolvePolymorphicOrg(): ScriptOrg | undefined {
    if (this._script.sourceOrg && !this._script.sourceOrg.isFileMedia) {
      return this._script.sourceOrg;
    }
    if (this._script.targetOrg && !this._script.targetOrg.isFileMedia) {
      return this._script.targetOrg;
    }
    return undefined;
  }

  /**
   * Creates a minimal ScriptOrg placeholder for metadata.
   *
   * @param name - Org alias or username.
   * @returns ScriptOrg placeholder.
   */
  private _createOrgPlaceholder(name: string): ScriptOrg {
    const org = new ScriptOrg();
    org.name = name;
    org.script = this._script;
    org.media = name.trim().toLowerCase() === CSV_FILE_ORG_NAME ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org;
    return org;
  }

  /**
   * Resolves a connection for the given org.
   *
   * @param org - Script org.
   * @returns Connection instance.
   */
  private async _getConnectionAsync(org: ScriptOrg): Promise<OrgConnectionType> {
    void this;
    return (await org.getConnectionAsync()) as OrgConnectionType;
  }
}
