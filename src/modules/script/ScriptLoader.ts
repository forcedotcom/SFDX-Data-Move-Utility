/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import type { ClassConstructor } from 'class-transformer';
import { Common } from '../common/Common.js';
import { OPERATION } from '../common/Enumerations.js';
import { SCRIPT_FILE_NAME } from '../constants/Constants.js';
import CjsDependencyAdapters from '../dependencies/CjsDependencyAdapters.js';
import { CommandInitializationError } from '../models/common/CommandInitializationError.js';
import Script from '../models/script/Script.js';
import ScriptAddonManifestDefinition from '../models/script/ScriptAddonManifestDefinition.js';
import ScriptMappingItem from '../models/script/ScriptMappingItem.js';
import ScriptMockField from '../models/script/ScriptMockField.js';
import ScriptObject from '../models/script/ScriptObject.js';
import ScriptObjectSet from '../models/script/ScriptObjectSet.js';
import ScriptOrg from '../models/script/ScriptOrg.js';
import type LoggingService from '../logging/LoggingService.js';

type RawRecordType = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecordType =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Loads and normalizes export.json into Script models.
 */
export default class ScriptLoader {
  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Loads export.json from the supplied root path.
   *
   * @param rootPath - Working directory containing export.json.
   * @param logger - Logging service instance.
   * @param scriptFilePath - Optional explicit export.json file path.
   * @returns Parsed Script instance.
   */
  public static async loadFromPathAsync(
    rootPath: string,
    logger: LoggingService,
    scriptFilePath?: string
  ): Promise<Script> {
    await this._ensureWorkingPathAsync(rootPath, logger);
    const scriptPath = scriptFilePath?.trim() ? path.resolve(scriptFilePath) : path.join(rootPath, SCRIPT_FILE_NAME);
    logger.info('loadingExportJson', scriptPath);

    let rawJson = '';
    try {
      rawJson = await readFile(scriptPath, 'utf8');
    } catch (error) {
      const code = this._getNodeErrorCode(error);
      if (code === 'ENOENT') {
        throw new CommandInitializationError(logger.getMessage('packageFileDoesNotExist'));
      }
      throw new CommandInitializationError(
        logger.getMessage('exportJsonFileLoadError', this._formatErrorMessage(error))
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch (error) {
      throw new CommandInitializationError(
        logger.getMessage('incorrectExportJsonFormat', this._formatErrorMessage(error))
      );
    }

    const script = this._buildScript(parsed, logger);
    this._applyCsvOptions(script, parsed);
    script.basePath = rootPath;
    script.objectSetIndex = 0;
    return script;
  }

  /**
   * Rehydrates a script instance for a specific object set index.
   *
   * @param baseScript - Base script with working JSON.
   * @param objectSetIndex - Target object set index.
   * @returns Script instance scoped to the object set.
   */
  public static createScriptForObjectSet(baseScript: Script, objectSetIndex: number): Script {
    const workingJson = baseScript.workingJson ?? {};
    const script = this._buildScript(workingJson);
    this._applyCsvOptions(script, workingJson);
    this._inheritRuntimeState(baseScript, script, objectSetIndex);
    const objectSets = Array.isArray(script.objectSets) ? script.objectSets : [];
    if (objectSets.length === 0) {
      const nextBaseScript = baseScript;
      nextBaseScript.objectSetIndex = objectSetIndex;
      return nextBaseScript;
    }
    const nextObjectSet = objectSets[objectSetIndex] ?? objectSets[0];
    script.objectSets = [nextObjectSet];
    script.objects = [];
    this._refreshObjectsMap(script);
    return script;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Ensures the working directory exists.
   *
   * @param rootPath - Working directory path.
   * @param logger - Logging service instance.
   */
  private static async _ensureWorkingPathAsync(rootPath: string, logger: LoggingService): Promise<void> {
    try {
      const info = await stat(rootPath);
      if (!info.isDirectory()) {
        throw new CommandInitializationError(logger.getMessage('workingPathDoesNotExist'));
      }
    } catch (error) {
      const code = this._getNodeErrorCode(error);
      if (code === 'ENOENT' || error instanceof CommandInitializationError) {
        throw new CommandInitializationError(logger.getMessage('workingPathDoesNotExist'));
      }
      throw error;
    }
  }

  /**
   * Builds the Script instance from parsed JSON.
   *
   * @param raw - Parsed JSON payload.
   * @returns Script instance.
   */
  private static _buildScript(raw: unknown, logger?: LoggingService): Script {
    CjsDependencyAdapters.loadReflectMetadata();
    const script = this._plainToInstance(Script, isRecord(raw) ? raw : {});
    this._applyUndefinedDefaultsFromTemplate(script, new Script());
    script.workingJson = this._cloneWorkingJson(raw);

    if (isRecord(raw)) {
      this._assignArrayPropertyFromRaw<ScriptObjectSet>(
        raw,
        'objectSets',
        (value) => {
          script.objectSets = value as ScriptObjectSet[];
        },
        (value) => this._buildObjectSets(value, logger)
      );
      this._assignArrayPropertyFromRaw<ScriptObject>(
        raw,
        'objects',
        (value) => {
          script.objects = value as ScriptObject[];
        },
        (value) => this._buildObjects(value, logger)
      );
      this._assignArrayPropertyFromRaw<ScriptOrg>(
        raw,
        'orgs',
        (value) => {
          script.orgs = value as ScriptOrg[];
        },
        (value) => this._buildOrgs(value)
      );
      this._assignArrayPropertyFromRaw<string>(
        raw,
        'excludedObjects',
        (value) => {
          script.excludedObjects = value as string[];
        },
        (value) => this._normalizeStringArray(value)
      );
      this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
        raw,
        'beforeAddons',
        (value) => {
          script.beforeAddons = value as ScriptAddonManifestDefinition[];
        },
        (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
      );
      this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
        raw,
        'afterAddons',
        (value) => {
          script.afterAddons = value as ScriptAddonManifestDefinition[];
        },
        (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
      );
      this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
        raw,
        'dataRetrievedAddons',
        (value) => {
          script.dataRetrievedAddons = value as ScriptAddonManifestDefinition[];
        },
        (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
      );
    }

    this._normalizeObjectSets(script);
    this._refreshObjectsMap(script);
    return script;
  }

  /**
   * Normalizes object set structure by synthesizing a set from objects.
   *
   * @param script - Script instance to normalize.
   */
  private static _normalizeObjectSets(script: Script): void {
    const normalizedScript = script;
    if (typeof normalizedScript.objectSets === 'undefined') {
      normalizedScript.objectSets = [];
    }
    if (typeof normalizedScript.objects === 'undefined') {
      normalizedScript.objects = [];
    }
    if (
      Array.isArray(normalizedScript.objectSets) &&
      Array.isArray(normalizedScript.objects) &&
      normalizedScript.objects.length > 0
    ) {
      normalizedScript.objectSets.unshift(new ScriptObjectSet(normalizedScript.objects));
      normalizedScript.objects = [];
    }
  }

  /**
   * Copies runtime state from the base script into the new script.
   *
   * @param baseScript - Base script instance.
   * @param script - Script instance to update.
   * @param objectSetIndex - Object set index being processed.
   */
  private static _inheritRuntimeState(baseScript: Script, script: Script, objectSetIndex: number): void {
    const nextScript = script;
    nextScript.basePath = baseScript.basePath;
    nextScript.logger = baseScript.logger;
    nextScript.sourceOrg = baseScript.sourceOrg;
    nextScript.targetOrg = baseScript.targetOrg;
    nextScript.sourceTargetFieldMapping = baseScript.sourceTargetFieldMapping;
    nextScript.addonManager = baseScript.addonManager;
    nextScript.runInfo = baseScript.runInfo;
    nextScript.canModify = baseScript.canModify;
    nextScript.logfullquery = baseScript.logfullquery;
    nextScript.extraSObjectDescriptions = baseScript.extraSObjectDescriptions;
    nextScript.groupQuery = baseScript.groupQuery;
    nextScript.apiVersion = baseScript.apiVersion;
    nextScript.simulationMode = baseScript.simulationMode;
    nextScript.proxyUrl = baseScript.proxyUrl;
    nextScript.objectSetIndex = objectSetIndex;
  }

  /**
   * Builds the script objects map using the current object list.
   *
   * @param script - Script instance to update.
   */
  private static _refreshObjectsMap(script: Script): void {
    const nextScript = script;
    nextScript.objectsMap.clear();
    nextScript.getAllObjects().forEach((object) => {
      if (object.name) {
        nextScript.objectsMap.set(object.name, object);
      }
    });
  }

  /**
   * Builds ScriptObjectSet instances from raw JSON.
   *
   * @param rawObjectSets - Raw object set payload.
   * @returns Script object sets.
   */
  private static _buildObjectSets(rawObjectSets: unknown, logger?: LoggingService): ScriptObjectSet[] {
    if (!Array.isArray(rawObjectSets)) {
      return [];
    }
    return rawObjectSets
      .map((entry) => this._buildObjectSet(entry, logger))
      .filter((value): value is ScriptObjectSet => Boolean(value));
  }

  /**
   * Builds a ScriptObjectSet from raw JSON entry.
   *
   * @param rawObjectSet - Raw object set entry.
   * @returns Script object set or undefined if invalid.
   */
  private static _buildObjectSet(rawObjectSet: unknown, logger?: LoggingService): ScriptObjectSet | undefined {
    if (Array.isArray(rawObjectSet)) {
      return new ScriptObjectSet(this._buildObjects(rawObjectSet, logger));
    }
    if (isRecord(rawObjectSet)) {
      const objectSet = this._plainToInstance(ScriptObjectSet, rawObjectSet);
      this._applyUndefinedDefaultsFromTemplate(objectSet, new ScriptObjectSet());
      this._assignArrayPropertyFromRaw<ScriptObject>(
        rawObjectSet,
        'objects',
        (value) => {
          objectSet.objects = value as ScriptObject[];
        },
        (value) => this._buildObjects(value, logger)
      );
      return objectSet;
    }
    return undefined;
  }

  /**
   * Builds ScriptObject instances from raw JSON.
   *
   * @param rawObjects - Raw object definitions.
   * @returns Script objects.
   */
  private static _buildObjects(rawObjects: unknown, logger?: LoggingService): ScriptObject[] {
    if (!Array.isArray(rawObjects)) {
      return [];
    }
    return rawObjects
      .map((entry) => this._buildObject(entry, logger))
      .filter((value): value is ScriptObject => Boolean(value));
  }

  /**
   * Builds a ScriptObject from raw JSON.
   *
   * @param rawObject - Raw object definition.
   * @returns Script object or undefined if invalid.
   */
  private static _buildObject(rawObject: unknown, logger?: LoggingService): ScriptObject | undefined {
    if (!isRecord(rawObject)) {
      return undefined;
    }
    const object = this._plainToInstance(ScriptObject, rawObject);
    this._applyUndefinedDefaultsFromTemplate(object, new ScriptObject());
    object.name = '';
    object.isFromOriginalScript = true;
    delete (object as unknown as RawRecordType).allRecords;
    this._assignArrayPropertyFromRaw<ScriptMappingItem>(
      rawObject,
      'fieldMapping',
      (value) => {
        object.fieldMapping = value as ScriptMappingItem[];
      },
      (value) => this._plainToInstanceArray(ScriptMappingItem, value)
    );
    this._assignArrayPropertyFromRaw<ScriptMockField>(
      rawObject,
      'mockFields',
      (value) => {
        object.mockFields = value as ScriptMockField[];
      },
      (value) => this._plainToInstanceArray(ScriptMockField, value)
    );
    this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
      rawObject,
      'beforeAddons',
      (value) => {
        object.beforeAddons = value as ScriptAddonManifestDefinition[];
      },
      (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
    );
    this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
      rawObject,
      'afterAddons',
      (value) => {
        object.afterAddons = value as ScriptAddonManifestDefinition[];
      },
      (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
    );
    this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
      rawObject,
      'beforeUpdateAddons',
      (value) => {
        object.beforeUpdateAddons = value as ScriptAddonManifestDefinition[];
      },
      (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
    );
    this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
      rawObject,
      'afterUpdateAddons',
      (value) => {
        object.afterUpdateAddons = value as ScriptAddonManifestDefinition[];
      },
      (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
    );
    this._assignArrayPropertyFromRaw<ScriptAddonManifestDefinition>(
      rawObject,
      'filterRecordsAddons',
      (value) => {
        object.filterRecordsAddons = value as ScriptAddonManifestDefinition[];
      },
      (value) => this._sanitizeExportJsonAddons(this._plainToInstanceArray(ScriptAddonManifestDefinition, value))
    );
    this._assignArrayPropertyFromRaw<string>(
      rawObject,
      'excludedFields',
      (value) => {
        object.excludedFields = value as string[];
      },
      (value) => this._normalizeStringArray(value)
    );
    this._assignArrayPropertyFromRaw<string>(
      rawObject,
      'excludedFromUpdateFields',
      (value) => {
        object.excludedFromUpdateFields = value as string[];
      },
      (value) => this._normalizeStringArray(value)
    );
    const operation = this._resolveOperation(rawObject.operation);
    if (typeof operation !== 'undefined') {
      object.operation = operation;
    }
    const query =
      typeof rawObject.query === 'string' && rawObject.query.trim().length > 0 ? rawObject.query.trim() : '';
    object.query = query;
    if (!object.query) {
      const objectName = typeof rawObject.name === 'string' && rawObject.name.trim().length > 0 ? rawObject.name : '';
      logger?.warn('objectIsExcluded', objectName || 'UnknownObject');
      return undefined;
    }
    return object;
  }

  /**
   * Sanitizes add-ons declared directly in export.json.
   * Export.json supports module/path locator normalization.
   *
   * @param addons - Add-ons parsed from export.json.
   * @returns Sanitized add-on definitions.
   */
  private static _sanitizeExportJsonAddons(addons: ScriptAddonManifestDefinition[]): ScriptAddonManifestDefinition[] {
    return addons.map((addon) => {
      this._applyUndefinedDefaultsFromTemplate(addon, new ScriptAddonManifestDefinition());
      addon.normalizeLocatorFields();
      return addon;
    });
  }

  /**
   * Builds ScriptOrg instances from raw JSON.
   *
   * @param rawOrgs - Raw org definitions.
   * @returns Script orgs.
   */
  private static _buildOrgs(rawOrgs: unknown): ScriptOrg[] {
    const orgs = this._plainToInstanceArray(ScriptOrg, rawOrgs);
    orgs.forEach((org) => this._applyUndefinedDefaultsFromTemplate(org, new ScriptOrg()));
    return orgs;
  }

  /**
   * Applies CSV settings to Common and normalizes script values.
   *
   * @param script - Script instance to update.
   */
  private static _applyCsvOptions(script: Script, raw?: unknown): void {
    const normalizedScript = script;
    const rawRecord = isRecord(raw) ? raw : undefined;
    this._applyCsvDelimiterOptions(normalizedScript, rawRecord);
    this._applyCsvEncodingOption(normalizedScript, rawRecord);
    this._applyCsvBooleanOptions(normalizedScript, rawRecord);
  }

  /**
   * Applies CSV delimiter options.
   *
   * @param script - Script instance to update.
   * @param rawRecord - Raw script record.
   */
  private static _applyCsvDelimiterOptions(script: Script, rawRecord?: RawRecordType): void {
    const nextScript = script;
    const commonDelimiterValue = this._getDefinedPropertyValue(rawRecord, 'csvFileDelimiter');
    if (typeof commonDelimiterValue !== 'undefined') {
      const commonDelimiter = this._resolveCsvDelimiterPreservingProvidedValue(commonDelimiterValue);
      nextScript.csvFileDelimiter = commonDelimiter as string;
      nextScript.csvReadFileDelimiter = commonDelimiter as string;
      nextScript.csvWriteFileDelimiter = commonDelimiter as string;
    } else {
      const readDelimiterValue = this._getDefinedPropertyValue(rawRecord, 'csvReadFileDelimiter');
      if (typeof readDelimiterValue !== 'undefined') {
        const readDelimiter = this._resolveCsvDelimiterPreservingProvidedValue(readDelimiterValue);
        nextScript.csvReadFileDelimiter = readDelimiter as string;
      }
      const writeDelimiterValue = this._getDefinedPropertyValue(rawRecord, 'csvWriteFileDelimiter');
      if (typeof writeDelimiterValue !== 'undefined') {
        const writeDelimiter = this._resolveCsvDelimiterPreservingProvidedValue(writeDelimiterValue);
        nextScript.csvWriteFileDelimiter = writeDelimiter as string;
      }
    }
    Common.csvReadFileDelimiter = nextScript.csvReadFileDelimiter;
    Common.csvWriteFileDelimiter = nextScript.csvWriteFileDelimiter;
  }

  /**
   * Applies CSV encoding option.
   *
   * @param script - Script instance to update.
   * @param rawRecord - Raw script record.
   */
  private static _applyCsvEncodingOption(script: Script, rawRecord?: RawRecordType): void {
    const nextScript = script;
    const csvEncodingValue = this._getDefinedPropertyValue(rawRecord, 'csvFileEncoding');
    if (typeof csvEncodingValue !== 'undefined') {
      nextScript.csvFileEncoding = this._resolveCsvEncodingPreservingProvidedValue(csvEncodingValue) as BufferEncoding;
    } else {
      nextScript.csvFileEncoding = this._resolveCsvEncoding(nextScript.csvFileEncoding);
    }
    Common.csvFileEncoding = nextScript.csvFileEncoding;
  }

  /**
   * Applies CSV boolean options.
   *
   * @param script - Script instance to update.
   * @param rawRecord - Raw script record.
   */
  private static _applyCsvBooleanOptions(script: Script, rawRecord?: RawRecordType): void {
    const nextScript = script;
    const csvInsertNullsValue = this._getDefinedPropertyValue(rawRecord, 'csvInsertNulls');
    if (typeof csvInsertNullsValue !== 'undefined') {
      nextScript.csvInsertNulls = csvInsertNullsValue as boolean;
    } else {
      nextScript.csvInsertNulls = true;
    }
    Common.csvInsertNulls = nextScript.csvInsertNulls;

    const csvEuropeanDateValue = this._getDefinedPropertyValue(rawRecord, 'csvUseEuropeanDateFormat');
    if (typeof csvEuropeanDateValue !== 'undefined') {
      nextScript.csvUseEuropeanDateFormat = csvEuropeanDateValue as boolean;
    }
    Common.csvUseEuropeanDateFormat = nextScript.csvUseEuropeanDateFormat;

    const csvUpperHeadersValue = this._getDefinedPropertyValue(rawRecord, 'csvWriteUpperCaseHeaders');
    if (typeof csvUpperHeadersValue !== 'undefined') {
      nextScript.csvWriteUpperCaseHeaders = csvUpperHeadersValue as boolean;
    }
    Common.csvWriteUpperCaseHeaders = nextScript.csvWriteUpperCaseHeaders;

    const hasCsvUseUtf8BomInScript = this._hasDefinedProperty(rawRecord, 'csvUseUtf8Bom');
    const hasLegacyUseUtf8BomInScript = this._hasDefinedProperty(rawRecord, 'useUtf8Bom');
    if (hasCsvUseUtf8BomInScript) {
      nextScript.csvUseUtf8Bom = this._getDefinedPropertyValue(rawRecord, 'csvUseUtf8Bom') as boolean;
    } else if (hasLegacyUseUtf8BomInScript) {
      nextScript.csvUseUtf8Bom = this._getDefinedPropertyValue(rawRecord, 'useUtf8Bom') as boolean;
    } else {
      nextScript.csvUseUtf8Bom = true;
    }
    Common.csvUseUtf8Bom = nextScript.csvUseUtf8Bom;

    const csvAlwaysQuotedValue = this._getDefinedPropertyValue(rawRecord, 'csvAlwaysQuoted');
    if (typeof csvAlwaysQuotedValue !== 'undefined') {
      nextScript.csvAlwaysQuoted = csvAlwaysQuotedValue as boolean;
    }
    Common.csvAlwaysQuoted = nextScript.csvAlwaysQuoted;
  }

  /**
   * Resolves CSV delimiter while preserving non-string provided values.
   *
   * @param value - Candidate delimiter value.
   * @returns Normalized delimiter or the original provided value.
   */
  private static _resolveCsvDelimiterPreservingProvidedValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    return this._resolveCsvDelimiter(value) ?? value;
  }

  /**
   * Resolves CSV encoding while preserving non-string provided values.
   *
   * @param value - Candidate encoding value.
   * @returns Normalized encoding or the original provided value.
   */
  private static _resolveCsvEncodingPreservingProvidedValue(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    return this._resolveCsvEncoding(value);
  }

  /**
   * Assigns an array-backed property from raw JSON preserving explicit non-array values.
   *
   * @param rawRecord - Raw source record.
   * @param propertyName - Property name to assign.
   * @param assign - Assignment callback.
   * @param mapArray - Array mapper for valid array values.
   */
  private static _assignArrayPropertyFromRaw<T>(
    rawRecord: RawRecordType,
    propertyName: string,
    assign: (value: unknown) => void,
    mapArray: (value: unknown[]) => T[]
  ): void {
    if (!Object.hasOwn(rawRecord, propertyName)) {
      return;
    }

    const rawValue = rawRecord[propertyName];
    if (typeof rawValue === 'undefined') {
      return;
    }
    if (Array.isArray(rawValue)) {
      assign(mapArray(rawValue));
      return;
    }
    assign(rawValue);
  }

  /**
   * Returns true when raw object contains the property with a defined value.
   *
   * @param rawRecord - Raw source record.
   * @param propertyName - Property name.
   * @returns True when the property exists and is not undefined.
   */
  private static _hasDefinedProperty(rawRecord: RawRecordType | undefined, propertyName: string): boolean {
    return Boolean(rawRecord && Object.hasOwn(rawRecord, propertyName) && rawRecord[propertyName] !== undefined);
  }

  /**
   * Returns a raw property value only when the property exists and is not undefined.
   *
   * @param rawRecord - Raw source record.
   * @param propertyName - Property name.
   * @returns Property value or undefined when not provided.
   */
  private static _getDefinedPropertyValue(rawRecord: RawRecordType | undefined, propertyName: string): unknown {
    if (!this._hasDefinedProperty(rawRecord, propertyName)) {
      return undefined;
    }
    return rawRecord?.[propertyName];
  }

  /**
   * Applies template defaults only for undefined fields of the target object.
   *
   * @param target - Target object to update.
   * @param template - Template object that provides defaults.
   */
  private static _applyUndefinedDefaultsFromTemplate<T extends object>(target: T, template: T): void {
    const nextTarget = target as Record<string, unknown>;
    const templateRecord = template as Record<string, unknown>;
    Object.keys(templateRecord).forEach((key) => {
      if (typeof nextTarget[key] === 'undefined') {
        nextTarget[key] = templateRecord[key];
      }
    });
  }

  /**
   * Resolves the CSV delimiter when valid.
   *
   * @param value - Candidate delimiter.
   * @returns Validated delimiter or undefined.
   */
  private static _resolveCsvDelimiter(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    if (!normalized) {
      return undefined;
    }
    const keyword = normalized.toLowerCase();
    if (keyword === 'comma') {
      return ',';
    }
    if (keyword === 'semicolon') {
      return ';';
    }
    if (keyword === 'tab' || normalized === '\\t') {
      return '\t';
    }
    return normalized;
  }

  /**
   * Resolves CSV file encoding.
   *
   * @param value - Candidate encoding.
   * @returns Normalized encoding.
   */
  private static _resolveCsvEncoding(value: unknown): BufferEncoding {
    if (typeof value !== 'string') {
      return 'utf8';
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return 'utf8';
    }

    const allowedEncodings: BufferEncoding[] = [
      'ascii',
      'base64',
      'base64url',
      'binary',
      'hex',
      'latin1',
      'ucs2',
      'ucs-2',
      'utf16le',
      'utf-16le',
      'utf8',
      'utf-8',
    ];

    if ((allowedEncodings as string[]).includes(normalized)) {
      return normalized as BufferEncoding;
    }
    return 'utf8';
  }

  /**
   * Normalizes an unknown array into a string array.
   *
   * @param value - Candidate array.
   * @returns String array.
   */
  private static _normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  /**
   * Resolves the operation enum from a raw value.
   *
   * @param operation - Raw operation value.
   * @returns Parsed operation or undefined.
   */
  private static _resolveOperation(operation: unknown): OPERATION | undefined {
    if (typeof operation === 'number') {
      return OPERATION[operation] ? operation : undefined;
    }
    if (typeof operation !== 'string') {
      return undefined;
    }
    const normalized = operation.trim().toLowerCase();
    const match = Object.keys(OPERATION).find((key) => key.toLowerCase() === normalized);
    if (!match) {
      return undefined;
    }
    const value = OPERATION[match as keyof typeof OPERATION];
    return typeof value === 'number' ? value : undefined;
  }

  /**
   * Clone export.json payload for rehydration.
   *
   * @param raw - Raw JSON payload.
   * @returns Cloned payload.
   */
  private static _cloneWorkingJson(raw: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(raw)) as unknown;
    } catch {
      return raw;
    }
  }

