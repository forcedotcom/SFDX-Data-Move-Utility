/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import 'reflect-metadata';
import 'es6-shim';

import { Type } from 'class-transformer';
import * as fs from 'fs';
import * as path from 'path';
import {
  composeQuery,
  Field as SOQLField,
  getComposedField,
} from 'soql-parser-js';

import {
  ObjectFieldMapping,
  ScriptObject,
  ScriptObjectSet,
  ScriptOrg,
  SObjectDescribe,
} from '../';
import ISfdmuRunScript
  from '../../../addons/components/sfdmu-run/ISfdmuRunScript';
import ISfdmuRunScriptObject
  from '../../../addons/components/sfdmu-run/ISfdmuRunScriptObject';
import SfdmuRunAddonManager
  from '../../../addons/components/sfdmu-run/sfdmuRunAddonManager';
import SfdmuRunAddonRuntime
  from '../../../addons/components/sfdmu-run/sfdmuRunAddonRuntime';
import { IAppScript } from '../../app/appModels';
import { Common } from '../../components/common_components/common';
import {
  DATA_CACHE_TYPES,
  DATA_MEDIA_TYPE,
  OPERATION,
} from '../../components/common_components/enumerations';
import {
  Logger,
  RESOURCES,
} from '../../components/common_components/logger';
import { Sfdx } from '../../components/common_components/sfdx';
import { CONSTANTS } from '../../components/common_components/statics';
import {
  CommandExecutionError,
  CommandInitializationError,
} from '../common_models/errors';
import ICommandRunInfo from '../common_models/ICommandRunInfo';
import IPluginInfo from '../common_models/IPluginInfo';
import MigrationJob from '../job_models/migrationJob';
import ScriptAddonManifestDefinition from './scriptAddonManifestDefinition';

/**
 * The script object which is parsed from the script file
 *
 * @export
 * @class Script
 */
export default class Script implements IAppScript, ISfdmuRunScript {

  // ------------- JSON --------------
  @Type(() => ScriptOrg)
  orgs: ScriptOrg[] = new Array<ScriptOrg>();

  @Type(() => ScriptObject)
  objects: ScriptObject[] = new Array<ScriptObject>();

  excludedObjects: string[] = new Array<string>();

  @Type(() => ScriptObjectSet)
  objectSets: ScriptObjectSet[] = new Array<ScriptObjectSet>();

  pollingIntervalMs: number = CONSTANTS.DEFAULT_POLLING_INTERVAL_MS;
  concurrencyMode: "Serial" | "Parallel" = "Parallel";
  bulkThreshold: number = CONSTANTS.DEFAULT_BULK_API_THRESHOLD_RECORDS;
  bulkApiVersion: string = CONSTANTS.DEFAULT_BULK_API_VERSION;
  bulkApiV1BatchSize: number;
  restApiBatchSize: number;
  allOrNone: boolean = false;
  //promptOnUpdateError: boolean = true;
  promptOnMissingParentObjects: boolean = true;
  promptOnIssuesInCSVFiles: boolean = true;
  validateCSVFilesOnly: boolean = false;
  apiVersion: string = CONSTANTS.DEFAULT_API_VERSION;
  createTargetCSVFiles: boolean = true;
  importCSVFilesAsIs: boolean = false;
  alwaysUseRestApiToUpdateRecords: boolean = false;
  excludeIdsFromCSVFiles: boolean = false;
  //fileLog: boolean = true;
  keepObjectOrderWhileExecute: boolean = false;
  allowFieldTruncation: boolean = false;
  simulationMode: boolean = false;

  proxyUrl: string;
  csvReadFileDelimiter: ',' | ';' = ",";
  csvWriteFileDelimiter: ',' | ';' = ",";
  useSeparatedCSVFiles: boolean = false;

  binaryDataCache: DATA_CACHE_TYPES = DATA_CACHE_TYPES.InMemory;
  sourceRecordsCache: DATA_CACHE_TYPES = DATA_CACHE_TYPES.InMemory;

