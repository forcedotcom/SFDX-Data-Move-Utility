/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  CachedCSVContent,
  MigrationJobTask as Task,
  ObjectFieldMapping,
  ProcessedData,
  Script,
  ScriptObject,
  SFieldDescribe,
  SuccessExit,
} from '../';
import { Common } from '../../components/common_components/common';
import {
  ADDON_EVENTS,
  DATA_MEDIA_TYPE,
} from '../../components/common_components/enumerations';
import {
  Logger,
  RESOURCES,
} from '../../components/common_components/logger';
import { CONSTANTS } from '../../components/common_components/statics';
import {
  ICSVIssueCsvRow,
  IMissingParentLookupRecordCsvRow,
} from '../common_models/helper_interfaces';
import MigrationJobTask from './migrationJobTask';

export default class MigrationJob {

  script: Script;
  tasks: Task[] = new Array<Task>();
  queryTasks: Task[] = new Array<Task>();
  deleteTasks: Task[] = new Array<Task>();
  valueMapping: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();
  csvIssues: Array<ICSVIssueCsvRow> = new Array<ICSVIssueCsvRow>();
  cachedCSVContent: CachedCSVContent = new CachedCSVContent();

  constructor(init: Partial<MigrationJob>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  get logger(): Logger {
    return this.script.logger;
  }

  get objects(): ScriptObject[] {
    return this.script.objects;
  }



  // ----------------------- Public methods -------------------------------------------
  /**
   * Setup this object
   *
   * @memberof MigrationJob
   */
  setup() {

    let self = this;

    this.script.job = this;
    let lowerIndexForAnyObjects = 0;
    let lowerIndexForReadonlyObjects = 0;

    // Create task chain in the optimized order
    // to put parent related objects before their children
    this.script.objects.forEach(objectToAdd => {

      // New task object to insert into the task chain
      let newTask: Task = new Task({
        scriptObject: objectToAdd,
        job: this
      });

      if (objectToAdd.allRecords
        || objectToAdd.isSpecialObject
        || objectToAdd.isObjectWithoutRelationships
      ) {
        objectToAdd.processAllSource = true; // Query string as is
        objectToAdd.processAllTarget = true;
      } else {
        objectToAdd.processAllSource = false; // Filtered query
        if (objectToAdd.hasComplexExternalId || objectToAdd.hasAutonumberExternalId) {
          objectToAdd.processAllTarget = true;
        } else {
          objectToAdd.processAllTarget = false;
        }
      }

      if (objectToAdd.name == CONSTANTS.RECORD_TYPE_SOBJECT_NAME) {
        // RecordType object is always at the beginning
        //   of the task chain
        this.tasks.unshift(newTask);
        lowerIndexForAnyObjects++;
        lowerIndexForReadonlyObjects++;
      } else if (this.script.keepObjectOrderWhileExecute) {
        // *** Using the explicit execution order as the objects appear in the Script *** //
        // ************** //

        this.tasks.push(newTask);
      } else if (objectToAdd.isReadonlyObject && !objectToAdd.isHierarchicalDeleteOperation) {
        // *** Using the smart automatic execution order *** //
        // ************** //

        // Readonly objects are always at the beginning
        //   of the task chain
        //   but after RecordType
        this.tasks.splice(lowerIndexForReadonlyObjects, 0, newTask);
        lowerIndexForAnyObjects++;
      } else if (this.tasks.length == 0) {
        // First object in the task chain
        this.tasks.push(newTask);
      } else {
        // The index where to insert the new object
        let indexToInsert: number = this.tasks.length;
        for (var existedTaskIndex = this.tasks.length - 1; existedTaskIndex >= lowerIndexForAnyObjects; existedTaskIndex--) {
          var existedTask = this.tasks[existedTaskIndex];
          // Check if the new object is parent lookup to the existed task
          let isObjectToAdd_ParentLookup = existedTask.scriptObject.parentLookupObjects.some(x => x.name == objectToAdd.name);
          if (isObjectToAdd_ParentLookup) {
            // The new object is the parent lookup
            //                  => it should be before BEFORE the existed task (replace existed task with it)
            indexToInsert = existedTaskIndex;
          }
          // The existed task is the parent lookup or the parent master-detail
          //                      => it should be AFTER the exited task (continue as is)
        }
        // Insert the new object
        //   into the task chain
        //   at the calculated index
        this.tasks.splice(indexToInsert, 0, newTask);
      }
    });

    if (this.script.keepObjectOrderWhileExecute) {
      // *** Use the explicit query order as the objects appear in the Script **** //
      // ************** //
      this.queryTasks = this.tasks.map(task => task);
      this.deleteTasks = this.queryTasks;
    } else {
      // *** Use smart automatic query order *** //
      // ************** //
      // Put master-detail lookups before
      let swapped = true;
      for (let iteration = 0; iteration < 10 && swapped; iteration++) {
        swapped = ___putMasterDetailsBefore();
      }

      // Create query task order
      this.tasks.forEach(task => {
        if (task.sourceData.allRecords
          || task.scriptObject.isLimitedQuery) {
          this.queryTasks.push(task);
        }
      });
      this.tasks.forEach(task => {
        if (this.queryTasks.indexOf(task) < 0) {
          this.queryTasks.push(task);
        }
      });
      // -- correct the order
      swapped = true;
      for (let iteration = 0; iteration < 10 && swapped; iteration++) {
        swapped = ___updateQueryTaskOrder();
      }

      // Create delete task order
      this.deleteTasks = this.tasks.slice().reverse();
    }

    // Output execution orders
    this.logger.objectMinimal({
      [this.logger.getResourceString(RESOURCES.queryingOrder)]: this.queryTasks.map(x => x.sObjectName).join("; ")
    });
    this.logger.objectMinimal({
      [this.logger.getResourceString(RESOURCES.deletingOrder)]: this.deleteTasks.map(x => x.sObjectName).join("; ")
    });
    this.logger.objectMinimal({
      [this.logger.getResourceString(RESOURCES.executionOrder)]: this.tasks.map(x => x.sObjectName).join("; ")
    });

    // Initialize the runtime job
    this.script.addonRuntime.createSfdmuPluginJob();

    // ------------------------------- Internal functions --------------------------------------- //
    function ___updateQueryTaskOrder() {
      let swapped = false;
      let tempTasks: Array<MigrationJobTask> = [].concat(self.queryTasks);
      for (let leftIndex = 0; leftIndex < tempTasks.length - 1; leftIndex++) {
        const leftTask = tempTasks[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < tempTasks.length; rightIndex++) {
          const rightTask = tempTasks[rightIndex];
          // The right object should be first + it is master or both objects are master=false.
          // It's better to keep the left object as master,
          // because if we put the master object to the right
          //      => sometimes we can get issues with finding the related records,
          // since the left object is filtered by the right and the right object records are not retrieved yet.
          let rightShouldBeBeforeTheLeft = CONSTANTS.SPECIAL_OBJECT_QUERY_ORDER.get(rightTask.scriptObject.name)
            && CONSTANTS.SPECIAL_OBJECT_QUERY_ORDER.get(rightTask.scriptObject.name).indexOf(leftTask.scriptObject.name) >= 0
            && (rightTask.scriptObject.allRecords || !leftTask.scriptObject.allRecords && !rightTask.scriptObject.allRecords);
          let leftTaskIndex = self.queryTasks.indexOf(leftTask);
          let rightTaskIndex = self.queryTasks.indexOf(rightTask);
          if (rightShouldBeBeforeTheLeft && rightTaskIndex > leftTaskIndex) {
            // Swape places and put right before left
            self.queryTasks.splice(rightTaskIndex, 1);
            self.queryTasks.splice(leftTaskIndex, 0, rightTask);
            swapped = true;
            console.log(self.queryTasks.map(x => x.sObjectName).join());
          }
        }
      }
      return swapped;
    }

    function ___putMasterDetailsBefore(): boolean {
      let swapped = false;
      let tempTasks: Array<MigrationJobTask> = [].concat(self.tasks);
      for (let leftIndex = 0; leftIndex < tempTasks.length - 1; leftIndex++) {
        const leftTask = tempTasks[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < tempTasks.length; rightIndex++) {
          const rightTask = tempTasks[rightIndex];
          let rightIsParentMasterDetailOfLeft = leftTask.scriptObject.parentMasterDetailObjects.some(object => object.name == rightTask.sObjectName);
          let leftTaskIndex = self.tasks.indexOf(leftTask);
          let rightTaskIndex = self.tasks.indexOf(rightTask);
          if (rightIsParentMasterDetailOfLeft && rightTaskIndex > leftTaskIndex) {
            // Swape places and put right before left
            self.tasks.splice(rightTaskIndex, 1);
            self.tasks.splice(leftTaskIndex, 0, rightTask);
            swapped = true;
          }
        }
      }
      return swapped;
    }
  }

  /**
   * Prepare execution of the job
   *
   * @memberof MigrationJob
   */
  prepareJob() {
    this.createSourceTargetMappingFields();
  }

  /**
   * Process and fix the CSV files including configuration CSV
   *
   * @returns {Promise<void>}
   * @memberof MigrationJob
   */
  async processCSVFilesAsync(): Promise<void> {

    // Load mapping files
    await this._loadValueMappingFileAsync();

    if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.File) {

      // Prepare source CSV files
      await this._mergeUserGroupCSVfiles();
      this._copyCSVFilesToSourceSubDir();

      if (!this.script.importCSVFilesAsIs) {

        // Validate and repair source csv files
        this.logger.infoMinimal(RESOURCES.processingCsvFiles);

        await this._validateAndRepairSourceCSVFiles();

        this.logger.infoVerbose(RESOURCES.validationCsvFileCompleted);

        if (this.script.validateCSVFilesOnly) {
          // Succeeded exit
          throw new SuccessExit();
        }

        // Free memory from the csv file data
        this.clearCachedCSVData();

      } else {
        this.logger.infoMinimal(RESOURCES.processingCsvFilesSkipped);
      }
    }
  }

