/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Query } from 'soql-parser-js';
import { Common } from '../../common/Common.js';
import {
  CSV_SOURCE_FILE_SUFFIX,
  CSV_TARGET_FILE_SUFFIX,
  POLYMORPHIC_FIELD_PARSER_PLACEHOLDER,
  REFERENCE_FIELD_OBJECT_SEPARATOR,
} from '../../constants/Constants.js';
import CjsDependencyAdapters from '../../dependencies/CjsDependencyAdapters.js';
import type SFieldDescribe from '../sf/SFieldDescribe.js';
import type MigrationJobTask from './MigrationJobTask.js';

const { parseQuery } = CjsDependencyAdapters.getSoqlParser();

/**
 * Runtime task-scoped data derived during preflight.
 */
export default class TaskData {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Parent migration job task.
   */
  public task: MigrationJobTask;

  /**
   * Fields present in the source query.
   */
  public fieldsInQueryMap: Map<string, SFieldDescribe> = new Map();

  /**
   * Fields eligible for update operations.
   */
  public fieldsToUpdateMap: Map<string, SFieldDescribe> = new Map();

  /**
   * Source query string.
   */
  public sourceQuery = '';

  /**
   * Target query string.
   */
  public targetQuery = '';

  /**
   * Delete query string.
   */
  public deleteQuery = '';

  /**
   * Parsed target query.
   */
  public parsedTargetQuery?: Query;

  /**
   * Source CSV filename for the task.
   */
  public sourceCsvFilename = '';

  /**
   * Target CSV filename for the task.
   */
  public targetCsvFilename = '';

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new task data container.
   *
   * @param task - Parent task.
   */
  public constructor(task: MigrationJobTask) {
    this.task = task;
    this.refreshFromScriptObject();
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns field names included in the source query.
   *
   * @returns Field names list.
   */
  public get fieldsInQuery(): string[] {
    return [...this.fieldsInQueryMap.keys()];
  }

  /**
   * Returns field describes included in the query.
   *
   * @returns Field describe list.
   */
  public get sFieldsInQuery(): SFieldDescribe[] {
    return [...this.fieldsInQueryMap.values()];
  }

  /**
   * Returns field names eligible for updates.
   *
   * @returns Field names list.
   */
  public get fieldsToUpdate(): string[] {
    return [...this.fieldsToUpdateMap.keys()];
  }

  /**
   * Returns field describes eligible for updates.
   *
   * @returns Field describe list.
   */
  public get sFieldsToUpdate(): SFieldDescribe[] {
    return [...this.fieldsToUpdateMap.values()];
  }

  /**
   * Returns the previous tasks based on execution order.
   *
   * @returns Previous tasks.
   */
  public get prevTasks(): MigrationJobTask[] {
    const tasks = this.task.job.tasks;
    const index = tasks.indexOf(this.task);
    return tasks.filter((task, taskIndex) => taskIndex < index);
  }

  /**
   * Returns the next tasks based on execution order.
   *
   * @returns Next tasks.
   */
  public get nextTasks(): MigrationJobTask[] {
    const tasks = this.task.job.tasks;
    const index = tasks.indexOf(this.task);
    return tasks.filter((task, taskIndex) => taskIndex > index);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Refreshes task data from the bound script object.
   */
  public refreshFromScriptObject(): void {
    const scriptObject = this.task.scriptObject;
    const script = this.task.job.script;
    this.fieldsInQueryMap = scriptObject.fieldsInQueryMap;
    this.fieldsToUpdateMap = scriptObject.fieldsToUpdateMap;
    this.sourceQuery = scriptObject.query;
    this.targetQuery = scriptObject.targetQuery;
    this.deleteQuery = scriptObject.deleteQuery;
    this.parsedTargetQuery = parseQuery(this._sanitizeQueryForParser(this.targetQuery));
    this.sourceCsvFilename = Common.getCSVFilename(
      script.sourceDirectoryPath,
      scriptObject.name,
      CSV_SOURCE_FILE_SUFFIX
    );
    const targetObjectName = script.targetOrg?.isFileMedia ? scriptObject.targetObjectName : scriptObject.name;
    this.targetCsvFilename = Common.getCSVFilename(
      script.targetDirectoryPath,
      targetObjectName,
      CSV_TARGET_FILE_SUFFIX
    );
  }

  /**
   * Sanitizes a query to keep the SOQL parser compatible with polymorphic markers.
   *
   * @param query - Raw query.
   * @returns Sanitized query.
   */
  private _sanitizeQueryForParser(query: string): string {
    void this;
    if (!query || !query.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)) {
      return query;
    }
    return query.replaceAll(REFERENCE_FIELD_OBJECT_SEPARATOR, POLYMORPHIC_FIELD_PARSER_PLACEHOLDER);
  }
}
