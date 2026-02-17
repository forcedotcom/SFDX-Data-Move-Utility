/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import MappingResolver from './MappingResolver.js';

/**
 * Adapter that exposes legacy source names to addons.
 */
export default class AddonMappingAdapter {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Mapping resolver used for conversions.
   */
  private _mappingResolver: MappingResolver;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new addon mapping adapter.
   *
   * @param mappingResolver - Mapping resolver instance.
   */
  public constructor(mappingResolver: MappingResolver) {
    this._mappingResolver = mappingResolver;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Maps an internal object name to the addon-visible source name.
   *
   * @param internalObjectName - Internal target object API name.
   * @returns Source object API name.
   */
  public mapObjectNameToAddon(internalObjectName: string): string {
    return this._mappingResolver.mapObjectNameToSource(internalObjectName);
  }

  /**
   * Maps an addon-visible source object name to the internal target name.
   *
   * @param externalObjectName - Source object API name.
   * @returns Target object API name.
   */
  public mapObjectNameFromAddon(externalObjectName: string): string {
    return this._mappingResolver.mapObjectNameToTarget(externalObjectName);
  }

  /**
   * Maps an internal field name to the addon-visible source name.
   *
   * @param internalObjectName - Internal target object API name.
   * @param internalFieldName - Internal target field API name.
   * @returns Source field API name.
   */
  public mapFieldNameToAddon(internalObjectName: string, internalFieldName: string): string {
    return this._mappingResolver.mapFieldNameToSource(internalObjectName, internalFieldName);
  }

  /**
   * Maps an addon-visible field name to the internal target name.
   *
   * @param externalObjectName - Source object API name.
   * @param externalFieldName - Source field API name.
   * @returns Target field API name.
   */
  public mapFieldNameFromAddon(externalObjectName: string, externalFieldName: string): string {
    return this._mappingResolver.mapFieldNameToTarget(externalObjectName, externalFieldName);
  }

  /**
   * Maps an internal record to addon-visible source field names.
   *
   * @param internalObjectName - Internal target object API name.
   * @param record - Internal record.
   * @returns Record with source field names.
   */
  public mapRecordToAddon(internalObjectName: string, record: Record<string, unknown>): Record<string, unknown> {
    return this._mappingResolver.mapRecordToSource(internalObjectName, record);
  }

  /**
   * Maps an addon record to internal target field names.
   *
   * @param externalObjectName - Source object API name.
   * @param record - Source record.
   * @returns Record with target field names.
   */
  public mapRecordFromAddon(externalObjectName: string, record: Record<string, unknown>): Record<string, unknown> {
    return this._mappingResolver.mapRecordToTarget(externalObjectName, record);
  }

  /**
   * Maps internal records to addon-visible source field names.
   *
   * @param internalObjectName - Internal target object API name.
   * @param records - Internal records.
   * @returns Records with source field names.
   */
  public mapRecordsToAddon(
    internalObjectName: string,
    records: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    return this._mappingResolver.mapRecordsToSource(internalObjectName, records);
  }

  /**
   * Maps addon records to internal target field names.
   *
   * @param externalObjectName - Source object API name.
   * @param records - Source records.
   * @returns Records with target field names.
   */
  public mapRecordsFromAddon(
    externalObjectName: string,
    records: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    return this._mappingResolver.mapRecordsToTarget(externalObjectName, records);
  }
}
