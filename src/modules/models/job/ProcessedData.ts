/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { __IS_PROCESSED_FIELD_NAME } from '../../constants/Constants.js';
import type SFieldDescribe from '../sf/SFieldDescribe.js';

type ProcessedRecordMapType = Map<Record<string, unknown>, Record<string, unknown>>;

/**
 * Container for processed record data per task.
 */
export default class ProcessedData {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Indicates the task is processing person account flows.
   */
  public processPersonAccounts = false;

  /**
   * Map of cloned records to their source records.
   */
  public clonedToSourceMap: ProcessedRecordMapType = new Map();

  /**
   * Fields participating in update processing.
   */
  public fields: SFieldDescribe[] = [];

  /**
   * Records to be updated in the target.
   */
  public recordsToUpdate: Array<Record<string, unknown>> = [];

  /**
   * Records to be inserted into the target.
   */
  public recordsToInsert: Array<Record<string, unknown>> = [];

  /**
   * Missing parent lookup records captured during processing.
   */
  public missingParentLookups: Array<Record<string, unknown>> = [];

  /**
   * Map of inserted source records to their target counterparts.
   */
  public insertedRecordsSourceToTargetMap: ProcessedRecordMapType = new Map();

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns lookup id fields from the processed field list.
   *
   * @returns Lookup id fields.
   */
  public get lookupIdFields(): SFieldDescribe[] {
    return this.fields.filter((field) => field.isSimpleReference);
  }

  /**
   * Returns field API names used during processing.
   *
   * @returns Field API names.
   */
  public get fieldNames(): string[] {
    return this.fields.map((field) => field.nameId);
  }

  /**
   * Returns the amount of non-processed records.
   *
   * @returns Non-processed record count.
   */
  public get nonProcessedRecordsAmount(): number {
    return [...this.clonedToSourceMap.values()].filter((record) => record[__IS_PROCESSED_FIELD_NAME] === false).length;
  }
}
