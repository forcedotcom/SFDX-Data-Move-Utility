/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as casual from 'casual';
import * as deepClone from 'deep.clone';
import * as fs from 'fs';
import {
  composeQuery,
  Condition,
  Field as SOQLField,
  FieldType,
  getComposedField,
  parseQuery,
  Query,
  WhereClause,
} from 'soql-parser-js';

import {
  CachedCSVContent,
  CommandExecutionError,
  MigrationJob as Job,
  ProcessedData,
  Script,
  ScriptMockField,
  ScriptObject,
  ScriptOrg,
  TaskData,
  TaskOrgData,
} from '../';
import {
  BulkApiV1_0Engine,
} from '../../components/api_engines/bulkApiV1_0Engine';
import {
  BulkApiV2_0Engine,
} from '../../components/api_engines/bulkApiV2_0Engine';
import { RestApiEngine } from '../../components/api_engines/restApiEngine';
import { Common } from '../../components/common_components/common';
import {
  ADDON_EVENTS,
  DATA_MEDIA_TYPE,
  MESSAGE_IMPORTANCE,
  OPERATION,
  RESULT_STATUSES,
  SPECIAL_MOCK_PATTERN_TYPES,
} from '../../components/common_components/enumerations';
import {
  LOG_MESSAGE_TYPE,
  LOG_MESSAGE_VERBOSITY,
  Logger,
  RESOURCES,
} from '../../components/common_components/logger';
import {
  MockGenerator,
} from '../../components/common_components/mockGenerator';
import { Sfdx } from '../../components/common_components/sfdx';
import { CONSTANTS } from '../../components/common_components/statics';
import { ApiInfo } from '../api_models';
import { IApiEngine } from '../api_models/helper_interfaces';
import {
  ICSVIssueCsvRow,
  IFieldMapping,
  IFieldMappingResult,
  IMissingParentLookupRecordCsvRow,
  IMockField,
} from '../common_models/helper_interfaces';
import SFieldDescribe from '../sf_models/sfieldDescribe';

const alasql = require("alasql");

MockGenerator.createCustomGenerators(casual);

export default class MigrationJobTask {

  scriptObject: ScriptObject;
  job: Job;
  sourceTotalRecorsCount: number = 0;
  targetTotalRecorsCount: number = 0;
  apiEngine: IApiEngine;

  processedData: ProcessedData;
  updateMode: 'forwards' | 'backwards';

  apiProgressCallback: (apiResult: ApiInfo) => void;


  constructor(init: Partial<MigrationJobTask>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  get sObjectName(): string {
    return this.scriptObject && this.scriptObject.name;
  }

  get script(): Script {
    return this.scriptObject.script;
  }

  get logger(): Logger {
    return this.script.logger;
  }

  get operation(): OPERATION {
    return this.scriptObject.operation;
  }

  get externalId(): string {
    return this.scriptObject.externalId;
  }

  get complexExternalId(): string {
    return Common.getComplexField(this.scriptObject.externalId);
  }

  data: TaskData = new TaskData(this);
  sourceData: TaskOrgData = new TaskOrgData(this, true);
  targetData: TaskOrgData = new TaskOrgData(this, false);

  tempRecords: Array<any>;

  //------------------
  tempData = {
    filteredQueryValueCache: new Map<string, Set<string>>()
  }



  // ----------------------- Public methods -------------------------------------------
  /**
   * Check the structure of the CSV source file.
   *
   * @returns {Promise<void>}
   * @memberof MigrationJob
   */
  async validateCSV(): Promise<Array<ICSVIssueCsvRow>> {

    let csvIssues = new Array<ICSVIssueCsvRow>();

    // Check csv file --------------------------------------
    if (!fs.existsSync(this.data.sourceCsvFilename)) {

      // Missing or empty file
      if (!this.script.excludeIdsFromCSVFiles) {
        csvIssues.push({
          "Date update": Common.formatDateTime(new Date()),
          "Child sObject": this.sObjectName,
          "Child field": null,
          "Child value": null,
          "Parent sObject": null,
          "Parent field": null,
          "Parent value": null,
          "Error": this.logger.getResourceString(RESOURCES.missingCsvFile)
        });
      }

      // Create a new empty file anyway
      await Common.writeCsvFileAsync(this.data.sourceCsvFilename, [], true);
    }

    // Read the csv header row
    let csvColumnsRow = await Common.readCsvFileAsync(this.data.sourceCsvFilename, 1);
    if (csvColumnsRow.length == 0) {
      return csvIssues;
    }

    // Check columns in the csv file ------------------------
    // Only checking for the mandatory fields (to be updated),
    // Not checking for all fields in the query (like RecordType.DevelopeName).
    [...this.data.fieldsToUpdateMap.keys()].forEach(fieldName => {
      const columnExists = Object.keys(csvColumnsRow[0]).some(columnName => {
        columnName = columnName.trim();
        let nameParts = columnName.split('.');
        return columnName == fieldName
          || nameParts.some(namePart => namePart == fieldName);
      });
      if (!columnExists) {

        // Detect id column
        const sField = this.data.fieldsInQueryMap.get(fieldName);
        if (!(sField && (sField.isSimpleReference || fieldName == "Id") // Negative rule to not show warning about missing columns
          && this.script.excludeIdsFromCSVFiles)) {
          // Column is missing in the csv file
          csvIssues.push({
            "Date update": Common.formatDateTime(new Date()),
            "Child sObject": this.sObjectName,
            "Child field": fieldName,
            "Child value": null,
            "Parent sObject": null,
            "Parent field": null,
            "Parent value": null,
            "Error": this.logger.getResourceString(RESOURCES.missingColumnsInCsvFile)
          });
        }
      }
    });

    return csvIssues;
  }



  /**
   * Try to add missing lookup csv columns
   * - Adds missing id column on Insert operation.
   * - Adds missing lookup columns like: Account__r.Name, Account__c
   *
   * @param {CachedCSVContent} cachedCSVContent The cached content of the source csv fiels
   * @returns {Promise<Array<ICSVIssueCsvRow>>}
   * @memberof MigrationJobTask
   */
  async repairCSV(cachedCSVContent: CachedCSVContent, fixColumns: boolean): Promise<Array<ICSVIssueCsvRow>> {

    let self = this;
    let csvIssues = new Array<ICSVIssueCsvRow>();

    let currentFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap,
      this.data.sourceCsvFilename,
      null, null,
      false, false);

    if (currentFileMap.size == 0) {
      // CSV file is empty or does not exist.
      // Missing csvs were already reported. No additional report provided.
      return csvIssues;
    }

    let firstRow = currentFileMap.values().next().value;

    if (fixColumns) {

      // Removes extra spaces from column headers
      ___trimColumnNames(firstRow);

      if (this.scriptObject.useCSVValuesMapping && this.job.valueMapping.size > 0) {
        // Update csv rows with csv value mapping
        ___mapCSVValues(firstRow);
      }

      // Add missing id column
      if (!firstRow.hasOwnProperty("Id")) {
        ___addMissingIdColumn();
      }

    } else {

      if (!firstRow.hasOwnProperty("Id") || this.script.excludeIdsFromCSVFiles) {

        // Update child lookup id columns
        let child__rSFields = this.scriptObject.externalIdSFieldDescribe.child__rSFields;
        for (let fieldIndex = 0; fieldIndex < child__rSFields.length; fieldIndex++) {
          const childIdSField = child__rSFields[fieldIndex].idSField;
          await ___updateChildOriginalIdColumnsAsync(childIdSField);
        }
      }

      // Add missing lookup columns
      for (let fieldIndex = 0; fieldIndex < this.data.fieldsInQuery.length; fieldIndex++) {
        const sField = this.data.fieldsInQueryMap.get(this.data.fieldsInQuery[fieldIndex]);
        if (sField.lookup && (!firstRow.hasOwnProperty(sField.fullName__r) || !firstRow.hasOwnProperty(sField.nameId))) {
          await ___addMissingLookupColumnsAsync(sField);
        }
      }

      // RecordType.DeveloperName old-fashion backward support
      ___fixOldRecordTypeColumns();

    }

    return csvIssues;


    // ------------------ Internal functions ------------------------- //
    /**
     * Updates csv rows according to provided value mapping file
     *
     * @param {*} firstRow
     */
    function ___mapCSVValues(firstRow: any) {
      self.logger.infoNormal(RESOURCES.mappingCsvValues, self.sObjectName);
      let fields = Object.keys(firstRow);
      let csvRows = [...currentFileMap.values()];
      fields.forEach(field => {
        let key = self.sObjectName + field;
        let valuesMap = self.job.valueMapping.get(key);
        if (valuesMap && valuesMap.size > 0) {
          csvRows.forEach((csvRow: any) => {
            let rawValue = (String(csvRow[field]) || "").trim();
            if (valuesMap.has(rawValue)) {
              csvRow[field] = valuesMap.get(rawValue);
            }
          });
        }
      });
      cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
    }

    /**
     * Trim csv header columns to remove extra unvisible symbols and spaces
     *
     * @param {*} firstRow
     */
    function ___trimColumnNames(firstRow: any) {
      let columnsToUpdate = new Array<string>();
      Object.keys(firstRow).forEach(field => {
        if (field != field.trim()) {
          columnsToUpdate.push(field);
        }
      });
      if (columnsToUpdate.length > 0) {
        let csvRows = [...currentFileMap.values()];
        columnsToUpdate.forEach(column => {
          let newColumn = column.trim();
          csvRows.forEach((csvRow: any) => {
            csvRow[newColumn] = csvRow[column];
            delete csvRow[column];
          });
        });
        cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
      }
    }

    /**
     * Add Id column to the current csv file (if it is missing),
     * then update all its child lookup "__r" columns in other csv files
     */
    function ___addMissingIdColumn() {
      [...currentFileMap.keys()].forEach(id => {
        let csvRow = currentFileMap.get(id);
        csvRow["Id"] = id;
      });
      cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
    }

    /**
     * Replaces the RecordType.DeveloperName column label of the old-formatted csv file
     * with RecordType.$$DeveloperName$NamespacePrefix$SobjectType
     * (current external id for the RecordType object)
     * ----
     * Also combines values of multiple columns of the old-formatted RecordType csv file
     * (DeveloperName | NamespacePrefix | SobjectType)
     *  into the single value under the column label $$DeveloperName$NamespacePrefix$SobjectType
     *
     */
    function ___fixOldRecordTypeColumns() {
      if (self.sObjectName != CONSTANTS.RECORD_TYPE_SOBJECT_NAME) {
        let sField = [...self.data.fieldsInQueryMap.values()].find(field => {
          return field.lookup && field.parentLookupObject.name == CONSTANTS.RECORD_TYPE_SOBJECT_NAME;
        });
        if (sField) {
          let oldColumnName = CONSTANTS.OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME;
          let newColumnName = sField.fullName__r;
          let isUpdated = false;
          [...currentFileMap.values()].forEach(row => {
            if (row.hasOwnProperty(oldColumnName)) {
              isUpdated = true;
              row[newColumnName] = row[oldColumnName];
              delete row[oldColumnName];
            }
          });
          if (isUpdated) {
            cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
          }
        }
      } else {
        let oldColumnNames = self.scriptObject.externalId.split(CONSTANTS.COMPLEX_FIELDS_SEPARATOR);
        let newColumnName = self.scriptObject.complexExternalId;
        let isUpdated = false;
        [...currentFileMap.values()].forEach(row => {
          if (!row.hasOwnProperty(newColumnName)) {
            isUpdated = true;
            row[newColumnName] = oldColumnNames.map(name => {
              let value = row[name];
              if (value) {
                delete row[name];
                return value;
              }
            }).filter(value => !!value).join(CONSTANTS.COMPLEX_FIELDS_SEPARATOR);
          }
        });
        if (isUpdated) {
          cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
        }
      }
    }

    /**
     * Add all missing lookup columns (like Account__c, Account__r.Name)
     *
     * @param {SFieldDescribe} sField sField to process
     * @returns {Promise<void>}
     */
    async function ___addMissingLookupColumnsAsync(sField: SFieldDescribe): Promise<void> {
      let columnName__r = sField.fullOriginalName__r;
      let columnNameId = sField.nameId;
      let parentExternalId = sField.parentLookupObject.complexOriginalExternalId;
      let parentTask = self.job.getTaskBySObjectName(sField.parentLookupObject.name);
      if (parentTask) {
        let parentFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, parentTask.data.sourceCsvFilename);
        let parentCSVRowsMap = new Map<string, any>();
        [...parentFileMap.values()].forEach(parentCsvRow => {
          let key = parentTask.getRecordValue(parentCsvRow, parentExternalId);
          if (key) {
            parentCSVRowsMap.set(key, parentCsvRow);
          }
        });
        [...currentFileMap.keys()].forEach(id => {
          let csvRow = currentFileMap.get(id);
          if (!csvRow.hasOwnProperty(columnNameId)) {
            if (!csvRow.hasOwnProperty(columnName__r)) {
              // Missing both id and __r columns
              //        => fill them with next incremental numbers
              // Since the missing columns were already reported no additional report provided.
              cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
              csvRow[columnNameId] = cachedCSVContent.nextId;
              csvRow[columnName__r] = cachedCSVContent.nextId;
              return;
            }

            // Missing id column but __r column provided.
            let desiredExternalIdValue = parentTask.getRecordValue(csvRow, columnName__r);
            if (desiredExternalIdValue) {

              cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
              let parentCsvRow = parentCSVRowsMap.get(desiredExternalIdValue);
              if (!parentCsvRow) {

                if (!self.script.excludeIdsFromCSVFiles) {
                  csvIssues.push({
                    "Date update": Common.formatDateTime(new Date()),
                    "Child sObject": self.sObjectName,
                    "Child field": columnName__r,
                    "Child value": desiredExternalIdValue,
                    "Parent sObject": sField.parentLookupObject.name,
                    "Parent field": parentExternalId,
                    "Parent value": null,
                    "Error": self.logger.getResourceString(RESOURCES.missingParentLookupRecords)
                  });
                }

                csvRow[columnNameId] = cachedCSVContent.nextId;

                // Create a new parent row to fix the parent file anyway
                parentCsvRow = {
                  "Id": csvRow[columnNameId],
                  [parentExternalId]: desiredExternalIdValue
                };

                parentFileMap.set(csvRow[columnNameId], parentCsvRow);
                parentCSVRowsMap.set(desiredExternalIdValue, parentCsvRow);

                cachedCSVContent.updatedFilenames.add(parentTask.data.sourceCsvFilename);

              } else {
                csvRow[columnNameId] = parentCsvRow["Id"];
              }
            } else {
              csvRow[columnNameId] = null;
            }
          } else if (!csvRow.hasOwnProperty(columnName__r)) {

            if (!csvRow.hasOwnProperty(columnNameId)) {
              // Missing both id and __r columns
              //        => fill them with next incremental numbers
              // Since the missing columns were already reported no additional report provided.
              cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
              csvRow[columnNameId] = cachedCSVContent.nextId;
              csvRow[columnName__r] = cachedCSVContent.nextId;
              return;
            }

            // Missing __r column but id column provided.
            // Create __r column.
            let idValue = csvRow[columnNameId];
            if (idValue) {
              cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
              let parentCsvRow = parentFileMap.get(idValue);
              if (!parentCsvRow) {

                if (!self.script.excludeIdsFromCSVFiles) {
                  csvIssues.push({
                    "Date update": Common.formatDateTime(new Date()),
                    "Child sObject": self.sObjectName,
                    "Child field": columnNameId,
                    "Child value": idValue,
                    "Parent sObject": sField.parentLookupObject.name,
                    "Parent field": "Id",
                    "Parent value": null,
                    "Error": self.logger.getResourceString(RESOURCES.missingParentLookupRecords)
                  });
                }
                csvRow[columnName__r] = cachedCSVContent.nextId;

                // Create a new parent row to fix the parent file anyway
                parentCsvRow = {
                  "Id": idValue,
                  [parentExternalId]: csvRow[columnName__r]
                };

                parentFileMap.set(idValue, parentCsvRow);
                parentCSVRowsMap.set(csvRow[columnName__r], parentCsvRow);

                cachedCSVContent.updatedFilenames.add(parentTask.data.sourceCsvFilename);
              } else {
                cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
                csvRow[columnName__r] = parentCsvRow[parentExternalId];
              }
            } else {
              csvRow[columnName__r] = null;
            }
          }
        });
      }
    }