  /**
  * Retireve the total record count for each task in the job
  *
  * @returns {Promise<void>}
  * @memberof MigrationJob
  */
  async getTotalRecordsCountAsync(): Promise<void> {

    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.analysingData);

    for (let index = 0; index < this.tasks.length; index++) {
      const task = this.tasks[index];
      await task.getTotalRecordsCountAsync();
    }
  }

  /**
  * Delete old records of each task in the job
  *
  * @returns {Promise<void>}
  * @memberof MigrationJob
  */
  async deleteOldRecordsAsync(): Promise<void> {

    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.deletingTargetData);

    let deleted = false;
    for (let index = 0; index < this.deleteTasks.length; index++) {
      const task = this.deleteTasks[index];
      deleted = await task.deleteOldTargetRecords() || deleted;
    }

    if (deleted) {
      this.logger.infoVerbose(RESOURCES.deletingDataCompleted);
    } else {
      this.logger.infoVerbose(RESOURCES.deletingDataSkipped);
    }
  }

  /**
   * Retrieve records for all tasks in the job
   *
   * @returns {Promise<void>}
   * @memberof MigrationJob
   */
  async retrieveRecordsAsync(): Promise<void> {

    //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // STEP 1 SOURCE FORWARDS  :::::::::::::::::::::::::::::::::::::::::::::::::

    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(this.logger.getResourceString(RESOURCES.source) + ':');
    this.logger.headerVerbose(RESOURCES.separator);

    let retrieved: boolean = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.retrievingData, this.logger.getResourceString(RESOURCES.step1));
    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("forwards", false) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }
    this.logger.infoNormal(RESOURCES.retrievingDataCompleted, this.logger.getResourceString(RESOURCES.step1));


    //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // STEP 2 SOURCE BACKWARDS ::::::::::::::::::::::::::::::::::::::::::::::::
    // PASS 1 ---
    retrieved = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.retrievingData, this.logger.getResourceString(RESOURCES.step2));

    this.logger.infoNormal(RESOURCES.pass1);
    this.logger.headerVerbose(RESOURCES.separator);

    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("backwards", false) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }

    // PASS 2 ---
    retrieved = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.infoNormal(RESOURCES.pass2);
    this.logger.headerVerbose(RESOURCES.separator);

    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("backwards", false) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }

    // PASS 3 --- SOURCE FORWARDS (REVERSE A)
    retrieved = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.infoNormal(RESOURCES.pass3);
    this.logger.headerVerbose(RESOURCES.separator);

    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("forwards", true) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }

    // PASS 4 --- SOURCE FORWARDS (REVERSE B)
    retrieved = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.infoNormal(RESOURCES.pass4);
    this.logger.headerVerbose(RESOURCES.separator);

    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("forwards", true) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }


    //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // STEP 3 TARGET ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    retrieved = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(this.logger.getResourceString(RESOURCES.target) + ':');
    this.logger.headerVerbose(RESOURCES.separator);

    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      retrieved = await task.retrieveRecords("target", false) || retrieved;
    }
    if (!retrieved) {
      this.logger.infoNormal(RESOURCES.noRecords);
    }
    this.logger.infoNormal(RESOURCES.retrievingDataCompleted, this.logger.getResourceString(RESOURCES.step2));


    //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // RUN ON-BEFORE ADDONS :::::::::::::::::::::::::::::::::::::::::::::::::::
    let processed = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerNormal(RESOURCES.processingAddon);
    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      processed = await task.runAddonEventAsync(ADDON_EVENTS.onBefore) || processed;
    }
    if (!processed) {
      this.logger.infoNormal(RESOURCES.nothingToProcess);
    }
    this.logger.infoVerbose(RESOURCES.newLine);


    //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // TOTAL FETCHED SUMMARY :::::::::::::::::::::::::::::::::::::::::::::::::::
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerNormal(RESOURCES.fetchingSummary);
    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      this.logger.infoNormal(RESOURCES.amuntOfRetrievedRecords,
        task.sObjectName,
        String(task.sourceData.idRecordsMap.size + "/" + task.targetData.idRecordsMap.size));
    }


    // Trigger event
    await this.runAddonEventAsync(ADDON_EVENTS.onDataRetrieved);
  }

  /**
   * Makes the all job for updating the target org / csv file
   *
   * @returns {Promise<void>}
   * @memberof MigrationJob
   */
  async updateRecordsAsync(): Promise<void> {

    let self = this;

    let noAbortPrompt = false;
    let totalProcessedRecordsAmount = 0;
    let totalProcessedRecordsByObjectsMap = new Map<string, number>();

    let allMissingParentLookups: IMissingParentLookupRecordCsvRow[] = new Array<IMissingParentLookupRecordCsvRow>();
    let tasksToProcess = this.script.hasDeleteFromSourceObjectOperation ? this.deleteTasks : this.tasks;

    //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // STEP 1 FORWARDS ::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.updatingTarget, this.logger.getResourceString(RESOURCES.step1));

    for (let index = 0; index < tasksToProcess.length; index++) {
      const task = tasksToProcess[index];
      let processedRecordsAmount = (await task.updateRecords("forwards", async (data: ProcessedData) => {
        allMissingParentLookups = allMissingParentLookups.concat(data.missingParentLookups);
        if (noAbortPrompt) {
          ___warn(data, task.sObjectName);
          return;
        }
        await ___promptToAbort(data, task.sObjectName);
        noAbortPrompt = true;
      }));
      if (processedRecordsAmount > 0) {
        this.logger.infoNormal(RESOURCES.updatingTargetObjectCompleted, task.sObjectName, String(processedRecordsAmount));
      }
      totalProcessedRecordsAmount += processedRecordsAmount;
      totalProcessedRecordsByObjectsMap.set(task.sObjectName, processedRecordsAmount);
    }
    if (totalProcessedRecordsAmount > 0)
      this.logger.infoNormal(RESOURCES.updatingTargetCompleted, this.logger.getResourceString(RESOURCES.step1), String(totalProcessedRecordsAmount));
    else
      this.logger.infoNormal(RESOURCES.nothingUpdated);


    //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // STEP 2 BACKWARDS :::::::::::::::::::::::::::::::::::::::::::::::::::::::
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerMinimal(RESOURCES.updatingTarget, this.logger.getResourceString(RESOURCES.step2));

    totalProcessedRecordsAmount = 0;

    if (this.script.targetOrg.media == DATA_MEDIA_TYPE.Org) {
      for (let index = 0; index < this.tasks.length; index++) {
        const task = this.tasks[index];
        let processedRecordsAmount = (await task.updateRecords("backwards", async (data: ProcessedData) => {
          allMissingParentLookups = allMissingParentLookups.concat(data.missingParentLookups);
          if (noAbortPrompt) {
            ___warn(data, task.sObjectName);
            return;
          }
          await ___promptToAbort(data, task.sObjectName);
          noAbortPrompt = true;
        }));
        if (processedRecordsAmount > 0) {
          this.logger.infoNormal(RESOURCES.updatingTargetObjectCompleted, task.sObjectName, String(processedRecordsAmount));
        }
        totalProcessedRecordsAmount += processedRecordsAmount;
        totalProcessedRecordsByObjectsMap.set(task.sObjectName, totalProcessedRecordsByObjectsMap.get(task.sObjectName) + processedRecordsAmount);
      }
    }
    if (totalProcessedRecordsAmount > 0)
      this.logger.infoNormal(RESOURCES.updatingTargetCompleted, this.logger.getResourceString(RESOURCES.step2), String(totalProcessedRecordsAmount));
    else
      this.logger.infoNormal(RESOURCES.nothingUpdated);


    //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // DELETE BY HIERARCHY ::::::::::::::::::::::::::::::::::::::::::::::::::::
    if (this.script.hasDeleteByHierarchyOperation) {
      this.logger.infoVerbose(RESOURCES.newLine);
      this.logger.headerMinimal(RESOURCES.deletingTarget, this.logger.getResourceString(RESOURCES.step1));

      for (let index = 0; index < this.deleteTasks.length; index++) {
        const task = this.deleteTasks[index];
        if (task.scriptObject.isHierarchicalDeleteOperation) {
          let processedRecordsAmount = await task.deleteRecords();
          if (processedRecordsAmount > 0) {
            this.logger.infoNormal(RESOURCES.deletingRecordsCompleted, task.sObjectName, String(processedRecordsAmount));
          }
          totalProcessedRecordsAmount += processedRecordsAmount;
          totalProcessedRecordsByObjectsMap.set(task.sObjectName, processedRecordsAmount);
        }
      }

      if (totalProcessedRecordsAmount > 0)
        this.logger.infoNormal(RESOURCES.deletingDataCompleted, this.logger.getResourceString(RESOURCES.step1), String(totalProcessedRecordsAmount));
      else
        this.logger.infoNormal(RESOURCES.nothingToDelete2);

      this.logger.infoVerbose(RESOURCES.newLine);
    }


    //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // RUN ON-AFTER ADDONS :::::::::::::::::::::::::::::::::::::::::::::::::::
    let processed = false;
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerNormal(RESOURCES.processingAddon);
    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      processed = await task.runAddonEventAsync(ADDON_EVENTS.onAfter) || processed;
    }
    if (!processed) {
      this.logger.infoNormal(RESOURCES.nothingToProcess);
    }
    this.logger.infoVerbose(RESOURCES.newLine);


    //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
    // TOTAL PROCESSED SUMMARY :::::::::::::::::::::::::::::::::::::::::::::::::::
    this.logger.infoVerbose(RESOURCES.newLine);
    this.logger.headerNormal(RESOURCES.updatingSummary);
    for (let index = 0; index < this.queryTasks.length; index++) {
      const task = this.queryTasks[index];
      this.logger.infoNormal(RESOURCES.updatingTotallyUpdated,
        task.sObjectName,
        String(totalProcessedRecordsByObjectsMap.get(task.sObjectName)));
    }

    // Done message
    this.logger.infoVerbose(RESOURCES.newLine);
    await self.saveCSVFileAsync(CONSTANTS.MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME, allMissingParentLookups, false);


    // ---------------------- Internal functions -------------------------------------- //
    async function ___promptToAbort(data: ProcessedData, sObjectName: string): Promise<void> {
      await Common.abortWithPrompt(
        RESOURCES.missingParentLookupsPrompt,
        self.script.promptOnMissingParentObjects,
        RESOURCES.continueTheJob,
        "",
        async () => {
          await self.saveCSVFileAsync(CONSTANTS.MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME, allMissingParentLookups, false);
        },
        sObjectName,
        String(data.missingParentLookups.length),
        CONSTANTS.MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME);
    }

    function ___warn(data: ProcessedData, sObjectName: string) {
      self.logger.warn(RESOURCES.missingParentLookupsPrompt,
        sObjectName,
        String(data.missingParentLookups.length),
        CONSTANTS.MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME);
    }

  }

  /**
   * Returns a task by the given sObject name
   *
   * @param {string} sObjectName
   * @returns
   * @memberof MigrationJob
   */
  getTaskBySObjectName(sObjectName: string) {
    return this.tasks.filter(x => x.sObjectName == sObjectName)[0];
  }

  /**
   * Returns the task by the given field path
   *
   * @param {string} fieldPath
   * @param {Task} [prevTask]
   * @return {{
   *              task: ISFdmuRunCustomAddonTask,
   *              field: string
   *          }}
   * @memberof MigrationJob
   */
  getTaskByFieldPath(fieldPath: string, prevTask?: MigrationJobTask): {
    task: MigrationJobTask,
    field: string
  } {

    let parts = (fieldPath || '').split('.');

    if (parts.length == 0) {
      return null;
    }



    if (!prevTask) {
      // First => by sobject
      let objectTask: Task = this.tasks.find(task => task.sObjectName == parts[0]);
      if (!objectTask) {
        return null;
      } else {
        parts.shift();
        return this.getTaskByFieldPath(parts.join('.'), objectTask);
      }
    }

    // Other => by sfield
    let fieldName = parts.length > 1 ? Common.getFieldNameId(null, parts[0]) : parts[0];
    let fieldDescribe = prevTask.scriptObject.fieldsInQueryMap.get(fieldName);
    if (!fieldDescribe) {
      return null;
    }

    if (fieldDescribe.lookup) {
      let fieldTask = this.tasks.find(task => task.sObjectName == fieldDescribe.referencedObjectType);
      if (!fieldTask) {
        return null;
      }
      parts.shift();
      return this.getTaskByFieldPath(parts.join('.'), fieldTask);
    }

    return {
      task: prevTask,
      field: fieldName
    };

  }

  /**
   * Save csv file from the data of the input array
   *
   * @param {string} fileName It is just a filename (test.csv) not the full path
   * @param {Array<any>} data
   * @returns {Promise<void>}
   * @memberof MigrationJob
   */
  async saveCSVFileAsync(fileName: string, data: Array<any>, alwaysCreateFile: boolean = true): Promise<void> {
    let filePath = path.join(this.script.basePath, fileName);
    this.logger.infoVerbose(RESOURCES.writingCsvFile, filePath);
    await Common.writeCsvFileAsync(filePath, data, alwaysCreateFile);
  }

  /**
   * Save all updated cached csv files
   *
   * @returns {Promise<any>}
   * @memberof MigrationJob
   */
  async saveCachedCsvDataFiles(): Promise<any> {
    let filePaths = [...this.cachedCSVContent.csvDataCacheMap.keys()];
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      if (this.cachedCSVContent.updatedFilenames.has(filePath)) {
        let csvData = this.cachedCSVContent.csvDataCacheMap.get(filePath);
        this.logger.infoVerbose(RESOURCES.writingCsvFile, filePath);
        await Common.writeCsvFileAsync(filePath, [...csvData.values()], true);
      }
    }
  }

  /**
   * Clear cached csv data
   *
   * @memberof MigrationJob
   */
  clearCachedCSVData() {
    this.cachedCSVContent.clear();
  }


  /**
   * Updates target field names
   * for all fields for all fields
   *
   * @memberof MigrationJob
   */
  createSourceTargetMappingFields() {

    let self = this;

    if (this.script.sourceTargetFieldMapping.size > 0) {
      this.script.objects.forEach(object => {
        object.fieldsInQueryMap.forEach(field => {
          let parts = field.name.split('.');
          if (field.isSimpleNotLookup || field.isSimpleReference) {
            // Simple fields, lookups and non-lookups (Account__c, TEST__c)
            let ret = ___mapField(object.name, null, field);
            if (ret.changed) {
              field.m_targetName = ret.fieldName;
            }
          } else if (field.is__r) {
            // __r field:  Account__r.Name__c to Account2__r.Name2__c
            // 1. Account__r => Account2__r //////
            let ret = ___mapField(object.name, null, field);
            if (ret.changed) {
              parts[0] = Common.getFieldName__r(null, ret.fieldName);
            }
            // Name__c => Name2__c //////
            if (!field.isContainsComplex) {
              // => Name2__c
              if (!Common.isComplexField(parts[1])) {
                let ret = ___mapField(field.parentLookupObject.name, parts[1]);
                if (ret.changed) {
                  parts[1] = ret.fieldName;
                }
              }
            } else {
              // Name2__r.$$Object__r.ExternalId__c$Object2__r.ExternalId2__c =>
              //  Name2__r.$$Object2__r.External_Id__c$Object2__r.External_Id2__c /////
              parts = [].concat(parts[0], ___mapComplexField(field.parentLookupObject.name, parts.slice(1).join('.')));
            }
            field.m_targetName = parts.join('.');
          } else if (field.isComplex) {
            // $$ExternalId__c$ExternalId2__c => $$External_Id__c$External_Id2__c
            field.m_targetName = ___mapComplexField(object.name, field.name);
          }
        });
      })
    }

    // --------------------------- Internal functions -------------------------------------
    function ___mapField(objectName: string, fieldName: string, field?: SFieldDescribe): { fieldName: string, changed: boolean } {
      fieldName = Common.getFieldNameId(field, fieldName);
      let objectFieldMapping = self.script.sourceTargetFieldMapping.get(objectName) || new ObjectFieldMapping("", "");
      let changed = false;
      objectFieldMapping.fieldMapping.forEach((value, key) => {
        if (fieldName == key) {
          fieldName = value;
          changed = true;
        }
      });
      return {
        fieldName,
        changed
      }
    }

    function ___mapComplexField(objectName: string, fieldName: string) {

      if (!objectName || !fieldName) {
        return fieldName;
      }

      let parentObject_level1 = self.script.objectsMap.get(objectName);
      if (!parentObject_level1 || !parentObject_level1.useFieldMapping) {
        return fieldName;
      }

      let fieldNames = Common.getFieldFromComplexField(fieldName).split(CONSTANTS.COMPLEX_FIELDS_SEPARATOR);

      fieldNames = fieldNames.map(fieldName => {
        // Object__r.ExternalId__c //////
        let parts = fieldName.split('.');
        // Get "Object__c" from "Object__r"
        let nameId = Common.getFieldNameId(null, parts[0]);
        // Get "Object__c" field description
        let sField = parentObject_level1.targetSObjectDescribe.fieldsMap.get(nameId);
        if (!sField) {
          return parts.join('.');
        }
        if (sField.isSimpleNotLookup || sField.isSimpleReference) {
          // Object__c = simple field (Object__c)
          //            or __r field (Object__r.ExternalId__c)
          let ret = ___mapField(objectName, nameId);
          if (ret.changed) {
            parts[0] = ret.fieldName;
          }
        }
        if (parts.length == 1) {
          // Object__c = simple field (Object__c)
          return parts.join('.');
        }

        // Object__c => Object__r ///////////
        parts[0] = Common.getFieldName__r(null, parts[0]);

        // Object__c = simple reference field (Object__r.ExternalId__c)
        //             or very complex field (Object__r.ExternalId__r.Name__c)
        let parentObject_level2 = self.script.objectsMap.get(sField.referencedObjectType);
        if (!parentObject_level2 || !parentObject_level2.useFieldMapping) {
          return parts.join('.');
        }
        // Get ExternalId__c description from the referenced object
        sField = parentObject_level2.targetSObjectDescribe.fieldsMap.get(parts[1]);
        if (!sField) {
          // Not referenced field => return as is
          return parts.join('.');
        }
        // ExternalId__c => External_Id__c
        let ret = ___mapField(parentObject_level2.name, parts[1]);
        if (ret.changed) {
          parts[1] = ret.fieldName;
        }
        return parts.join('.');
      });

      fieldName = Common.getComplexField(fieldNames.join(CONSTANTS.COMPLEX_FIELDS_SEPARATOR));
      return fieldName;
    }
  }

  /**
   * Creates new dummy job task for the given object
   *
   * @param {string} sObjectName
   * @returns
   * @memberof MigrationJob
   */
  createDummyJobTask(sObjectName: string) {
    let scriptObject: ScriptObject = new ScriptObject(sObjectName);
    scriptObject.script = this.script;
    return new MigrationJobTask({
      job: this,
      scriptObject
    });
  }

  /**
   * Executes addon event related to the current executed object
   *
   * @param {ADDON_EVENTS} event The addon event to execute
   * @returns {Promise<void>}
   * @memberof MigrationJobTask
   */
  async runAddonEventAsync(event: ADDON_EVENTS): Promise<boolean> {
    return await this.script.addonManager.triggerAddonModuleMethodAsync(event);
  }





  // --------------------------- Private members -------------------------------------
  private async _loadValueMappingFileAsync(): Promise<void> {
    let valueMappingFilePath = path.join(this.script.basePath, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
    let csvRows = await Common.readCsvFileAsync(valueMappingFilePath);
    if (csvRows.length > 0) {
      this.logger.infoVerbose(RESOURCES.readingValuesMappingFile, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
      csvRows.forEach(row => {
        if (row["ObjectName"] && row["FieldName"]) {
          let objectName = String(row["ObjectName"]).trim();
          let fieldName = String(row["FieldName"]).trim();
          let scriptObject = this.script.objectsMap.get(objectName);
          if (scriptObject && scriptObject.hasUseValueMapping) {
            let key = objectName + fieldName;
            if (!this.valueMapping.has(key)) {
              this.valueMapping.set(key, new Map<string, string>());
            }
            this.valueMapping.get(key).set(String(row["RawValue"]).trim(), (String(row["Value"]) || "").trim());
          }
        }
      });
    }
  }

  private async _mergeUserGroupCSVfiles(): Promise<void> {
    let filepath1 = path.join(this.script.basePath, "User.csv");
    let filepath2 = path.join(this.script.basePath, "Group.csv");
    let filepath3 = path.join(this.script.basePath, CONSTANTS.USER_AND_GROUP_FILENAME + ".csv");
    await Common.mergeCsvFilesAsync(filepath1, filepath2, filepath3, true, "Id", "Name");
  }

  private _copyCSVFilesToSourceSubDir() {
    this.tasks.forEach(task => {
      if (fs.existsSync(task.data.csvFilename)) {
        fs.copyFileSync(task.data.csvFilename, task.data.sourceCsvFilename);
      }
    });
  }

  private async _validateAndRepairSourceCSVFiles(): Promise<void> {

    let self = this;

    // Analyse csv structure
    for (let index = 0; index < this.tasks.length; index++) {
      const task = this.tasks[index];
      this.csvIssues = this.csvIssues.concat(await task.validateCSV());
    }

    // if csv structure issues were found - prompt to abort the job
    let noAbortPrompt = false;
    if (this.csvIssues.length > 0) {
      await ___promptToAbort();
      noAbortPrompt = true;
    }

    // Check and repair the source csvs
    for (let index = 0; index < this.tasks.length; index++) {
      const task = this.tasks[index];
      this.csvIssues = this.csvIssues.concat(await task.repairCSV(this.cachedCSVContent, true));
    }

    for (let index = 0; index < this.tasks.length; index++) {
      const task = this.tasks[index];
      this.csvIssues = this.csvIssues.concat(await task.repairCSV(this.cachedCSVContent, false));
    }

    // Save the changed source csvs
    await this.saveCachedCsvDataFiles();
    this.logger.infoVerbose(RESOURCES.csvFilesWereUpdated, String(this.cachedCSVContent.updatedFilenames.size));

    // if csv data issues were found - prompt to abort the job
    //  and save the report
    if (this.csvIssues.length > 0) {
      if (!noAbortPrompt) {
        await ___promptToAbort();
      } else {
        await self.saveCSVFileAsync(CONSTANTS.CSV_ISSUES_ERRORS_FILENAME, self.csvIssues);
        this.logger.warn(RESOURCES.incorrectCsvFiles, String(this.csvIssues.length), CONSTANTS.CSV_ISSUES_ERRORS_FILENAME);
      }
    } else {
      this.logger.infoVerbose(RESOURCES.correctCsvFiles);
    }

    async function ___promptToAbort(): Promise<void> {
      await Common.abortWithPrompt(
        RESOURCES.incorrectCsvFiles,
        self.script.promptOnIssuesInCSVFiles,
        RESOURCES.continueTheJob,
        "",
        async () => {
          // Report csv issues
          await self.saveCSVFileAsync(CONSTANTS.CSV_ISSUES_ERRORS_FILENAME, self.csvIssues);
        },
        String(self.csvIssues.length), CONSTANTS.CSV_ISSUES_ERRORS_FILENAME);
    }
  }
}