  parallelBinaryDownloads: number = CONSTANTS.DEFAULT_MAX_PARALLEL_BLOB_DOWNLOADS;

  parallelBulkJobs: number = 1;
  parallelRestJobs: number = 1;



  @Type(() => ScriptAddonManifestDefinition)
  beforeAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  afterAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  dataRetrievedAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();




  // -----------------------------------
  logger: Logger;
  sourceOrg: ScriptOrg;
  targetOrg: ScriptOrg;
  basePath: string = "";
  objectsMap: Map<string, ScriptObject> = new Map<string, ScriptObject>();
  sourceTargetFieldMapping: Map<string, ObjectFieldMapping> = new Map<string, ObjectFieldMapping>();
  job: MigrationJob;
  addonManager: SfdmuRunAddonManager;
  runInfo: ICommandRunInfo;
  canModify: string;
  objectSetIndex: number;


  // Additional sobject descriptions for sobject which were nbot included into the export.json
  // but necessary for the job
  extraSObjectDescriptions: Map<string, SObjectDescribe> = new Map<string, SObjectDescribe>();

  get sFOrg(): ScriptOrg {
    return !this.sourceOrg.isFileMedia ? this.sourceOrg : this.targetOrg;
  }

  get addonRuntime(): SfdmuRunAddonRuntime {
    return <any>this.addonManager.runtime;
  }

  get isPersonAccountEnabled(): boolean {
    return (this.sourceOrg.isPersonAccountEnabled || this.sourceOrg.isFileMedia)
      && (this.targetOrg.isPersonAccountEnabled || this.targetOrg.isFileMedia);
  }

  get bulkApiVersionNumber(): number {
    return +(this.bulkApiVersion || '1.0');
  }

  get targetDirectoryPath(): string {
    return path.join(
      this.basePath,
      CONSTANTS.CSV_TARGET_SUB_DIRECTORY +
      (!this.objectSetIndex ? '' : `${CONSTANTS.OBJECT_SET_SUBDIRECTORY_PREFIX}${this.objectSetIndex + 1}`)
    );
  }

  get targetDirectory(): string {
    if (!fs.existsSync(this.targetDirectoryPath)) {
      fs.mkdirSync(this.targetDirectoryPath, { recursive: true });
    }
    return this.targetDirectoryPath;
  }

  get sourceDirectoryPath(): string {
    return path.join(
      this.basePath,
      CONSTANTS.CSV_SOURCE_SUB_DIRECTORY +
      (!this.objectSetIndex ? '' : `${CONSTANTS.OBJECT_SET_SUBDIRECTORY_PREFIX}${this.objectSetIndex + 1}`)
    );
  }

  get sourceDirectory(): string {
    if (!fs.existsSync(this.sourceDirectoryPath)) {
      fs.mkdirSync(this.sourceDirectoryPath, { recursive: true });
    }
    return this.sourceDirectoryPath;
  }

  get rawSourceDirectory(): string {
    if (!fs.existsSync(this.rawSourceDirectoryPath)) {
      fs.mkdirSync(this.rawSourceDirectoryPath, { recursive: true });
    }
    return this.rawSourceDirectoryPath;
  }

  get rawSourceDirectoryPath(): string {
    return path.join(
      this.basePath,
      (!this.objectSetIndex || !this.useSeparatedCSVFiles ? '' : `${CONSTANTS.RAW_SOURCE_SUB_DIRECTORY}/${CONSTANTS.OBJECT_SET_SUBDIRECTORY_PREFIX}${this.objectSetIndex + 1}`)
    );
  }

  get reportsDirectoryPath(): string {
    return path.join(
      this.basePath,
      (!this.objectSetIndex ? '' : `${CONSTANTS.REPORTS_SUB_DIRECTORY}/${CONSTANTS.OBJECT_SET_SUBDIRECTORY_PREFIX}${this.objectSetIndex + 1}`)
    );
  }

  get reportsDirectory(): string {
    if (!fs.existsSync(this.reportsDirectoryPath)) {
      fs.mkdirSync(this.reportsDirectoryPath, { recursive: true });
    }
    return this.reportsDirectoryPath;
  }