  /**
   * Builds a class instance using class-transformer.
   *
   * @param ctor - Target class constructor.
   * @param plain - Plain payload.
   * @returns Class instance.
   */
  private static _plainToInstance<T>(ctor: ClassConstructor<T>, plain: unknown): T {
    const { plainToInstance } = CjsDependencyAdapters.getClassTransformer();
    return plainToInstance(ctor, plain, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
  }

  /**
   * Builds an array of class instances using class-transformer.
   *
   * @param ctor - Target class constructor.
   * @param plain - Plain payload.
   * @returns Array of instances.
   */
  private static _plainToInstanceArray<T>(ctor: ClassConstructor<T>, plain: unknown): T[] {
    if (!Array.isArray(plain)) {
      return [];
    }
    const { plainToInstance } = CjsDependencyAdapters.getClassTransformer();
    return plainToInstance(ctor, plain, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
  }

  /**
   * Extract a Node error code when available.
   *
   * @param error - Error instance.
   * @returns Error code or undefined.
   */
  private static _getNodeErrorCode(error: unknown): string | undefined {
    if (error instanceof Error && 'code' in error) {
      const value = (error as { code?: unknown }).code;
      if (typeof value === 'string') {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Normalize an error value into a string message.
   *
   * @param error - Error instance.
   * @returns Error message string.
   */
  private static _formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message || error.name;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }
}