    /**
     * When Id column was added
     *      - updates child lookup id columns
     *      for all other objects.
     * For ex. if the current object is "Account", it will update
     *     the child lookup id column "Account__c" of the child "Case" object
     *
     * @param {SFieldDescribe} childIdSField Child lookup id sField to process
     * @returns {Promise<void>}
     */
    async function ___updateChildOriginalIdColumnsAsync(childIdSField: SFieldDescribe): Promise<void> {
      let columnChildOriginalName__r = childIdSField.fullOriginalName__r;
      let columnChildIdName__r = childIdSField.fullIdName__r;
      let columnChildNameId = childIdSField.nameId;
      let parentOriginalExternalIdColumnName = self.scriptObject.complexOriginalExternalId;
      if (parentOriginalExternalIdColumnName != "Id") {
        let childTask = self.job.getTaskBySObjectName(childIdSField.scriptObject.name);
        if (childTask) {
          let childFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, childTask.data.sourceCsvFilename);
          if (childFileMap.size > 0) {
            let childCSVFirstRow = childFileMap.values().next().value;
            if (childCSVFirstRow.hasOwnProperty(columnChildOriginalName__r)) {
              let parentCSVExtIdMap = new Map<string, any>();
              [...currentFileMap.values()].forEach(csvRow => {
                let key = self.getRecordValue(csvRow, parentOriginalExternalIdColumnName);
                if (key) {
                  parentCSVExtIdMap.set(key, csvRow);
                }
              });
              [...childFileMap.values()].forEach(csvRow => {
                let extIdValue = self.getRecordValue(csvRow, columnChildOriginalName__r);
                if (extIdValue && parentCSVExtIdMap.has(extIdValue)) {
                  csvRow[columnChildNameId] = parentCSVExtIdMap.get(extIdValue)["Id"];
                  csvRow[columnChildIdName__r] = csvRow[columnChildNameId];
                  cachedCSVContent.updatedFilenames.add(childTask.data.sourceCsvFilename);
                }
              });
            } else {
              csvIssues.push({
                "Date update": Common.formatDateTime(new Date()),
                "Child sObject": childTask.sObjectName,
                "Child field": columnChildOriginalName__r,
                "Child value": null,
                "Parent sObject": self.sObjectName,
                "Parent field": "Id",
                "Parent value": null,
                "Error": self.logger.getResourceString(RESOURCES.cantUpdateChildLookupCSVColumn)
              });
            }
          }
        }
      }
    }
  }

  /**
   * Get record value by given property name
   *     for this sobject
   *
   * @param {*} record The record
   * @param {string} propName The property name to extract value from the record object
   * @memberof MigrationJobTask
   */
  getRecordValue(record: any, propName: string): any {
    if (!record) return null;
    return record[propName];
  }

  /**
   * Get CSV filename for this sobject including the full directory path
   *
   * @param {string} rootPath The root path to append the filename to it
   * @returns {string}
   * @memberof MigrationJobTask
   */
  getCSVFilename(rootPath: string, pattern?: string): string {
    return Common.getCSVFilename(rootPath, this.sObjectName, pattern);
  }

  /**
   * Creates SOQL query to retrieve records
   *
   * @param {Array<string>} [fieldNames] Field names to include in the query,
   *                                     pass undefined value to use all fields
   *                                      of the current task
   * @param {boolean} [removeLimits=false]  true to remove LIMIT, OFFSET, ORDERBY clauses
   * @param {Query} [parsedQuery]  Default parsed query.
   * @param {boolan} [useFieldMapping]  Transform query string according to the field mapping before return.
   * @returns {string}
   * @memberof MigrationJobTask
   */
  createQuery(fieldNames?: Array<string>,
    removeLimits: boolean = false,
    parsedQuery?: Query,
    useFieldMapping: boolean = false,
    isTargetQuery: boolean = false): string {

    let self = this;

    parsedQuery = parsedQuery || this.scriptObject.parsedQuery;

    let tempQuery = deepClone.deepCloneSync(parsedQuery, {
      absolute: true,
    });

    if (!fieldNames)
      tempQuery.fields = this.data.fieldsInQuery.map(fieldName => getComposedField(fieldName));
    else
      tempQuery.fields = fieldNames.map(fieldName => getComposedField(fieldName));

    if (removeLimits) {
      tempQuery.limit = undefined;
      tempQuery.offset = undefined;
      tempQuery.orderBy = undefined;
    }

    if (isTargetQuery) {
      // Fix target query
      ___filterTargetQuery(tempQuery);
    }

    let query = composeQuery(tempQuery);
    if (useFieldMapping) {
      query = this._mapSourceQueryToTarget(query, parsedQuery.sObject).query;
    }
    return query;


    // -------------- Helpers ----------------------- //
    function ___filterTargetQuery(tempQuery: WhereClause | Query) {

      if (!tempQuery) return;

      if (tempQuery['sObject']) {

        // Filter Query ////////////////////
        tempQuery = tempQuery as Query;

        if (self.scriptObject.queryAllTarget) {
          // ignoreTargetWhere ---
          tempQuery.where = null;
          tempQuery.limit = null;
          tempQuery.offset = null;
          tempQuery.orderBy = null;
          return;
        }

        if (tempQuery.where && tempQuery.where.left) {
          // IsDeleted -----------
          if ((tempQuery.where.left.field || '').toLowerCase() == 'isdeleted') {
            tempQuery.where = null;
            return;
          }
        }

        // Continue to Filter Where
        ___filterTargetQuery(tempQuery.where);
        return;
      }

      // Filter Where ////////////////////////
      tempQuery = tempQuery as WhereClause;
      if (!tempQuery) return;

      // IsDeleted --------------------
      if (tempQuery.right) {
        if ((tempQuery.right.left.field || '').toLowerCase() == 'isdeleted') {
          tempQuery.right = null;
          tempQuery.operator = null;
        } else {
          ___filterTargetQuery(tempQuery.right);
        }
      }

    }
  }

  /**
   * Converts full query string into short form
   * to be displayed in the stdout
   *
   * @param {string} query
   * @returns {string}
   * @memberof MigrationJobTask
   */
  createShortQueryString(longString: string): string {
    let parts = longString.split("FROM");
    return (this.script.logfullquery ? parts[0] : (parts[0].substr(0, CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH) +
      (parts[0].length > CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH ? "..." : ""))) +
      " FROM "
      + parts[1].substr(0, CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH) +
      (parts[1].length > CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH ? "..." : "");
  }

  /**
   * Create SOQL query to delete records
   *
   * @returns
   * @memberof MigrationJobTask
   */
  createDeleteQuery() {
    if (!this.scriptObject.parsedDeleteQuery) {
      return this.createQuery(["Id"], true, null);
    } else {
      return this.createQuery(["Id"], true, this.scriptObject.parsedDeleteQuery);
    }
  }

  /**
  * Retireve the total records count
  *
  * @returns {Promise<void>}
  * @memberof MigrationJobTask
  */
  async getTotalRecordsCountAsync(): Promise<void> {

    if (this.sourceData.media == DATA_MEDIA_TYPE.Org) {
      let queryOrNumber = this.createQuery(['COUNT(Id) CNT'], true);
      try {
        let apiSf = new Sfdx(this.sourceData.org);
        let ret = await apiSf.queryOrgAsync(queryOrNumber, false);
        this.sourceTotalRecorsCount = Number.parseInt(ret[0]["CNT"]);
        if (this.scriptObject.parsedQuery.limit) {
          this.sourceTotalRecorsCount = Math.min(this.sourceTotalRecorsCount, this.scriptObject.parsedQuery.limit);
        }
        this.logger.infoNormal(RESOURCES.totalRecordsAmountByQueryString, this.sObjectName,
          String(this.sourceTotalRecorsCount),
          this.sourceData.resourceString_Source_Target);
      } catch (ex) {
        // Aggregate queries does not suppoted
        this.sourceTotalRecorsCount = this.scriptObject.parsedQuery.limit || 0;
      }
    }

    if (this.targetData.media == DATA_MEDIA_TYPE.Org) {
      let queryOrNumber = this.createQuery(['COUNT(Id) CNT'], true, null, true);
      try {
        let apiSf = new Sfdx(this.targetData.org);
        let ret = await apiSf.queryOrgAsync(queryOrNumber, false);
        this.targetTotalRecorsCount = Number.parseInt(ret[0]["CNT"]);
        if (this.scriptObject.parsedQuery.limit) {
          this.targetTotalRecorsCount = Math.min(this.targetTotalRecorsCount, this.scriptObject.parsedQuery.limit);
        }
        this.logger.infoNormal(RESOURCES.totalRecordsAmountByQueryString, this.sObjectName,
          String(this.targetTotalRecorsCount),
          this.targetData.resourceString_Source_Target);
      } catch (ex) {
        // Aggregate queries does not suppoted
        this.targetTotalRecorsCount = this.scriptObject.parsedQuery.limit || 0;
      }
    }
  }

  /**
   * Delete old records from the target org
   *
   * @returns {Promise<void>}
   * @memberof MigrationJobTask
   */
  async deleteOldTargetRecords(): Promise<boolean> {
    // Checking
    if (!(this.targetData.media == DATA_MEDIA_TYPE.Org
      && this.scriptObject.operation != OPERATION.Readonly
      && this.scriptObject.deleteOldData)) {
      this.logger.infoNormal(RESOURCES.nothingToDelete, this.sObjectName);
      return false;
    }
    // Querying
    this.logger.infoNormal(RESOURCES.deletingTargetSObjectRecords, this.sObjectName);
    let soql = this.createDeleteQuery();
    let apiSf = new Sfdx(this.targetData.org);
    let queryResult = await apiSf.queryOrgAsync(soql, this.targetData.useBulkQueryApi);
    if (queryResult.length == 0) {
      this.logger.infoNormal(RESOURCES.nothingToDelete, this.sObjectName);
      return false;
    }
    // Deleting
    this.logger.infoVerbose(RESOURCES.amountOfRecordsToDelete, this.sObjectName, String(queryResult.length));
    let recordsToDelete = queryResult.map(x => {
      return {
        Id: x["Id"]
      }
    });

    this.createApiEngine(this.targetData.org, OPERATION.Delete, recordsToDelete.length, true);
    let resultRecords = await this.apiEngine.executeCRUDMultithreaded(recordsToDelete, this.apiProgressCallback, this.getParallelThreadCount());
    if (resultRecords == null) {
      this._apiOperationError(OPERATION.Delete);
    }

    // Done
    this.logger.infoVerbose(RESOURCES.deletingRecordsCompleted, this.sObjectName);
    return true;
  }


  /**
   * Performs target records hierarchical deletion.
   *
   * @returns {Promise<number>} Total amount of deleted records
   * @memberof MigrationJobTask
   */
  async deleteRecords(): Promise<number> {

    //  DELETE ORG :::::::::
    //  Create delete data => only the target records which are existing in the Source
    let recordsToDelete = this.sourceData.records.map(sourceRecord => {
      let targetRecord = this.data.sourceToTargetRecordMap.get(sourceRecord);
      if (targetRecord) {
        return {
          Id: targetRecord["Id"]
        }
      }
    }).filter(record => !!record);

    this.logger.infoVerbose(RESOURCES.amountOfRecordsToDelete, this.sObjectName, String(recordsToDelete.length));

    // Delete records
    if (recordsToDelete.length == 0) {
      return 0;
    }
    this.createApiEngine(this.targetData.org, OPERATION.Delete, recordsToDelete.length, true);
    let resultRecords = await this.apiEngine.executeCRUDMultithreaded(recordsToDelete, this.apiProgressCallback, this.getParallelThreadCount());
    if (resultRecords == null) {
      this._apiOperationError(OPERATION.Delete);
    }

    this.logger.infoVerbose(RESOURCES.deletingRecordsCompleted, this.sObjectName);

    return resultRecords.length;
  }


  /**
   * Retrieve records for this task
   *
   * @param {number} queryMode The mode of record processing
   * @param {boolean} reversed If TRUE - queries from the child related object to parent object
   *                           (selects all parent objects that exist in the child objects)
   *                                      forward:   parent <== *child (before, prev)
   *                                      backward:  *child ==> parent (after, next)
   *                           If FALSE - queries from the parent related object to child object
   *                           (selects all child objects that exist in the parent objects)
   *                                      forward:   child ==> *parent (before, prev)
   *                                      backward:  *parent <== child (after, next)
   * @returns {Promise<void>}
   * @memberof MigrationJobTask
   */
  async retrieveRecords(queryMode: "forwards" | "backwards" | "target", reversed: boolean): Promise<boolean> {

    let hasRecords = false;
    let records: Array<any> = new Array<any>();

    // Checking job status *********
    if (this.operation == OPERATION.Delete
      && !this.scriptObject.isDeletedFromSourceOperation) {
      return hasRecords;
    };


    // Read SOURCE DATA *********************************************************************************************
    // **************************************************************************************************************
    if (queryMode != "target") {
      // Read main data *************************************
      // ****************************************************
      if ((this.sourceData.media == DATA_MEDIA_TYPE.File || this.scriptObject.useSourceCSVFile) && queryMode == "forwards") {
        // Read from the SOURCE CSV FILE ***********************************
        if (!reversed) {
          let query = this.createQuery();
          // Start message ------
          this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_csvFile, this.data.getResourceString_Step(queryMode));
          let sfdx = new Sfdx(this.targetData.org);
          records = await sfdx.queryOrgOrCsvAsync(query, false, this.data.sourceCsvFilename, this.targetData.fieldsMap, this.scriptObject.useQueryAll);
          hasRecords = true;
        }
      } else if (this.sourceData.media == DATA_MEDIA_TYPE.Org) {
        // Read from the SOURCE ORG **********************************************
        if (this.scriptObject.processAllSource && queryMode == "forwards" && !reversed) {
          // All records *********** //
          let query = this.createQuery();
          // Start message ------
          this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_org,
            this.data.getResourceString_Step(queryMode));
          // Query string message ------
          this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
          // Fetch records
          let sfdx = new Sfdx(this.sourceData.org, this._sourceFieldMapping);
          records = await sfdx.queryOrgOrCsvAsync(query, this.sourceData.useBulkQueryApi, undefined, undefined, this.scriptObject.useQueryAll);
          hasRecords = true;
        } else if (!this.scriptObject.processAllSource) {
          // Filtered records ************ //
          let queries = this._createFilteredQueries(queryMode, reversed);
          if (queries.length > 0) {
            // Start message ------
            this.logger.infoNormal(RESOURCES.queryingIn, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_org, this.data.getResourceString_Step(queryMode));
            // Fetch records
            records = await this._retrieveFilteredRecords(queries, this.sourceData, this._sourceFieldMapping, this.scriptObject.useQueryAll);
            hasRecords = true;
          }
        }
      }
      if (hasRecords) {
        // Set external id map ---------
        let newRecordsCount = this._setExternalIdMap(records, this.sourceData.extIdRecordsMap, this.sourceData.idRecordsMap);
        // Completed message ------
        this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.sourceData.resourceString_Source_Target, String(newRecordsCount));
      }

      // Read SELF REFERENCE records from the SOURCE *************
      // *********************************************************
      if (this.sourceData.media == DATA_MEDIA_TYPE.Org && queryMode == "forwards"
        // When there is allRecords source mode
        //     => no any addtional records should be fetched,
        //        so need to skip retrieving the self-reference records a well...
        && !this.sourceData.allRecords
      ) {
        records = new Array<any>();
        let inValues: Array<string> = new Array<string>();
        for (let fieldIndex = 0; fieldIndex < this.data.fieldsInQuery.length; fieldIndex++) {
          const describe = this.data.fieldsInQueryMap.get(this.data.fieldsInQuery[fieldIndex]);
          if (describe.isSimpleSelfReference) {
            this.sourceData.records.forEach(sourceRec => {
              if (sourceRec[describe.name]) {
                inValues.push(sourceRec[describe.name]);
              }
            });
          }
        }
        if (inValues.length > 0) {
          // Start message ------
          this.logger.infoNormal(RESOURCES.queryingSelfReferenceRecords, this.sObjectName, this.sourceData.resourceString_Source_Target);
          inValues = Common.distinctStringArray(inValues);
          let sfdx = new Sfdx(this.sourceData.org, this._sourceFieldMapping);
          let queries = Common.createFieldInQueries(this.data.fieldsInQuery, "Id", this.sObjectName, inValues);
          for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
            const query = queries[queryIndex];
            // Query string message ------
            this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
            // Fetch records
            records = records.concat(await sfdx.queryOrgOrCsvAsync(query, undefined, undefined, undefined, this.scriptObject.useQueryAll));
          }
          if (queries.length > 0) {
            // Set external id map ---------
            let newRecordsCount = this._setExternalIdMap(records, this.sourceData.extIdRecordsMap, this.sourceData.idRecordsMap);
            // Completed message ------
            this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.sourceData.resourceString_Source_Target, String(newRecordsCount));
          }
        }
      }
    }

    // If it's "deleteFromSource" mode -> Always skip retrieving from the target
    if (this.scriptObject.isDeletedFromSourceOperation) {
      return hasRecords;
    }

    // Read TARGET DATA ***********************************************************************************
    // ****************************************************************************************************
    if (queryMode == "target") {
      hasRecords = false;
      if (this.targetData.media == DATA_MEDIA_TYPE.Org && this.operation != OPERATION.Insert) {
        // Read from the TARGET ORG *********
        let fieldsInQuery = this.data.fieldsInQuery.filter(field => this.data.fieldsExcludedFromTargetQuery.indexOf(field) < 0);
        let query = this.createQuery(fieldsInQuery, undefined, undefined, undefined, true);
        records = new Array<any>();
        if (this.scriptObject.processAllTarget) {
          // All records ****** //
          // Start message ------
          this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.targetData.resourceString_Source_Target, this.data.resourceString_org, this.data.getResourceString_Step(queryMode));
          // Query string message ------
          this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
          // Fetch records
          let sfdx = new Sfdx(this.targetData.org, this._targetFieldMapping);
          records = await sfdx.queryOrgOrCsvAsync(query, this.targetData.useBulkQueryApi);
          hasRecords = true;
        } else {
          // Filtered records ***** //
          let queries = this._createFilteredQueries(queryMode, reversed, fieldsInQuery);
          if (queries.length > 0) {
            // Start message ------
            this.logger.infoNormal(RESOURCES.queryingIn, this.sObjectName, this.targetData.resourceString_Source_Target, this.data.resourceString_org, this.data.getResourceString_Step(queryMode));
            // Fetch target records
            records = await this._retrieveFilteredRecords(queries, this.targetData, this._targetFieldMapping);
            hasRecords = true;
          }
        }
      }
      if (hasRecords) {
        // Set external id map --------- TARGET
        let newRecordsCount = this._setExternalIdMap(records, this.targetData.extIdRecordsMap, this.targetData.idRecordsMap, true);
        // Completed message ------
        this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.targetData.resourceString_Source_Target, String(newRecordsCount));
      }
    }

    return hasRecords;

  }


  /**
   * Performs target records update.
   *
   * @param {("forwards" | "backwards")} updateMode
   * @param {(data : ProcessedData) => boolean} warnUserCallbackAsync true to abort the job
   * @returns {Promise<number>} Total amount of updated records
   * @memberof MigrationJobTask
   */
  async updateRecords(updateMode: "forwards" | "backwards", warnUserCallbackAsync: (data: ProcessedData) => Promise<void>): Promise<number> {

    let self = this;

    // Set the run context
    this.updateMode = updateMode;

    if (this.scriptObject.isDeletedFromSourceOperation) {
      if (updateMode != "forwards") {
        return 0;
      }
      // DELETE SOURCE RECORDS ::::::::::
      return (await ___deleteSourceRecords());
    }

    if (this.targetData.media == DATA_MEDIA_TYPE.File) {
      //  WRITE CSV ::::::::::
      if (this.operation != OPERATION.Delete && updateMode == "forwards") {
        this.logger.infoNormal(RESOURCES.writingToFile, this.sObjectName, this.data.csvFilename);
        let records = await ___filterRecords(this.sourceData.records);
        records = ___mockRecords(records);
        records = ___removeCSVFileColumns(records);
        await ___writeToTargetCSVFile(records);
        await Common.writeCsvFileAsync(self.data.csvFilename, records, true);
        return records.length;
      }
      return 0;
    }

    //  UPDATE ORG :::::::::
    let totalProcessedRecordsAmount = 0;
    let totalNonProcessedRecordsAmount = 0;

    if (this.operation != OPERATION.Readonly && this.operation != OPERATION.Delete) {
      // Non-person Accounts/Contacts + other objects //////////
      // Create data ****
      let data = await ___createUpdateData(false);
      if (data.missingParentLookups.length > 0) {
        // Warn user
        await warnUserCallbackAsync(data);
      }
      // Process data - main ****
      totalProcessedRecordsAmount += (await ___updateData(data));
      totalNonProcessedRecordsAmount += data.nonProcessedRecordsAmount;

      // Person Accounts/Contacts only /////////////
      if (this.data.isPersonAccountOrContact) {
        // Create data ****
        this.logger.infoVerbose(RESOURCES.updatePersonAccountsAndContacts, this.sObjectName);
        data = await ___createUpdateData(true);
        if (data.missingParentLookups.length > 0) {
          // Warn user
          await warnUserCallbackAsync(data);
        }
        // Process data - person accounts ****
        totalProcessedRecordsAmount += (await ___updateData(data));
        totalNonProcessedRecordsAmount += data.nonProcessedRecordsAmount;

        // Add Person Contacts when inserting/upserting Person Accounts ****
        if ((this.operation == OPERATION.Insert || this.operation == OPERATION.Upsert) && this.sObjectName == "Account") {
          await ___insertPersonContactsFromPersonAccounts(data);
        }
      }

      // Warn the about skipped equal records
      if (totalNonProcessedRecordsAmount > 0) {
        this.logger.infoNormal(RESOURCES.skippedUpdatesWarning, this.sObjectName, String(totalNonProcessedRecordsAmount));
      }

    }
    return totalProcessedRecordsAmount;


    // ------------------------ Internal functions --------------------------
    async function ___createUpdateData(processPersonAccounts: boolean): Promise<ProcessedData> {

      let processedData = new ProcessedData();
      processedData.processPersonAccounts = processPersonAccounts;

      // Prepare fields /////////
      processedData.fields = self.data.sFieldsToUpdate.filter((field: SFieldDescribe) => {
        if (updateMode == "forwards")
          // For Step 1 : Simple sFields or reference fields with the parent lookup BEFORE
          return field.isSimpleNotLookup || field.isSimpleReference && self.data.prevTasks.indexOf(field.parentLookupObject.task) >= 0;
        else
          // For Step 2 : Reference sFields. Removed to fix circular reference handling: with the parent lookup AFTER + self
          return field.isSimpleReference;// && self.data.nextTasks.concat(self).indexOf(field.parentLookupObject.task) >= 0;
      }).concat(new SFieldDescribe({
        name: CONSTANTS.__ID_FIELD_NAME
      }), updateMode == "forwards" ? self.scriptObject.getExtraFieldsToUpdate().map(name => {
        return new SFieldDescribe({
          name
        });
      }) : []);

      // Add record Id field ////////
      if (self.operation != OPERATION.Insert) {
        processedData.fields.push(self.data.sFieldsInQuery.filter(field => field.nameId == "Id")[0]);
      }

      // Remove incorrect fields
      processedData.fields = processedData.fields.filter(x => !!x);

      // Remove unsupported fields for person accounts/contacts /////////
      if (self.data.isPersonAccountOrContact) {
        if (!processPersonAccounts) {
          processedData.fields = self.sObjectName == "Account" ?
            processedData.fields.filter((field: SFieldDescribe) => {
              // For Business accounts
              return !field.person && CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT.indexOf(field.nameId) < 0;
            }) : processedData.fields.filter(field => {
              // For Business contacts
              return CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT.indexOf(field.nameId) < 0;
            });
        } else if (self.sObjectName == "Account") {
          processedData.fields = processedData.fields.filter(field => {
            // For Person accounts
            //return !field.person && CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT.indexOf(field.nameId) < 0;
            return CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT.indexOf(field.nameId) < 0;
          });
        } else {
          // Person contact => skip from the processing
          return processedData;
        }
      }

      // Remove master-detail fields for Update / Upsert  ////////////////
      // (to avoid master-detail reparenting if not available)
      // 9/11/2020: Removed ALL  non-updateable fields to avoid the issue with updating of audit field.
      let notUpdateableFields = processedData.fields.filter(field => {
        //return field.isMasterDetail && !field.updateable;
        return field.isDescribed && !field.updateable && field.name != "Id";
      }).map(field => field.nameId);


      // Field do not Insert //////////////
      let fieldsToCompareRecords = self.data.fieldsToCompareSourceWithTarget;
      // Non-insertable is the same as fields to compare but not included in the Update
      let notIsertableFields = fieldsToCompareRecords.filter(field => !processedData.fields.some(f => f.nameId == field));
      notUpdateableFields = notUpdateableFields.concat(notIsertableFields); // Must include both non-updateable & non-insertable

      // Additional field filters ////////////
      let doNotDeleteIdFieldOnInsert = self.scriptObject.idFieldIsMapped;

      // Prepare records //////////////
      // (Only if any field to update exist)
      let fieldNamesToClone = processedData.fieldNames.concat(notIsertableFields);

      if (processedData.fields.some(field => field.name != "Id" && field.name != CONSTANTS.__ID_FIELD_NAME)) {

        // Map: cloned => source
        let tempClonedToSourceMap = Common.cloneArrayOfObjects(self.sourceData.records, fieldNamesToClone);

        // Map: "___Id" => cloned
        let ___IdToClonedMap = new Map<string, any>();
        [...tempClonedToSourceMap.keys()].forEach(cloned => {
          ___IdToClonedMap.set(cloned[CONSTANTS.__ID_FIELD_NAME], cloned);
        });

        // Map: cloned => source
        //    + update lookup Id fields (f.ex. Account__c)
        if (self.data.isPersonAccountOrContact) {
          // Person accounts are supported --------- *** /
          if (!processPersonAccounts) {
            // Process only Business Acounts/Contacts  (IsPersonAccount == false)
            tempClonedToSourceMap.forEach((source, cloned) => {
              if (!source["IsPersonAccount"]) {
                ___updateLookupIdFields(processedData, source, cloned);
                // Always ensure that account Name field is not empty,
                //   join FirstName + LastName fields into Name field if necessary
                ___updatePrsonAccountFields(processedData, source, cloned, false);
                processedData.clonedToSourceMap.set(cloned, source);
              }
            });
          } else {
            // Process only Person Accounts/Contacts (IsPersonAccount == true)
            tempClonedToSourceMap.forEach((source, cloned) => {
              if (!!source["IsPersonAccount"]) {
                ___updateLookupIdFields(processedData, source, cloned);
                // Always ensure that account FirstName / LastName fields are not empty,
                //   split Name field if necessary
                ___updatePrsonAccountFields(processedData, source, cloned, true);
                processedData.clonedToSourceMap.set(cloned, source);
              }
            });
          }
        } else {
          // Person accounts are not supported ---------- *** /
          // All objects including Accounts/Contacts (all items)
          tempClonedToSourceMap.forEach((source, cloned) => {
            ___updateLookupIdFields(processedData, source, cloned);
            processedData.clonedToSourceMap.set(cloned, source);
          });
        }

        // Filter records /////////////
        tempClonedToSourceMap = processedData.clonedToSourceMap;
        processedData.clonedToSourceMap = new Map<any, any>();

        // Apply Records Filter
        let clonedRecords = await ___filterRecords([...tempClonedToSourceMap.keys()]);

        // Mock records
        clonedRecords = ___mockRecords(clonedRecords);

        // Truncate records
        clonedRecords = ___truncateRecords(clonedRecords);

        // Map records
        self.mapRecords(clonedRecords);

        // Create records map: cloned => source
        clonedRecords.forEach(cloned => {
          let initialCloned = ___IdToClonedMap.get(cloned[CONSTANTS.__ID_FIELD_NAME]);
          let source = tempClonedToSourceMap.get(initialCloned);
          processedData.clonedToSourceMap.set(cloned, source);
        });


        // Create separated record sets to Update/Insert /////////////
        processedData.clonedToSourceMap.forEach((source, cloned) => {
          source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = typeof source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] == "undefined" ? false : source[CONSTANTS.__IS_PROCESSED_FIELD_NAME];
          delete cloned[CONSTANTS.__ID_FIELD_NAME];
          let target = self.data.sourceToTargetRecordMap.get(source);
          if (target && self.data.task.scriptObject.skipExistingRecords) {
            source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = true;
          } else if (target && updateMode == "backwards") {
            // ???
            if (target["Id"] && ___compareRecords(target, cloned, fieldsToCompareRecords)) {
              cloned["Id"] = target["Id"];
              ___removeRecordFields(cloned, notUpdateableFields);
              processedData.recordsToUpdate.push(cloned);
              source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = true;
            }
          } else if (!target && self.operation == OPERATION.Upsert || self.operation == OPERATION.Insert) {
            // Inserting new record to the target
            if (!doNotDeleteIdFieldOnInsert) {
              delete cloned["Id"];
            }
            ___removeRecordFields(cloned, notIsertableFields);
            processedData.recordsToInsert.push(cloned);
            source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = true;
          } else if (target && (self.operation == OPERATION.Upsert || self.operation == OPERATION.Update)) {
            // Updating existing record on the target
            if (target["Id"] && ___compareRecords(target, cloned, fieldsToCompareRecords)) {
              cloned["Id"] = target["Id"];
              ___removeRecordFields(cloned, notUpdateableFields);
              processedData.recordsToUpdate.push(cloned);
              source[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = true;
            }
          }
        });


        ///////////////
        // Filter out unwanted records (for example of AccountContactRelation)
        processedData.recordsToInsert = __filterInserts(processedData.recordsToInsert);
        processedData.recordsToUpdate = __filterUpdates(processedData.recordsToUpdate);

      }

      return processedData;
    }

    /**
    * @returns {Promise<number>} Number of records actually processed
    */
    async function ___deleteSourceRecords(): Promise<number> {

      self.logger.infoNormal(RESOURCES.deletingSourceSObjectRecords, self.sObjectName);

      if (self.sourceData.records.length == 0) {
        self.logger.infoNormal(RESOURCES.nothingToDelete, self.sObjectName);
        return 0;
      }

      // Deleting ////////
      self.logger.infoVerbose(RESOURCES.amountOfRecordsToDelete, self.sObjectName, String(self.sourceData.records.length));

      let recordsToDelete = self.sourceData.records.map(record => {
        return {
          Id: record["Id"]
        }
      });

      // Create engine
      self.createApiEngine(self.sourceData.org, OPERATION.Delete, recordsToDelete.length, true);
      let resultRecords = await self.apiEngine.executeCRUDMultithreaded(recordsToDelete, self.apiProgressCallback, self.getParallelThreadCount());
      if (resultRecords == null) {
        self._apiOperationError(OPERATION.Delete);
      }

      // Done
      self.logger.infoVerbose(RESOURCES.deletingRecordsCompleted, self.sObjectName);

      return resultRecords.length;
    }

    /**
    * @returns {Promise<number>} Number of records actually processed
    */
    async function ___updateData(data: ProcessedData): Promise<number> {

      let totalProcessedAmount = 0;
      let targetFilenameSuffix = data.processPersonAccounts ? CONSTANTS.CSV_TARGET_FILE_PERSON_ACCOUNTS_SUFFIX : "";

      // Temporary store the current processed data
      // to allow access it from the Add-On engine
      self.processedData = data;

      // Call addon onBeforeUpdate event
      await self.runAddonEventAsync(ADDON_EVENTS.onBeforeUpdate)

      // Inserting ////////
      if (data.recordsToInsert.length > 0) {
        self.logger.infoVerbose(RESOURCES.amountOfRecordsTo,
          self.sObjectName,
          self.logger.getResourceString(RESOURCES.insert),
          String((data.recordsToInsert.length)));


        // Value mapping
        //self.mapRecords(data.recordsToInsert);

        self.createApiEngine(self.targetData.org, OPERATION.Insert, data.recordsToInsert.length, true, targetFilenameSuffix);
        let targetRecords = await self.apiEngine.executeCRUDMultithreaded(data.recordsToInsert, self.apiProgressCallback, self.getParallelThreadCount());

        if (targetRecords == null) {
          self._apiOperationError(OPERATION.Insert);
        }
        totalProcessedAmount += targetRecords.length;

        // Set external ids ---
        self._setExternalIdMap(targetRecords, self.targetData.extIdRecordsMap, self.targetData.idRecordsMap);

        // Map records ---
        targetRecords.forEach(target => {
          let source = data.clonedToSourceMap.get(target);
          if (source) {
            self.data.sourceToTargetRecordMap.set(source, target);
            data.insertedRecordsSourceToTargetMap.set(source, target);
          }
        });
      }

      // Updating ///////
      if (data.recordsToUpdate.length > 0) {
        self.logger.infoVerbose(RESOURCES.amountOfRecordsTo,
          self.sObjectName,
          self.logger.getResourceString(RESOURCES.update),
          String((data.recordsToUpdate.length)));

        // Value mapping
        //self.mapRecords(data.recordsToUpdate);

        self.createApiEngine(self.targetData.org, OPERATION.Update, data.recordsToUpdate.length, false, targetFilenameSuffix);
        let targetRecords = await self.apiEngine.executeCRUDMultithreaded(data.recordsToUpdate, self.apiProgressCallback, self.getParallelThreadCount());

        if (targetRecords == null) {
          self._apiOperationError(OPERATION.Update);
        }
        totalProcessedAmount += targetRecords.length;

        // Map records ---
        // TODO: This is new update, check if it has no any negative impact
        targetRecords.forEach(target => {
          let source = data.clonedToSourceMap.get(target);
          // Prevent override of previously mapped inserts
          if (source && !self.data.sourceToTargetRecordMap.has(source)) {
            self.data.sourceToTargetRecordMap.set(source, target);
          }
        });
      }

      // Call addon onAfterUpdate event
      await self.runAddonEventAsync(ADDON_EVENTS.onAfterUpdate)

      return totalProcessedAmount;
    }

    /**
     * After the Person Accounts inserted the Person Contacts are automatically added.
     * Need to query and add them to the local data storage.
     *
     * @param {ProcessedData} personAccountsInsertData The last person account insert result
     * @returns {Promise<number>} Number of records actually processed
     */
    async function ___insertPersonContactsFromPersonAccounts(personAccountsInsertData: ProcessedData): Promise<number> {
      let contactTask = self.job.tasks.filter(task => task.sObjectName == "Contact")[0];
      if (contactTask) {
        let targetPersonAccountIdTosourceContactMap: Map<string, any> = new Map<string, any>();
        let targetAccountIds = new Array<string>();
        contactTask.sourceData.records.forEach(sourceContact => {
          let accountId = sourceContact["AccountId"];
          if (accountId && !contactTask.data.sourceToTargetRecordMap.has(sourceContact)) {
            let sourceAccount = self.sourceData.idRecordsMap.get(accountId);
            let targetAccount = personAccountsInsertData.insertedRecordsSourceToTargetMap.get(sourceAccount);
            if (targetAccount) {
              let targetAccountId = targetAccount["Id"];
              if (targetAccountId) {
                targetPersonAccountIdTosourceContactMap.set(targetAccountId, sourceContact);
                targetAccountIds.push(targetAccountId);
              }
            }
          }
        });
        // Query on Person Contacts
        let queries = Common.createFieldInQueries(contactTask.data.fieldsInQuery, "AccountId", contactTask.sObjectName, targetAccountIds);
        if (queries.length > 0) {
          // Start message ------
          self.logger.infoNormal(RESOURCES.queryingIn2, self.sObjectName, self.logger.getResourceString(RESOURCES.personContact));
          // Fetch target records
          let records = await self._retrieveFilteredRecords(queries, self.targetData, self._targetFieldMapping);
          if (records.length > 0) {
            //Set external id map --------- TARGET
            contactTask._setExternalIdMap(records, contactTask.targetData.extIdRecordsMap, contactTask.targetData.idRecordsMap, true);
            //Completed message ------
            let newRecordsCount = 0;
            records.forEach(targetContact => {
              let accountId = targetContact["AccountId"];
              let sourceContact = targetPersonAccountIdTosourceContactMap.get(accountId);
              if (sourceContact && !contactTask.data.sourceToTargetRecordMap.has(sourceContact)) {
                contactTask.data.sourceToTargetRecordMap.set(sourceContact, targetContact);
                sourceContact[CONSTANTS.__IS_PROCESSED_FIELD_NAME] = true;
                newRecordsCount++;
              }
            });
            self.logger.infoNormal(RESOURCES.queryingFinished, self.sObjectName, self.logger.getResourceString(RESOURCES.personContact), String(newRecordsCount));
            return newRecordsCount;
          }
        }
      }
      return 0;
    }

    function ___updatePrsonAccountFields(processedData: ProcessedData, source: any, cloned: any, isPersonRecord: boolean) {
      if (self.sObjectName == "Account") {
        if (isPersonRecord) {
          // Person account record
          // Name of Person account => split into First name / Last name
          if (!cloned["FirstName"] && !cloned["LastName"]
            && processedData.fieldNames.indexOf("FirstName") >= 0 // Currently updating First/Last names fo account
          ) {

            let parts = (source["Name"] || '').split(' ');
            cloned["FirstName"] = parts[0] || '';
            cloned["LastName"] = parts[1] || '';
            cloned["FirstName"] = !cloned["FirstName"] && !cloned["LastName"] ? Common.makeId(10) : cloned["FirstName"];
          }
        } else {
          // Business account record
          // First name & last name of Business account => join into Name
          if (processedData.fieldNames.indexOf("Name") >= 0) {
            cloned["Name"] = cloned["Name"] || `${source["FirstName"]} ${source["LastName"]}`;
            cloned["Name"] = !(cloned["Name"] || '').trim() ? Common.makeId(10) : cloned["Name"];
          }
        }
      }
    }

    function ___updateLookupIdFields(processedData: ProcessedData, source: any, cloned: any) {
      processedData.lookupIdFields.forEach(idField => {
        cloned[idField.nameId] = null;
        let found = false;
        let parentId = source[idField.nameId];
        if (parentId) {
          let parentTask = idField.parentLookupObject.task;
          let parentRecord = parentTask.sourceData.idRecordsMap.get(parentId);
          if (parentRecord) {
            let targetRecord = parentTask.data.sourceToTargetRecordMap.get(parentRecord);
            if (targetRecord) {
              let id = targetRecord["Id"];
              if (id) {
                cloned[idField.nameId] = id;
                found = true;
              }
            }
          }
        }
        if (parentId && !found) {
          let csvRow: IMissingParentLookupRecordCsvRow = {
            "Date update": Common.formatDateTime(new Date()),
            "Child Id": source["Id"],
            "Child Lookup Id Field": idField.nameId,
            "Child Lookup Reference Field": idField.fullName__r,
            "Child SObject": idField.scriptObject.name,
            "Parent SObject": idField.parentLookupObject.name,
            "Parent ExternalId Field": idField.parentLookupObject.externalId,
            "Missing expected parent ExternalID value": source[idField.fullName__r] || source[idField.nameId]
          };
          processedData.missingParentLookups.push(csvRow);
        }
      });
    }

    async function ___filterRecords(records: Array<any>): Promise<Array<any>> {
      return new Promise<Array<any>>(async resolve => {

        self.tempRecords = records;
        await self.runAddonEventAsync(ADDON_EVENTS.onTargetDataFiltering);
        records = self.tempRecords;

        if (!self.scriptObject.targetRecordsFilter) {
          resolve(records);
          return;
        }
        try {
          alasql(`SELECT * FROM ? WHERE ${self.scriptObject.targetRecordsFilter}`, [records], function (selectedRecords: any) {
            resolve(selectedRecords);
          });
        } catch (ex) {
          self.logger.warn(RESOURCES.skippedTargetRecordsFilterWarning, ex.message);
          resolve(records);
        }
      });
    }

    function ___removeRecordFields(record: any, fieldsToRemove: Array<string>) {
      if (fieldsToRemove.length == 0) return;
      fieldsToRemove.forEach(field => {
        delete record[field];
      });
    }

    function ___removeCSVFileColumns(records: Array<any>): Array<any> {
      // Create the list of columns to remove from the CSV file
      let fieldNamesToRemove = self.script.excludeIdsFromCSVFiles ? self.data.sFieldsInQuery.filter(field => {
        /* Account__c (all lookup id fields, not when ExternalId == Id)*/
        return (field.name == "Id" || field.isSimpleReference) && !field.isOriginalExternalIdField
          /* Account__r.Id (only when Original Externalid != Id and ExternalID == Id)*/
          //|| field.is__r && field.parentLookupObject.externalId == "Id" && field.parentLookupObject.originalExternalId != "Id";
          || field.is__r && field.name.endsWith('.Id') && field.parentLookupObject.externalId == "Id" && field.parentLookupObject.originalExternalId != "Id";
      }).map(field => field.name) : new Array<string>();

      // Add ___Id column
      fieldNamesToRemove = fieldNamesToRemove.concat(CONSTANTS.__ID_FIELD_NAME, CONSTANTS.__IS_PROCESSED_FIELD_NAME);

      // Remove properties corresponds to the selected columns
      records.forEach(record => {
        fieldNamesToRemove.forEach(fieldName => delete record[fieldName]);
      });

      return records;
    }

    async function ___writeToTargetCSVFile(records: Array<any>): Promise<void> {
      if (self.script.createTargetCSVFiles) {
        await Common.writeCsvFileAsync(self.data.getTargetCSVFilename(self.operation), records, true);
      }
    }

    function __filterInserts(records: Array<any>): Array<any> {
      // Remove unnecessary records from AccountContactRelation ///////////
      if (self.sObjectName == "AccountContactRelation") {
        // Remove primary Contacts
        let contactTask = self.job.tasks.filter(task => task.sObjectName == "Contact")[0];
        if (contactTask) {
          records = records.filter(record => {
            let targetContact = contactTask.targetData.idRecordsMap.get(record["ContactId"]);
            if (targetContact && targetContact["AccountId"] == record["AccountId"]) {
              // This is the primary Contact for given Account,
              //   so don't need to insert AccountRelationObject for this
              //     => record is not encessary, remove it
              return false;
            }
            // => Record is necessary, leave it
            return true;
          });
        }
      }
      return records;
    }

    function __filterUpdates(records: Array<any>): Array<any> {
      // TODO: Optional, implement this if needed
      return records;
    }

    function ___truncateRecords(records: Array<any>): Array<any> {
      if (records.length == 0) {
        return records;
      }
      if (self.script.allowFieldTruncation) {
        let sfieldsToTruncate = self.data.sFieldsToUpdate.filter(field => field.isTextual
          && Object.keys(records[0]).indexOf(field.name) >= 0);
        records.forEach(record => {
          sfieldsToTruncate.forEach(field => {
            if (field.length > 0) {
              record[field.name] = record[field.name] && String(record[field.name]).substr(0, field.length);
            }
          });
        });
      }
      return records;
    }

    function ___mockRecords(records: Array<any>): Array<any> {
      let updatedRecords = new Array<any>();
      if (records.length == 0) {
        return updatedRecords;
      }
      let recordIds = records.map(x => x["Id"]);
      let recordFields = Object.keys(records[0]);
      if (self.scriptObject.updateWithMockData && self.scriptObject.mockFields.length > 0) {
        let fieldNameToMockFieldMap: Map<string, IMockField> = new Map<string, IMockField>();
        self.data.sFieldsToUpdate.forEach(fieldDescribe => {
          let mockField = ___getMockPatternByFieldName(fieldDescribe.name);
          if ((recordFields.indexOf(mockField.name) >= 0
            || mockField.name == CONSTANTS.MOCK_ALL_FIELDS_PATTERN && recordFields.indexOf(fieldDescribe.name))
            && mockField.pattern) {
            let fn = mockField.pattern;
            let mockFieldNameToUse = mockField.name == CONSTANTS.MOCK_ALL_FIELDS_PATTERN ? fieldDescribe.name : mockField.name;
            if (CONSTANTS.SPECIAL_MOCK_COMMANDS.some(x => fn.startsWith(x + "("))) {
              fn = fn.replace(/\(/, `('${mockFieldNameToUse}',`);
            }
            mockField.excludedRegex = mockField.excludedRegex || '';
            mockField.includedRegex = mockField.includedRegex || '';
            fieldNameToMockFieldMap.set(mockFieldNameToUse, <IMockField>{
              fn,
              regExcl: mockField.excludedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
              regIncl: mockField.includedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
              disallowMockAllRecord: mockField.excludedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
              allowMockAllRecord: mockField.includedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
            });
          }
        });
        MockGenerator.resetCounter();
        records.forEach((originalRecord: any, index: number) => {
          let updatedRecord = Object.assign({}, originalRecord);
          let doNotMock = false;
          let mockAllRecord = false;
          let fieldsToMockMap: Map<string, boolean> = new Map<string, boolean>();
          [...fieldNameToMockFieldMap.keys()].forEach(fieldName => {
            if (!doNotMock) {
              let mockField = fieldNameToMockFieldMap.get(fieldName);
              let value = updatedRecord[fieldName];
              let excluded = !!mockField.regExcl && ___testRegex(mockField.regExcl, value);
              let included = !!mockField.regIncl && ___testRegex(mockField.regIncl, value);
              if (included && mockField.allowMockAllRecord) {
                mockAllRecord = true;
              }
              if (excluded && mockField.disallowMockAllRecord) {
                doNotMock = true;
              } else {
                if (mockAllRecord || (!mockField.regExcl || !excluded) && (!mockField.regIncl || included)) {
                  fieldsToMockMap.set(fieldName, true);
                }
              }
            }
          });
          if (!doNotMock) {
            [...fieldNameToMockFieldMap.keys()].forEach(fieldName => {
              if (mockAllRecord || fieldsToMockMap.has(fieldName)) {
                let mockField = fieldNameToMockFieldMap.get(fieldName);
                if (mockField.fn == "ids") {
                  updatedRecord[fieldName] = recordIds[index];
                } else {
                  updatedRecord[fieldName] = eval(`casual.${mockField.fn}`);
                }
              }
            });
          }

          updatedRecords.push(updatedRecord);
        });
      } else {
        return records;
      }
      return updatedRecords;
    }

    function ___testRegex(expr: string, value: any): boolean {
      switch (expr) {
        case CONSTANTS.SPECIAL_MOCK_PATTERNS.get(SPECIAL_MOCK_PATTERN_TYPES.haveAnyValue):
          // *
          return !!value;

        case CONSTANTS.SPECIAL_MOCK_PATTERNS.get(SPECIAL_MOCK_PATTERN_TYPES.missingValue):
          // ^*
          return !value;

        default:
          // regex
          return new RegExp(expr, 'ig').test(String(value));
      }
    }

    function ___getMockPatternByFieldName(fieldName: string): ScriptMockField {
      return self.scriptObject.mockFields.filter(field =>
        (field.name == fieldName
          || field.name == CONSTANTS.MOCK_ALL_FIELDS_PATTERN)
        && !field.excludeNames.includes(fieldName))[0] || new ScriptMockField();
    }

    /**
     * @returns {boolean} true = > not equal
     */
    function ___compareRecords(target: any, cloned: any, fieldsToCompareRecords: Array<string>): boolean {
      if (target && !cloned || cloned && !target) {
        return true;
      }
      return Object.keys(cloned)
        .filter(key => fieldsToCompareRecords.length == 0 || fieldsToCompareRecords.indexOf(key) >= 0)
        .some(key => {
          if (key != "Id" && key != CONSTANTS.__ID_FIELD_NAME) {
            // FIXME: && target.hasOwnProperty(key) solves issue
            // Auto-number fields ignored when used as sourceField in fieldMapping #89
            // But it causes error when copying self-referencing fields with field mapping with complex extgernal id
            return target[key] != cloned[key]; // && target.hasOwnProperty(key);
          }
          return false;
        });
    }
  }

  /**
   * Creates new api engine for the given org and operation
   *
   * @param {ScriptOrg} org The org to connect the api engine
   * @param {OPERATION} operation The operation to perform
   * @param {boolean} updateRecordId Allow update Id property
   *                                of the processed (the source) records
   *                                with the target record ids
   * @param {number} amountOfRecordsToProcess The total amount of records that should
   *                                          be processed using this engine instance
   * @returns {IApiEngine}
   * @memberof MigrationJobTask
   */
  createApiEngine(org: ScriptOrg, operation: OPERATION, amountOfRecordsToProcess: number, updateRecordId: boolean, targetFilenameSuffix?: string): IApiEngine {
    let engine: IApiEngine;
    if ((amountOfRecordsToProcess > this.script.bulkThreshold && !this.script.alwaysUseRestApiToUpdateRecords)
      && CONSTANTS.NOT_SUPPORTED_OBJECTS_IN_BULK_API.indexOf(this.sObjectName) < 0) {
      if (this.scriptObject.hardDelete == true && operation == OPERATION.Delete) {
        operation = OPERATION.HardDelete;
      }
      // Use bulk api
      switch (this.script.bulkApiVersionNumber) {
        case 2: // Bulk Api V2.0
          engine = new BulkApiV2_0Engine({
            logger: this.logger,
            connectionData: org.connectionData,
            sObjectName: this.sObjectName,
            operation,
            pollingIntervalMs: this.script.pollingIntervalMs,
            concurrencyMode: this.script.concurrencyMode,
            updateRecordId,
            targetCSVFullFilename: this.data.getTargetCSVFilename(operation, targetFilenameSuffix),
            createTargetCSVFiles: this.script.createTargetCSVFiles,
            targetFieldMapping: this._targetFieldMapping,
            simulationMode: this.script.simulationMode,
            binaryDataCache: this.script.binaryDataCache
          });
          break;
        default: // Bulk Api V1.0
          engine = new BulkApiV1_0Engine({
            logger: this.logger,
            connectionData: org.connectionData,
            sObjectName: this.sObjectName,
            operation,
            pollingIntervalMs: this.script.pollingIntervalMs,
            concurrencyMode: this.script.concurrencyMode,
            updateRecordId,
            bulkApiV1BatchSize: this.scriptObject.batchSizes.bulkV1BatchSize,
            targetCSVFullFilename: this.data.getTargetCSVFilename(operation, targetFilenameSuffix),
            createTargetCSVFiles: this.script.createTargetCSVFiles,
            targetFieldMapping: this._targetFieldMapping,
            simulationMode: this.script.simulationMode,
            binaryDataCache: this.script.binaryDataCache
          });
          break;
      }
    } else {
      // Use rest api
      engine = new RestApiEngine({
        logger: this.logger,
        connectionData: org.connectionData,
        sObjectName: this.sObjectName,
        operation,
        pollingIntervalMs: this.script.pollingIntervalMs,
        concurrencyMode: this.script.concurrencyMode,
        updateRecordId,
        restApiBatchSize: this.scriptObject.batchSizes.restBatchSize,
        allOrNone: this.script.allOrNone,
        targetCSVFullFilename: this.data.getTargetCSVFilename(operation, targetFilenameSuffix),
        createTargetCSVFiles: this.script.createTargetCSVFiles,
        targetFieldMapping: this._targetFieldMapping,
        simulationMode: this.script.simulationMode,
        binaryDataCache: this.script.binaryDataCache,
        binaryCacheDirectory: this.script.binaryCacheDirectory
      });
    }
    this.setApiEngine(engine);
    return this.apiEngine;
  }

  /**
   * Returns number of parallel jobs can be run simultaneously in parallel
   *
   * @return {*}  {number}
   * @memberof MigrationJobTask
   */
  getParallelThreadCount(): number {
    return this.apiEngine.getIsRestApiEngine() ?
      (this.scriptObject.parallelRestJobs || this.scriptObject.script.parallelRestJobs)
      : (this.scriptObject.parallelBulkJobs || this.scriptObject.script.parallelBulkJobs);
  }

  /**
   * Executes addon event related to the current executed object
   *
   * @param {ADDON_EVENTS} event The addon event to execute
   * @returns {Promise<void>}
   * @memberof MigrationJobTask
   */
  async runAddonEventAsync(event: ADDON_EVENTS): Promise<boolean> {
    return await this.script.addonManager.triggerAddonModuleMethodAsync(event, this.sObjectName);
  }

  /**
   * Set the API engine instance for the current task
   *
   * @param {IApiEngine} engine The engine instance
   * @memberof MigrationJobTask
   */
  setApiEngine(engine: IApiEngine) {
    this.apiEngine = engine;
    this.apiProgressCallback = this.apiProgressCallback || this._apiProgressCallback.bind(this);
  }

  mapRecords(records: Array<any>): void {
    if (records.length == 0 || !this.scriptObject.useValuesMapping) {
      return;
    }
    this.logger.infoNormal(RESOURCES.mappingValues, this.sObjectName);
    let fields = Object.keys(records[0]);
    fields.forEach(field => {
      let key = this.sObjectName + field;
      let valuesMap = this.job.valueMapping.get(key);
      if (valuesMap && valuesMap.size > 0) {
        let sourceExtIdMap: Map<string, string>;
        let nameId: string;
        let describe = this.data.sFieldsInQuery.filter(f => {
          return f.name == field;
        })[0];
        if (describe && describe.is__r) {
          let parentTask = this.job.getTaskBySObjectName(describe.parentLookupObject.name);
          if (parentTask) {
            sourceExtIdMap = parentTask.sourceData.extIdRecordsMap;
            nameId = describe.nameId;
          }
        }

        // Regex
        let regexp: RegExp;
        let regexpReplaceValue: any;
        valuesMap.forEach((newValue, rawValue) => {
          try {
            if (new RegExp(CONSTANTS.FIELDS_MAPPING_REGEX_PATTERN).test(rawValue)) {
              let pattern = rawValue.replace(new RegExp(CONSTANTS.FIELDS_MAPPING_REGEX_PATTERN), '$1');
              regexpReplaceValue = newValue;
              regexp = regexpReplaceValue && new RegExp(pattern, 'gi');
            }
          } catch (ex) { }
        });

        records.forEach((record: any) => {
          let newValue: any;
          let rawValue = ((typeof record[field] === 'undefined') ? "" : String(record[field])).trim();
          if (regexp) {
            // Use regex
            try {
              if (regexp.test(rawValue)) {
                // Eval (& Regex)
                const replaceValue = __eval(rawValue, regexpReplaceValue);
                // Regex
                newValue = rawValue.replace(regexp, replaceValue);
              }
            } catch (ex) { }
          }
          // Regular replace
          newValue = newValue ? valuesMap.get(String(newValue)) || newValue : valuesMap.get(rawValue) || rawValue;

          // Correct values
          newValue = newValue == 'TRUE' || newValue == 'true' ? true :
            newValue == 'FALSE' || newValue == 'false' ? false :
              newValue == 'null' || newValue == 'NULL' || newValue == 'undefined' || newValue == '#N/A' || newValue == undefined ? null : newValue;

          // Eval
          newValue = __eval(rawValue, newValue);

          if (new RegExp(CONSTANTS.FIELDS_MAPPING_EVAL_PATTERN, 'i').test(newValue)) {
            let expr = newValue.replace(new RegExp(CONSTANTS.FIELDS_MAPPING_EVAL_PATTERN, 'i'), '$1');
            expr = expr.replace(new RegExp(CONSTANTS.FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE, 'gi'), rawValue);
            try {
              newValue = eval(expr);
            } catch (ex) { }
          }

          if (typeof newValue != 'undefined') {
            record[field] = newValue;
          }

          // Replace lookups
          if (nameId && record.hasOwnProperty(nameId)) {
            let newValueId = sourceExtIdMap.get(newValue);
            if (newValueId) {
              record[nameId] = newValueId;
            }
          }
        });
      }
    });

    // ------------------ Internal functions ------------------------- //
    function __eval(rawValue: any, newValue: any) {
      if (new RegExp(CONSTANTS.FIELDS_MAPPING_EVAL_PATTERN, 'i').test(newValue)) {
        let expr = newValue.replace(new RegExp(CONSTANTS.FIELDS_MAPPING_EVAL_PATTERN, 'i'), '$1');
        expr = expr.replace(new RegExp(CONSTANTS.FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE, 'gi'), rawValue);
        try {
          newValue = eval(expr);
        } catch (ex) { }
      }
      return newValue;
    }

  }

  // ----------------------- Private members -------------------------------------------
  private _apiProgressCallback(apiResult: ApiInfo): void {

    let verbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
    let logMessageType = LOG_MESSAGE_TYPE.STRING;

    switch (apiResult.messageImportance) {

      case MESSAGE_IMPORTANCE.Silent:
        verbosity = LOG_MESSAGE_VERBOSITY.NONE;
        break;

      case MESSAGE_IMPORTANCE.Normal:
        verbosity = LOG_MESSAGE_VERBOSITY.NORMAL;
        break;

      case MESSAGE_IMPORTANCE.High:
        verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
        break;

      case MESSAGE_IMPORTANCE.Warn:
        verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
        logMessageType = LOG_MESSAGE_TYPE.WARN;
        break;

      case MESSAGE_IMPORTANCE.Error:
        verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
        logMessageType = LOG_MESSAGE_TYPE.ERROR;
        break;

    }
    switch (apiResult.resultStatus) {
      case RESULT_STATUSES.Information:
        if (apiResult.informationMessageData.length > 0) {
          // [0] - always is the RESOURCE message
          // [1...] - the rest of the RESOURCE message tokens
          let resourceString = this.logger.getResourceString.apply(this.logger, [apiResult.informationMessageData[0], ...apiResult.informationMessageData.slice(1)])
          this.logger.log.apply(this.logger, [resourceString, logMessageType, verbosity]);
        }
        break;
      case RESULT_STATUSES.ApiOperationStarted:
        let simulationModeResourceString = this.script.simulationMode ? this.logger.getResourceString(RESOURCES.simulationMode) : "";
        this.logger.log(RESOURCES.apiOperationStarted, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation(), this.apiEngine.getEngineName(), simulationModeResourceString);
        break;
      case RESULT_STATUSES.ApiOperationFinished:
        this.logger.log(RESOURCES.apiOperationFinished, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation());
        break;
      case RESULT_STATUSES.JobCreated:
        this.logger.log(RESOURCES.apiOperationJobCreated, logMessageType, verbosity, apiResult.jobId, this.apiEngine.getStrOperation(), this.sObjectName);
        break;
      case RESULT_STATUSES.BatchCreated:
        this.logger.log(RESOURCES.apiOperationBatchCreated, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName);
        break;
      case RESULT_STATUSES.DataUploaded:
        this.logger.log(RESOURCES.apiOperationDataUploaded, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName);
        break;
      case RESULT_STATUSES.InProgress:
        this.logger.log(RESOURCES.apiOperationInProgress, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName, String(apiResult.numberRecordsProcessed), String(apiResult.numberRecordsFailed));
        break;
      case RESULT_STATUSES.Completed:
        this.logger.log(logMessageType != LOG_MESSAGE_TYPE.WARN ? RESOURCES.apiOperationCompleted : RESOURCES.apiOperationWarnCompleted, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName, String(apiResult.numberRecordsProcessed), String(apiResult.numberRecordsFailed));
        break;
      case RESULT_STATUSES.ProcessError:
      case RESULT_STATUSES.FailedOrAborted:
        if (apiResult.errorMessage)
          this.logger.log(RESOURCES.apiOperationFailedWithMessage, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation(), apiResult.errorMessage);
        else
          this.logger.log(RESOURCES.apiOperationFailed, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation());
        break;
    }
  }

  private _apiOperationError(operation: OPERATION) {
    throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.apiOperationFailed, this.sObjectName, OPERATION[operation] || this.apiEngine.getStrOperation()));
  }

  private _createFilteredQueries(queryMode: "forwards" | "backwards" | "target", reversed: boolean, fieldNames?: string[]): Array<string> {

    let queries = new Array<string>();
    let fieldsToQueryMap: Map<SFieldDescribe, Array<string>> = new Map<SFieldDescribe, Array<string>>();
    let isSource = queryMode != "target";

    if (reversed) {
      if (CONSTANTS.OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE.indexOf(this.sObjectName) < 0) {
        // ONLY SOURCE + FORWARDS FOR reversed == true !
        let fields: SFieldDescribe[] = Common.flatMap(this.data.sFieldsInQuery
          .filter(field => field.child__rSFields.length > 0), (field: SFieldDescribe) => {
            return field.child__rSFields.map(f => f.idSField);
          });
        let values = new Array<string>();
        fields.forEach((field: SFieldDescribe) => {
          values = values.concat(field.scriptObject.task.sourceData.records
            .map((value: any) => value[field.nameId])
            .filter(value => !!value));
        });
        values = Common.distinctStringArray(values);
        fieldsToQueryMap.set(new SFieldDescribe({
          name: "Id"
        }), values);
      }
    } else {
      this.data.sFieldsInQuery.forEach(field => {
        if (isSource) {
          // SOURCE
          // For source => |SOURCE Case|Account__c IN (|SOURCE Account|Id....)
          if (field.isSimpleReference
            && field.parentLookupObject.isInitialized
            && CONSTANTS.OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE.indexOf(field.referencedObjectType) < 0) {
            // Only for simple reference lookup fields (f.ex.: Account__c)

            // *** The previous logic:
            // -----------------------
            // if (!field.parentLookupObject.task.sourceData.allRecords
            //   || field.parentLookupObject.isLimitedQuery

            //   // *** The new (fixed) logic:
            //   //-------------------
            //   // Fixed the issue of incorrect fetching releated records when
            //   // the parent object is master and the child object is slave:
            //   // - field.parentLookupObject.task.sourceData.allRecords = true -> Fetch all records mode for the parent sObject
            //   // - this.scriptObject.allRecords = false -> The current sObject is NOT master
            //   //   === > also need to create the filtered queries.
            //   // (TODO: need to check if it's working properly)
            //   || field.parentLookupObject.task.sourceData.allRecords && !this.scriptObject.allRecords
            // ) {

            // Caution! Important change!
            // Now limited queries are constructed for the SOURCE object regardless the retrieve mode (master/slave)
            //   of the parent object
            if (queryMode != "forwards") {
              //BACKWARDS
              // For backwards => build the query using all the PREVIOUS related tasks by the tasks order
              if (this.data.prevTasks.indexOf(field.parentLookupObject.task) >= 0) {
                // The parent task is before => create child lookup query for all Id values of the parent lookup object
                fieldsToQueryMap.set(field, [...field.parentLookupObject.task.sourceData.idRecordsMap.keys()]);
              }
            } else {
              // FORWARDS
              // For forwards => build the query using all the NEXT related tasks by the tasks order
              if (this.data.nextTasks.indexOf(field.parentLookupObject.task) >= 0) {
                // The parent task is after => create child lookup query for all Id values of the parent lookup object
                fieldsToQueryMap.set(field, [...field.parentLookupObject.task.sourceData.idRecordsMap.keys()]);
              }
            }
            //}
          }
        } else {
          // TARGET
          // For target => |TARGET Account|Name IN (|SOURCE Account|Name....)
          if (field.isSimpleNotLookup && field.isExternalIdField) {
            // Only for current object's external id (f.ex.: Name) - not complex and not Id - only simple
            fieldsToQueryMap.set(field, [...this.sourceData.extIdRecordsMap.keys()]);
          }
        }
      });
    }
    let where: string;

    // Caution! Important change!
    // Now we DO NOT add the original query string into the list of queries for the SOURCE object.
    //   Instead we extract the WHERE clause from the original query string
    //   and add it to EACH of filtered query with AND logic.
    if (isSource && this.scriptObject.isLimitedQuery && !reversed) {
      //queries.push(this.createQuery(fieldNames));
      where = Common.extractWhereClause(this.scriptObject.query);
    }
    fieldsToQueryMap.forEach((inValues, field) => {
      // Filter by cached values => get out all duplicated IN values thet
      // were previously queried
      let valueCache = this.tempData.filteredQueryValueCache.get(field.name);
      if (!valueCache) {
        valueCache = new Set<string>();
        this.tempData.filteredQueryValueCache.set(field.name, valueCache);
      }
      inValues = inValues.filter(inValue => !valueCache.has(inValue));
      if (inValues.length > 0) {
        inValues.forEach(inValue => {
          valueCache.add(inValue);
        });
        // Create and add query
        Common.createFieldInQueries(fieldNames || this.data.fieldsInQuery, field.name, this.sObjectName, inValues, where).forEach(query => {
          queries.push(query);
        });
      }
    });
    return queries;

  }

  /**
   * @returns {number} New records count
   */
  private _setExternalIdMap(records: Array<any>,
    sourceExtIdRecordsMap: Map<string, string>,
    sourceIdRecordsMap: Map<string, string>,
    isTarget: boolean = false): number {

    let newRecordsCount = 0;

    records.forEach(targetRecord => {
      if (targetRecord["Id"]) {
        let value = this.getRecordValue(targetRecord, this.complexExternalId);
        if (value) {
          sourceExtIdRecordsMap.set(value, targetRecord["Id"]);
        }
        if (!sourceIdRecordsMap.has(targetRecord["Id"])) {
          sourceIdRecordsMap.set(targetRecord["Id"], targetRecord);
          targetRecord[CONSTANTS.__ID_FIELD_NAME] = targetRecord["Id"];
          if (isTarget) {
            let extIdValue = this.getRecordValue(targetRecord, this.complexExternalId);
            if (extIdValue) {
              let sourceId = this.sourceData.extIdRecordsMap.get(extIdValue);
              if (sourceId) {
                let sourceRecord = this.sourceData.idRecordsMap.get(sourceId);
                this.data.sourceToTargetRecordMap.set(sourceRecord, targetRecord);
              }
            }
          }
          newRecordsCount++;
        }
      } else {
        targetRecord[CONSTANTS.__ID_FIELD_NAME] = Common.makeId(18);
      }
    });
    return newRecordsCount;
  }

  private async _retrieveFilteredRecords(queries: string[], orgData: TaskOrgData, targetFieldMapping?: IFieldMapping, useQueryAll?: boolean): Promise<Array<any>> {
    let sfdx = new Sfdx(orgData.org, targetFieldMapping);
    let records = new Array<any>();
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      // Query message ------
      this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
      // Fetch records
      records = records.concat(await sfdx.queryOrgOrCsvAsync(query, false, undefined, undefined, useQueryAll));
    }
    return records;
  }

  private _transformQuery(query: string, sourceSObjectName: string) {

    let sourceParsedQuery = parseQuery(query);
    sourceSObjectName = sourceParsedQuery.sObject;
    let scriptObject = this.script.objectsMap.get(sourceSObjectName);
    let extraObjectDescr = this.script.extraSObjectDescriptions.get(sourceSObjectName);

    let fields = [];
    sourceParsedQuery.fields.forEach((f: FieldType) => {

      let field = f as SOQLField;
      let rawValue = String(field["rawValue"] || field.field);
      let fieldToAdd = rawValue;

      // Object-related filters ++++++++++++++
      if (scriptObject) {
        let describe = scriptObject.fieldsInQueryMap.get(rawValue);
        describe = describe || [...scriptObject.fieldsInQueryMap.values()]
          .filter(field => field.__rNames.filter(x => x == rawValue)[0])
          .filter(x => !!x)[0];
        if (describe) {

          // Start to transform fields/////
          // 1. Trasnsform polymorfic fields
          if (describe.isPolymorphicField && describe.is__r) {
            fieldToAdd = describe.getPolymorphicQueryField(rawValue);
          }
        }
      }

      // Other filters +++++++++++++
      // 1. Field verification
      if (extraObjectDescr && CONSTANTS.OBJECTS_TO_FERIFY_IN_QUERY_TRANSFORM.indexOf(sourceSObjectName) >= 0) {
        if (!extraObjectDescr.fieldsMap.has(rawValue)) {
          fieldToAdd = '';
        }
      }

      // Add to fields list ++++++++
      if (fieldToAdd) {
        fields.push(getComposedField(fieldToAdd));
      }


    });

    sourceParsedQuery.fields = fields;
    query = composeQuery(sourceParsedQuery);

    return {
      targetSObjectName: sourceSObjectName,
      query
    };

  }

  private _mapSourceQueryToTarget(query: string, sourceSObjectName: string): IFieldMappingResult {
    let mapping = this.script.sourceTargetFieldMapping.get(sourceSObjectName);
    if (mapping && mapping.hasChange) {
      let scriptObject = this.script.objectsMap.get(sourceSObjectName);
      if (scriptObject) {
        let targetParsedQuery = parseQuery(query);
        targetParsedQuery.sObject = mapping.targetSObjectName;
        let fields = [];
        targetParsedQuery.fields.forEach((f: FieldType) => {
          let field = f as SOQLField;
          let rawValue = String(field["rawValue"] || field.field);
          let describe = scriptObject.fieldsInQueryMap.get(rawValue);
          if (describe) {
            let targetField = describe.targetName + (field["alias"] ? " " + field["alias"] : "");
            fields.push(getComposedField(targetField));
            if (rawValue == "Id") {
              fields.unshift(getComposedField(rawValue));
            }
          } else {
            let targetField = rawValue + (field["alias"] ? " " + field["alias"] : "");
            fields.push(getComposedField(targetField));
          }
        });
        fields = Common.distinctArray(fields, 'field');
        targetParsedQuery.fields = fields;
        if (targetParsedQuery.where) {
          let left: Condition = targetParsedQuery.where.left;
          let right: WhereClause = targetParsedQuery.where.right;
          while (left) {
            let describe = scriptObject.fieldsInQueryMap.get(left.field);
            if (describe) {
              left.field = describe.targetName;
            }
            left = right && right.left;
            right = right && right.right;
          }
        }
        query = composeQuery(targetParsedQuery);
        this.logger.infoNormal(RESOURCES.mappingQuery, this.sObjectName, mapping.targetSObjectName, this.createShortQueryString(query));
        return {
          targetSObjectName: mapping.targetSObjectName,
          query
        };
      }
    }
    return {
      targetSObjectName: sourceSObjectName,
      query
    };
  }

  private _mapSourceRecordsToTarget(records: Array<any>, sourceSObjectName: string): IFieldMappingResult {
    let mapping = this.script.sourceTargetFieldMapping.get(sourceSObjectName);
    if (mapping && mapping.hasChange && records) {
      let scriptObject = this.script.objectsMap.get(sourceSObjectName);
      if (scriptObject) {
        this.logger.infoNormal(RESOURCES.mappingSourceRecords, this.sObjectName, mapping.targetSObjectName);
        let fieldMapping = scriptObject.sourceToTargetFieldNameMap;
        records.forEach(record => {
          fieldMapping.forEach((newProp, oldProp) => {
            if (newProp != oldProp && record.hasOwnProperty(oldProp)) {
              record[newProp] = record[oldProp];
              if (oldProp != "Id") { // Id => ExternalId__c (Id -> ExternalId__c)
                delete record[oldProp];
              }
            }
          });
        });
        return {
          targetSObjectName: mapping.targetSObjectName,
          records
        };
      }
    }
    return {
      targetSObjectName: sourceSObjectName,
      records
    };
  }

  private _mapTargetRecordsToSource(records: Array<any>, sourceSObjectName: string): IFieldMappingResult {
    let mapping = this.script.sourceTargetFieldMapping.get(sourceSObjectName);
    if (mapping && mapping.hasChange && records) {
      let scriptObject = this.script.objectsMap.get(sourceSObjectName);
      if (scriptObject) {
        this.logger.infoNormal(RESOURCES.mappingTargetRecords, this.sObjectName, mapping.targetSObjectName);
        let fieldMapping = scriptObject.sourceToTargetFieldNameMap;
        records.forEach(record => {
          fieldMapping.forEach((newProp, oldProp) => {
            if (newProp != oldProp && record.hasOwnProperty(newProp)) {
              if (oldProp != "Id") {
                record[oldProp] = record[newProp]; // Id => Externalid__c (ExternalId -> Id)
              }
              delete record[newProp];
            }
          });
        });
        return {
          targetSObjectName: mapping.targetSObjectName,
          records
        };
      }
    }
    return {
      targetSObjectName: sourceSObjectName,
      records
    };
  }

  private _targetFieldMapping: IFieldMapping = <IFieldMapping>{
    sourceQueryToTarget: this._mapSourceQueryToTarget.bind(this),
    sourceRecordsToTarget: this._mapSourceRecordsToTarget.bind(this),
    targetRecordsToSource: this._mapTargetRecordsToSource.bind(this),
    transformQuery: this._transformQuery.bind(this)
  }

  private _sourceFieldMapping: IFieldMapping = <IFieldMapping>{
    transformQuery: this._transformQuery.bind(this)
  }


}
