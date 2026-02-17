/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../common/Common.js';
import { COMPLEX_FIELDS_QUERY_PREFIX, REFERENCE_FIELD_OBJECT_SEPARATOR } from '../constants/Constants.js';
import type ScriptMappingItem from '../models/script/ScriptMappingItem.js';
import type ScriptObject from '../models/script/ScriptObject.js';
import ObjectMapping from './ObjectMapping.js';

/**
 * Resolves source/target object and field mappings.
 */
export default class MappingResolver {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Source-to-target object mapping registry.
   */
  private _sourceObjectMap = new Map<string, ObjectMapping>();

  /**
   * Target-to-source object name index.
   */
  private _targetObjectIndex = new Map<string, string>();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a mapping resolver.
   *
   * @param mappings - Optional mappings to preload.
   */
  public constructor(mappings: ObjectMapping[] = []) {
    mappings.forEach((mapping) => this.addObjectMapping(mapping));
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Adds mappings from script object definitions.
   *
   * @param objects - Script objects to analyze.
   */
  public addScriptObjects(objects: ScriptObject[]): void {
    objects.forEach((object) => {
      if (!object.useFieldMapping) {
        return;
      }
      const objectMapping = this._buildObjectMapping(object.name, object.fieldMapping);
      if (objectMapping.hasChanges()) {
        this.addObjectMapping(objectMapping);
        this._logObjectMapping(objectMapping);
      }
    });
  }

  /**
   * Adds an object mapping to the registry.
   *
   * @param mapping - Mapping to add.
   */
  public addObjectMapping(mapping: ObjectMapping): void {
    this._sourceObjectMap.set(mapping.sourceObjectName, mapping);
    this._targetObjectIndex.set(mapping.targetObjectName, mapping.sourceObjectName);
  }

  /**
   * Returns true when there is at least one mapping.
   *
   * @returns True when mappings exist.
   */
  public hasChanges(): boolean {
    return this._sourceObjectMap.size > 0;
  }

  /**
   * Returns a copy of the source object mappings.
   *
   * @returns Mapping registry.
   */
  public getObjectMappings(): Map<string, ObjectMapping> {
    return new Map(this._sourceObjectMap);
  }

  /**
   * Finds mapping by source object name.
   *
   * @param sourceObjectName - Source object API name.
   * @returns Mapping or undefined.
   */
  public getObjectMappingBySource(sourceObjectName: string): ObjectMapping | undefined {
    return this._sourceObjectMap.get(sourceObjectName);
  }

  /**
   * Finds mapping by target object name.
   *
   * @param targetObjectName - Target object API name.
   * @returns Mapping or undefined.
   */
  public getObjectMappingByTarget(targetObjectName: string): ObjectMapping | undefined {
    const sourceObjectName = this._targetObjectIndex.get(targetObjectName);
    if (!sourceObjectName) {
      return undefined;
    }
    return this._sourceObjectMap.get(sourceObjectName);
  }

  /**
   * Maps a source object name to the target object name.
   *
   * @param sourceObjectName - Source object API name.
   * @returns Target object API name.
   */
  public mapObjectNameToTarget(sourceObjectName: string): string {
    return this._sourceObjectMap.get(sourceObjectName)?.targetObjectName ?? sourceObjectName;
  }

  /**
   * Maps a target object name to the source object name.
   *
   * @param targetObjectName - Target object API name.
   * @returns Source object API name.
   */
  public mapObjectNameToSource(targetObjectName: string): string {
    return this._targetObjectIndex.get(targetObjectName) ?? targetObjectName;
  }

  /**
   * Maps a field name from source to target for the given object.
   *
   * @param sourceObjectName - Source object API name.
   * @param sourceFieldName - Source field API name.
   * @returns Target field API name.
   */
  public mapFieldNameToTarget(sourceObjectName: string, sourceFieldName: string): string {
    const mapping = this.getObjectMappingBySource(sourceObjectName);
    if (mapping?.fieldMapping.sourceToTarget.has(sourceFieldName)) {
      return mapping.fieldMapping.getTargetField(sourceFieldName);
    }

    const polymorphic = this._splitPolymorphicFieldName(sourceFieldName);
    if (polymorphic) {
      const mappedBaseField =
        mapping?.fieldMapping.getTargetField(polymorphic.baseFieldName) ?? polymorphic.baseFieldName;
      const mappedObjectName = this.mapObjectNameToTarget(polymorphic.referencedObjectName);
      return `${mappedBaseField}${REFERENCE_FIELD_OBJECT_SEPARATOR}${mappedObjectName}`;
    }

    return mapping?.fieldMapping.getTargetField(sourceFieldName) ?? sourceFieldName;
  }

  /**
   * Maps a field name from target to source for the given object.
   *
   * @param targetObjectName - Target object API name.
   * @param targetFieldName - Target field API name.
   * @returns Source field API name.
   */
  public mapFieldNameToSource(targetObjectName: string, targetFieldName: string): string {
    const mapping = this.getObjectMappingByTarget(targetObjectName);
    if (mapping?.fieldMapping.targetToSource.has(targetFieldName)) {
      return mapping.fieldMapping.getSourceField(targetFieldName);
    }

    const polymorphic = this._splitPolymorphicFieldName(targetFieldName);
    if (polymorphic) {
      const mappedBaseField =
        mapping?.fieldMapping.getSourceField(polymorphic.baseFieldName) ?? polymorphic.baseFieldName;
      const mappedObjectName = this.mapObjectNameToSource(polymorphic.referencedObjectName);
      return `${mappedBaseField}${REFERENCE_FIELD_OBJECT_SEPARATOR}${mappedObjectName}`;
    }

    return mapping?.fieldMapping.getSourceField(targetFieldName) ?? targetFieldName;
  }

  /**
   * Maps record fields from source to target object names.
   *
   * @param sourceObjectName - Source object API name.
   * @param record - Source record.
   * @returns Target record with mapped fields.
   */
  public mapRecordToTarget(sourceObjectName: string, record: Record<string, unknown>): Record<string, unknown> {
    const mapping = this.getObjectMappingBySource(sourceObjectName);
    if (!mapping) {
      return { ...record };
    }
    return this._mapRecord(record, (fieldName) => this.mapFieldNameToTarget(sourceObjectName, fieldName));
  }

  /**
   * Maps record fields from target to source object names.
   *
   * @param targetObjectName - Target object API name.
   * @param record - Target record.
   * @returns Source record with mapped fields.
   */
  public mapRecordToSource(targetObjectName: string, record: Record<string, unknown>): Record<string, unknown> {
    const mapping = this.getObjectMappingByTarget(targetObjectName);
    if (!mapping) {
      return { ...record };
    }
    return this._mapRecord(record, (fieldName) => this.mapFieldNameToSource(targetObjectName, fieldName));
  }

  /**
   * Maps an array of records from source to target.
   *
   * @param sourceObjectName - Source object API name.
   * @param records - Source records.
   * @returns Target records with mapped fields.
   */
  public mapRecordsToTarget(
    sourceObjectName: string,
    records: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    return records.map((record) => this.mapRecordToTarget(sourceObjectName, record));
  }

  /**
   * Maps an array of records from target to source.
   *
   * @param targetObjectName - Target object API name.
   * @param records - Target records.
   * @returns Source records with mapped fields.
   */
  public mapRecordsToSource(
    targetObjectName: string,
    records: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    return records.map((record) => this.mapRecordToSource(targetObjectName, record));
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Maps record fields using the provided field mapper.
   *
   * @param record - Source record.
   * @param mapFieldName - Field name mapper.
   * @returns Mapped record.
   */
  private _mapRecord(
    record: Record<string, unknown>,
    mapFieldName: (fieldName: string) => string
  ): Record<string, unknown> {
    void this;
    const mapped: Record<string, unknown> = {};
    Object.entries(record).forEach(([fieldName, value]) => {
      mapped[mapFieldName(fieldName)] = value;
    });
    return mapped;
  }

  /**
   * Creates an object mapping from script field mappings.
   *
   * @param sourceObjectName - Source object API name.
   * @param fieldMappings - Script-defined field mappings.
   * @returns Object mapping instance.
   */
  private _buildObjectMapping(sourceObjectName: string, fieldMappings: ScriptMappingItem[]): ObjectMapping {
    void this;
    const objectMapping = new ObjectMapping(sourceObjectName);
    fieldMappings.forEach((mapping) => {
      if (mapping.targetObject) {
        objectMapping.targetObjectName = mapping.targetObject;
      }
      if (mapping.sourceField && mapping.targetField) {
        objectMapping.fieldMapping.addMapping(mapping.sourceField, mapping.targetField);
        if (!mapping.sourceField.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)) {
          const sourceRelation = Common.getFieldName__r(undefined, mapping.sourceField);
          const targetRelation = Common.getFieldName__r(undefined, mapping.targetField);
          if (sourceRelation && targetRelation && sourceRelation !== mapping.sourceField) {
            objectMapping.fieldMapping.addMapping(sourceRelation, targetRelation);
          }
        }
      }
    });
    return objectMapping;
  }

  /**
   * Logs object and field mappings for diagnostics.
   *
   * @param mapping - Object mapping to log.
   */
  private _logObjectMapping(mapping: ObjectMapping): void {
    void this;
    if (!mapping.hasChanges()) {
      return;
    }
    const sourceObjectName = mapping.sourceObjectName;
    const targetObjectName = mapping.targetObjectName || sourceObjectName;
    Common.logger.verboseFile(`{${sourceObjectName}} Field mapping target object: ${targetObjectName}`);
    mapping.fieldMapping.sourceToTarget.forEach((targetField, sourceField) => {
      Common.logger.verboseFile(`{${sourceObjectName}.${sourceField}} Mapped to target field ${targetField}.`);
    });
  }

  /**
   * Splits a polymorphic field declaration into base field and referenced object.
   *
   * @param fieldName - Field name to inspect.
   * @returns Parsed polymorphic field parts when applicable.
   */
  private _splitPolymorphicFieldName(
    fieldName: string
  ): { baseFieldName: string; referencedObjectName: string } | undefined {
    void this;
    if (!fieldName || fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
      return undefined;
    }
    const separatorIndex = fieldName.indexOf(REFERENCE_FIELD_OBJECT_SEPARATOR);
    if (separatorIndex <= 0 || separatorIndex === fieldName.length - 1) {
      return undefined;
    }
    const baseFieldName = fieldName.slice(0, separatorIndex);
    const referencedObjectName = fieldName.slice(separatorIndex + 1);
    if (!baseFieldName || !referencedObjectName) {
      return undefined;
    }
    return { baseFieldName, referencedObjectName };
  }
}
