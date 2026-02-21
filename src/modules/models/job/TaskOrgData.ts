/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DATA_MEDIA_TYPE } from '../../common/Enumerations.js';
import type { LookupIdMapType } from '../script/LookupIdMapType.js';
import type ScriptOrg from '../script/ScriptOrg.js';
import type MigrationJobTask from './MigrationJobTask.js';

/**
 * Runtime org-scoped data for a migration job task.
 */
export default class TaskOrgData {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Parent migration job task.
   */
  public task: MigrationJobTask;

  /**
   * True when this data belongs to the source side.
   */
  public isSource: boolean;

  /**
   * Records keyed by Id.
   */
  public idRecordsMap: Map<string, Record<string, unknown>> = new Map();

  /**
   * External id to record Id map.
   */
  public extIdToRecordIdMap: Map<string, string> = new Map();

  /**
   * External id to record map.
   */
  public extIdToRecordMap: Map<string, Record<string, unknown>> = new Map();

  /**
   * Lookup maps keyed by field name.
   */
  public lookupIdMapsByField: Map<string, LookupIdMapType> = new Map();

  /**
   * Total record count precomputed for this side.
   */
  public totalRecordCount = 0;

  /**
   * Total number of queries executed for this side.
   */
  public queryCount = 0;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new task org data container.
   *
   * @param task - Parent task.
   * @param isSource - True when source data.
   */
  public constructor(task: MigrationJobTask, isSource: boolean) {
    this.task = task;
    this.isSource = isSource;
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns all records currently stored in the id map.
   *
   * @returns Records list.
   */
  public get records(): Array<Record<string, unknown>> {
    return [...this.idRecordsMap.values()];
  }

  /**
   * Returns the media type for this data side.
   *
   * @returns Media type value.
   */
  public get mediaType(): DATA_MEDIA_TYPE {
    return this.org?.media ?? DATA_MEDIA_TYPE.Org;
  }

  /**
   * Returns the external Id to record Id map.
   *
   * @returns External Id map.
   */
  public get extIdRecordsMap(): Map<string, string> {
    return this.extIdToRecordIdMap;
  }

  /**
   * Returns the org instance for this data side.
   *
   * @returns Script org or undefined.
   */
  public get org(): ScriptOrg | undefined {
    return this.isSource ? this.task.job.script.sourceOrg : this.task.job.script.targetOrg;
  }

  /**
   * Returns true when the org is file-based.
   *
   * @returns True when file media.
   */
  public get isFileMedia(): boolean {
    return this.org?.isFileMedia ?? false;
  }

  /**
   * Returns true when the org is an org connection.
   *
   * @returns True when org media.
   */
  public get isOrgMedia(): boolean {
    return this.org?.isOrgMedia ?? false;
  }

  /**
   * Determines if Bulk API query should be used based on record counts.
   *
   * @returns True when Bulk API query should be used.
   */
  public get useBulkQueryApi(): boolean {
    const object = this.task.scriptObject;
    if (object.alwaysUseRestApi) {
      return false;
    }
    if (object.alwaysUseBulkApi) {
      return true;
    }

    const threshold = Number(this.task.job.script.queryBulkApiThreshold);
    if (!Number.isFinite(threshold)) {
      return false;
    }
    return this.totalRecordCount >= threshold;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Resets all runtime maps for a fresh preflight pass.
   */
  public reset(): void {
    this.idRecordsMap.clear();
    this.extIdToRecordIdMap.clear();
    this.extIdToRecordMap.clear();
    this.lookupIdMapsByField.clear();
    this.totalRecordCount = 0;
    this.queryCount = 0;
  }

  /**
   * Returns a lookup map for the provided field name.
   *
   * @param fieldName - Lookup field name.
   * @returns Lookup map instance.
   */
  public ensureLookupMap(fieldName: string): LookupIdMapType {
    const existing = this.lookupIdMapsByField.get(fieldName);
    if (existing) {
      return existing;
    }
    const created: LookupIdMapType = new Map();
    this.lookupIdMapsByField.set(fieldName, created);
    return created;
  }
}