  get binaryCacheDirectoryPath(): string {
    return path.join(this.basePath, CONSTANTS.BINARY_CACHE_SUB_DIRECTORY, this.sourceOrg.orgUserName);
  }

  get binaryCacheDirectory(): string {
    if (!fs.existsSync(this.binaryCacheDirectoryPath)) {
      fs.mkdirSync(this.binaryCacheDirectoryPath, { recursive: true });
    }
    return this.binaryCacheDirectoryPath;
  }

  get sourceRecordsCacheDirectoryPath(): string {
    return path.join(this.basePath, CONSTANTS.SOURCE_RECORDS_CACHE_SUB_DIRECTORY, this.sourceOrg.orgUserName);
  }

  get sourceRecordsCacheDirectory(): string {
    if (!fs.existsSync(this.sourceRecordsCacheDirectoryPath)) {
      fs.mkdirSync(this.sourceRecordsCacheDirectoryPath, { recursive: true });
    }
    return this.sourceRecordsCacheDirectoryPath;
  }

  get hasDeleteFromSourceObjectOperation(): boolean {
    return this.objects.some(object => object.isDeletedFromSourceOperation);
  }

  get hasDeleteByHierarchyOperation(): boolean {
    return this.objects.some(object => object.isHierarchicalDeleteOperation);
  }

  get hasUseSourceCSVFile() {
    return !this.sourceOrg.isFileMedia && this.objects.some(object => object.useSourceCSVFile);
  }


  // ----------------------- Public methods -------------------------------------------
  /**
   * Setup this object
   *
   * @param {Logger} logger
   * @param {string} sourceUsername
   * @param {string} targetUsername
   * @param {string} basePath
   * @param {string} apiVersion
   * @returns {Promise<void>}
   * @memberof Script
   */
  async setupAsync(
    pinfo: IPluginInfo,
    logger: Logger,
    sourceUsername: string,
    targetUsername: string,
    basePath: string,
    apiVersion: string,
    canModify: string,
    simulation: boolean): Promise<void> {

    // Initialize script
    this.logger = logger;
    this.basePath = basePath;
    this.canModify = canModify || "";
    this.simulationMode = this.simulationMode || simulation;

    // Message about the running version
    this.logger.objectMinimal({ [this.logger.getResourceString(RESOURCES.runningVersion)]: pinfo.version });
    this.logger.objectMinimal({ [this.logger.getResourceString(RESOURCES.runningAddOnApiVersion)]: pinfo.runAddOnApiInfo.version });
    this.logger.infoVerbose(RESOURCES.newLine);

    // Create add on manager
    this.runInfo = {
      apiVersion,
      sourceUsername,
      targetUsername,
      basePath,
      pinfo
    };
    this.addonManager = new SfdmuRunAddonManager(this);

    this.sourceOrg = this.orgs.filter(x => x.name == this.runInfo.sourceUsername)[0] || new ScriptOrg();
    this.targetOrg = this.orgs.filter(x => x.name == this.runInfo.targetUsername)[0] || new ScriptOrg();
    this.apiVersion = this.runInfo.apiVersion || this.apiVersion;

    if (this.runInfo.sourceUsername.toLowerCase() == CONSTANTS.CSV_FILES_SOURCENAME
      && this.runInfo.targetUsername.toLowerCase() == CONSTANTS.CSV_FILES_SOURCENAME) {
      throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.cannotMigrateFile2File));
    }

    if (this.simulationMode) {
      this.logger.infoMinimal(RESOURCES.runningInSimulationMode);
    }

    // Fix object values
    this.objects.forEach(object => {
      // Fix operations
      object.operation = ScriptObject.getOperation(object.operation);
    });

    // Call addons module initialization
    await this.addonManager.triggerAddonModuleInitAsync();

    // Remove excluded objects and unsupported objects
    this.objects = this.objects.filter(object => {
      let supportedObjectsForOpertation = CONSTANTS.SUPPORTED_OBJECTS_FOR_OPERATION.get(object.name) || [];
      let isSupportedForOperation = !supportedObjectsForOpertation.length
        || supportedObjectsForOpertation.length && supportedObjectsForOpertation.includes(object.strOperation);
      let rule = object.operation != OPERATION.Readonly
        && CONSTANTS.NOT_SUPPORTED_OBJECTS.indexOf(object.name) < 0
        && isSupportedForOperation;
      let included = !object.excluded && (object.operation == OPERATION.Readonly || rule) && this.excludedObjects.indexOf(object.name) < 0;
      if (!included) {
        if (this.excludedObjects.indexOf(object.name) < 0) {
          this.excludedObjects.push(object.name);
        }
        this.logger.infoVerbose(RESOURCES.objectIsExcluded, object.name);
      }
      return included;
    });

    // Check objects length
    if (this.objects.length == 0) {
      throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.noObjectsToProcess));
    }

    // Make each object appear only once in the script
    this.objects = Common.distinctArray(this.objects, "name");

    // Check object operations spelling
    this.objects.forEach(object => {
      if (ScriptObject.getOperation(object.operation) == OPERATION.Unknown) {
        throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.invalidOperation,
          (object.operation || '').toString(), object.name));
      }
    });

    // Assign orgs
    Object.assign(this.sourceOrg, {
      script: this,
      name: this.runInfo.sourceUsername,
      isSource: true,
      media: this.runInfo.sourceUsername.toLowerCase() == CONSTANTS.CSV_FILES_SOURCENAME ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
    });
    Object.assign(this.targetOrg, {
      script: this,
      name: this.runInfo.targetUsername,
      media: this.runInfo.targetUsername.toLowerCase() == CONSTANTS.CSV_FILES_SOURCENAME ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
    });

    // Setup orgs
    await this.sourceOrg.setupAsync(true);
    await this.targetOrg.setupAsync(false);

    // Setup objects
    this.objects.forEach(object => {
      object.setup(this);
    });

    // Validate production update
    await this.sourceOrg.promptUserForProductionModificationAsync();
    await this.targetOrg.promptUserForProductionModificationAsync();

    // Cleanup the source / target directories
    await this.cleanupDirectories();


  }

  /**
   * The preprocessing functionality after the connect,
   *  but before running any rest of tasks.
   *
   * @memberof Script
   */
  async cleanupDirectories(): Promise<void> {

    // Perform clean-up the source directory if need --------------
    if (this.sourceOrg.media == DATA_MEDIA_TYPE.File || this.hasUseSourceCSVFile) {
      try {
        Common.deleteFolderRecursive(this.sourceDirectoryPath, true);
      } catch (ex) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.unableToDeleteSourceDirectory, this.sourceDirectoryPath));
      }
    }

    // Perform clean-up the target directory if need --------------
    if (this.createTargetCSVFiles) {
      try {
        Common.deleteFolderRecursive(this.targetDirectoryPath, true);
      } catch (ex) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.unableToDeleteTargetDirectory, this.targetDirectoryPath));
      }
    }

    // Perform clean-up the cache directories if need --------------
    if (this.binaryDataCache == DATA_CACHE_TYPES.CleanFileCache) {
      try {
        Common.deleteFolderRecursive(this.binaryCacheDirectory, true);
      } catch (ex) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.unableToDeleteCacheDirectory, this.binaryCacheDirectory));
      }
    }
    if (this.sourceRecordsCache == DATA_CACHE_TYPES.CleanFileCache) {
      try {
        Common.deleteFolderRecursive(this.sourceRecordsCacheDirectory, true);
      } catch (ex) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.unableToDeleteCacheDirectory, this.sourceRecordsCacheDirectory));
      }
    }
  }


  /**
   * Retrieve and analyse the metadata of all objects in the script
   *
   * @returns {Promise<void>}
   * @memberof Script
   */
  async processObjectsMetadataAsync(): Promise<void> {

    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.retrievingOrgMatadata);

    // Describe all objects
    for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {

      const thisObject = this.objects[objectIndex];

      this.logger.infoVerbose(RESOURCES.processingObject, thisObject.name);

      await thisObject.describeAsync();
    }

    for (let objectIndex = 0; objectIndex < CONSTANTS.EXTRA_OBJECTS_TO_DESCRIBE.length; objectIndex++) {
      const objectName = CONSTANTS.EXTRA_OBJECTS_TO_DESCRIBE[objectIndex];
      await this.describeExtraObjectAsync(objectName);
    }

    // Add parent related ScriptObjects and link between related objects
    for (let objectIndex = this.objects.length - 1; objectIndex >= 0; objectIndex--) {

      const thisObject = this.objects[objectIndex];
      this.logger.infoVerbose(RESOURCES.processingObject, thisObject.name);

      const fieldsInQuery = [...thisObject.fieldsInQuery];
      for (let fieldIndex = 0; fieldIndex < fieldsInQuery.length; fieldIndex++) {

        const thisField = thisObject.fieldsInQueryMap.get(fieldsInQuery[fieldIndex]);

        // Group + User => User
        let referencedObjectType = thisField.referencedObjectType == "Group" ? "User" : thisField.referencedObjectType;

        if (thisField.lookup && referencedObjectType) {

          // Search for the source ScriptObject in case if the FieldMapping is enabled
          this.sourceTargetFieldMapping.forEach((mapping: ObjectFieldMapping, sourceOjectName: string) => {
            if (mapping.targetSObjectName == referencedObjectType && mapping.hasChange) {
              referencedObjectType = sourceOjectName;
            }
          });


          // Find by referenced sObject type
          thisField.parentLookupObject = this.objects.filter(x => x.name == referencedObjectType)[0];
          let isParentLookupObjectAdded = false;

          if (!thisField.parentLookupObject) {

            // Add parent ScriptObject as READONLY since it is missing in the script
            thisField.parentLookupObject = new ScriptObject(referencedObjectType);
            this.objects.push(thisField.parentLookupObject);
            let externalId = thisField.parentLookupObject.defaultExternalId;
            let allRecords = CONSTANTS.SPECIAL_OBJECTS.indexOf(referencedObjectType) >= 0;
            Object.assign(thisField.parentLookupObject, <ScriptObject>{
              isExtraObject: true,
              allRecords,
              query: `SELECT Id, ${Common.getComplexField(externalId)} FROM ${referencedObjectType}`,
              operation: OPERATION.Readonly,
              externalId
            });

            isParentLookupObjectAdded = true;

          }

          // Setup and describe the parent ScriptObject
          thisField.parentLookupObject.setup(this);
          await thisField.parentLookupObject.describeAsync();

          // Validate and fix the default external id key for the parent object.
          if ((thisField.parentLookupObject.isExtraObject || thisField.parentLookupObject.originalExternalIdIsEmpty)
            && thisField.parentLookupObject.externalId != thisField.parentLookupObject.defaultExternalId
            && thisField.scriptObject != thisField.parentLookupObject) {
            // Extra object => automatically get possible unique "name" field to make it external id
            if (thisField.parentLookupObject.externalId != "Id") {
              // Remove old external id from the query
              thisField.parentLookupObject.parsedQuery.fields
                = thisField.parentLookupObject.parsedQuery.fields
                  .filter(field => (<SOQLField>field).field != thisField.parentLookupObject.externalId);
              thisField.parentLookupObject.query = composeQuery(thisField.parentLookupObject.parsedQuery);
            }

            // Replace old external id key
            thisField.parentLookupObject.externalId = thisField.parentLookupObject.defaultExternalId;
            thisField.parentLookupObject.script = null;
            thisField.parentLookupObject.setup(this);

          }

          // The permanent solution of "Cannot read property 'child__rSFields' of undefined"
          let externalIdFieldName1 = Common.getComplexField(thisField.parentLookupObject.externalId);
          let parentExternalIdField1 = thisField.parentLookupObject.fieldsInQueryMap.get(externalIdFieldName1);
          if (!parentExternalIdField1) {
            // The new externalid field does not found in the query.
            // Set 'Id' as externalid field.
            thisField.parentLookupObject.externalId = "Id";
            thisField.parentLookupObject.script = null;
            thisField.parentLookupObject.setup(this);

            // Output the message about not found external id for the parent object
            this.logger.infoNormal(RESOURCES.theExternalIdNotFoundInTheQuery,
              thisField.objectName,
              thisField.nameId,
              externalIdFieldName1,
              thisField.parentLookupObject.name,
              thisField.parentLookupObject.name,
              thisField.parentLookupObject.externalId);
          }

          if (thisField.parentLookupObject.isExtraObject && isParentLookupObjectAdded) {
            // Output the message about adding extra object missing in the script
            this.logger.infoNormal(RESOURCES.addedMissingParentLookupObject,
              thisField.parentLookupObject.name,
              thisField.objectName,
              thisField.nameId,
              thisField.parentLookupObject.externalId);
          }


          // Add __r fields to the child object query
          let __rFieldName = thisField.fullName__r;
          let __rOriginalFieldName = thisField.fullOriginalName__r;
          thisObject.parsedQuery.fields.push(getComposedField(__rFieldName));
          thisObject.parsedQuery.fields.push(getComposedField(__rOriginalFieldName));
          thisObject.query = composeQuery(thisObject.parsedQuery);

          // Linking between related fields and objects
          let externalIdFieldName = Common.getComplexField(thisField.parentLookupObject.externalId);
          let parentExternalIdField = thisField.parentLookupObject.fieldsInQueryMap.get(externalIdFieldName);

          let __rSField = ___setRSField(__rFieldName);
          thisField.__rSField = __rSField;

          if (__rFieldName != __rOriginalFieldName) {
            ___setRSField(__rOriginalFieldName);
          }

          try {
            parentExternalIdField.child__rSFields.push(__rSField);
          } catch (ex) {
            this.logger.warn(RESOURCES.failedToResolveExternalId,
              thisField.parentLookupObject.externalId,
              thisField.parentLookupObject.name,
              thisField.objectName,
              thisField.nameId);
          }

          // ---------------------- Internal functions --------------------------- //
          function ___setRSField(fieldName: string) {
            let __rSField = thisObject.fieldsInQueryMap.get(fieldName);
            if (__rSField) {
              __rSField.objectName = thisObject.name;
              __rSField.scriptObject = thisObject;
              __rSField.custom = thisField.custom;
              __rSField.parentLookupObject = thisField.parentLookupObject;
              __rSField.isPolymorphicField = thisField.isPolymorphicField;
              __rSField.polymorphicReferenceObjectType = thisField.polymorphicReferenceObjectType;
              __rSField.lookup = true;
              __rSField.idSField = thisField;
            }
            return __rSField;
          }
        }

      }
    }

    // Finalizing ....
    this.objects.forEach(object => {
      // Remove duplicate fields
      object.parsedQuery.fields = Common.distinctArray(object.parsedQuery.fields, "field");
      object.query = composeQuery(object.parsedQuery);

      // Warn user if there are no any fields to update
      if (object.hasToBeUpdated && object.fieldsToUpdate.length == 0
        && !(object.fieldsInQuery.length == 1 && object.fieldsInQuery[0] == "Id")) {
        this.logger.warn(RESOURCES.noFieldsToUpdate, object.name);
      }
    });


  }

  /**
  * Describes extra object
  */
  async describeExtraObjectAsync(objectName: string): Promise<void> {
    const org = this.sourceOrg.media == DATA_MEDIA_TYPE.Org ? this.sourceOrg : this.targetOrg;
    const messageSource = this.sourceOrg.media == DATA_MEDIA_TYPE.Org ? RESOURCES.source : RESOURCES.target;
    this.logger.infoNormal(RESOURCES.retrievingObjectMetadata, objectName, this.logger.getResourceString(messageSource));
    let apisf = new Sfdx(org);
    const description = await apisf.describeSObjectAsync(objectName);
    this.extraSObjectDescriptions.set(objectName, description);
  }

  /**
   * Checks orgs consistency
   *
   * @memberof Script
   */
  verifyOrgs() {

    // ***** Verifying person accounts
    if (this.objects.some(obj => obj.name == "Account" || obj.name == "Contact")) {
      // Verify target org
      if (this.sourceOrg.media == DATA_MEDIA_TYPE.Org && this.sourceOrg.isPersonAccountEnabled
        && this.targetOrg.media == DATA_MEDIA_TYPE.Org && !this.sourceOrg.isPersonAccountEnabled) {
        // Missing Person Account support in the Target
        throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.personAccountSupportWarning,
          this.logger.getResourceString(RESOURCES.sourceOrg)));
      }
      // Verify source org
      if (this.sourceOrg.media == DATA_MEDIA_TYPE.Org && !this.sourceOrg.isPersonAccountEnabled
        && this.targetOrg.media == DATA_MEDIA_TYPE.Org && this.sourceOrg.isPersonAccountEnabled) {
        // Missing Person Account support in the Source
        throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.personAccountSupportWarning,
          this.logger.getResourceString(RESOURCES.target)));
      }
    }

  }

  /**
  * Load Field Mapping configuration from the Script
  *
  * @memberof Script
  */
  loadFieldMappingConfiguration() {
    this.objects.forEach(object => {
      if (object.useFieldMapping && object.fieldMapping.length > 0) {
        if (!this.sourceTargetFieldMapping.has(object.name)) {
          this.sourceTargetFieldMapping.set(object.name, new ObjectFieldMapping(object.name, object.name));
        }
        object.fieldMapping.forEach(mapping => {
          if (mapping.targetObject) {
            this.sourceTargetFieldMapping.get(object.name).targetSObjectName = mapping.targetObject;
          }
          if (mapping.sourceField && mapping.targetField) {
            this.sourceTargetFieldMapping.get(object.name).fieldMapping.set(mapping.sourceField, mapping.targetField);
          }
        });
      }
    });
  }

  /**
   * Load Field Mapping configuration from the csv file
   *
   * @returns {Promise<void>}
   * @memberof Script
   */
  async loadFieldMappingConfigurationFileAsync(): Promise<void> {
    let filePath = path.join(this.basePath, CONSTANTS.FIELD_MAPPING_FILENAME);
    let csvRows = await Common.readCsvFileAsync(filePath);
    if (csvRows.length > 0) {
      this.logger.infoVerbose(RESOURCES.readingFieldsMappingFile, CONSTANTS.FIELD_MAPPING_FILENAME);
      csvRows.forEach(row => {
        if (row["ObjectName"] && row["Target"]) {
          let objectName = String(row["ObjectName"]).trim();
          let scriptObject = this.objectsMap.get(objectName);
          if (scriptObject && scriptObject.useFieldMapping) {
            let target = String(row["Target"]).trim();
            if (!row["FieldName"]) {
              this.sourceTargetFieldMapping.set(objectName, new ObjectFieldMapping(objectName, target));
            } else {
              let fieldName = String(row["FieldName"]).trim();
              if (!this.sourceTargetFieldMapping.has(objectName)) {
                this.sourceTargetFieldMapping.set(objectName, new ObjectFieldMapping(objectName, objectName));
              }
              this.sourceTargetFieldMapping.get(objectName).fieldMapping.set(fieldName, target);
            }
          }
        }
      });
    }
  }

  getAllAddOns(): ScriptAddonManifestDefinition[] {
    return this.beforeAddons.concat(
      this.afterAddons,
      this.dataRetrievedAddons,
      Common.flattenArrays(this.objects.map(object => object.beforeAddons.concat(
        object.afterAddons,
        object.beforeUpdateAddons,
        object.afterUpdateAddons
      )))
    )
  }


  addScriptObject(object: ISfdmuRunScriptObject): ISfdmuRunScriptObject {
    let newObject = new ScriptObject(object.objectName);
    newObject.operation = object.operation || OPERATION.Readonly;
    this.objects.push(newObject);
    return newObject
  }




}

