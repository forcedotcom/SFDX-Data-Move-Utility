/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SFieldDescribeType } from '../common/SFieldDescribeType.js';
import type ScriptObject from '../script/ScriptObject.js';
import { Common } from '../../common/Common.js';
import {
  __R_FIELD_MAPPING,
  COMPLEX_FIELDS_SEPARATOR,
  SIMPLE_REFERENCE_FIELDS,
  TEXTUAL_FIELD_TYPES,
} from '../../constants/Constants.js';

/**
 * Description of a Salesforce field.
 */
export default class SFieldDescribe implements SFieldDescribeType {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Object API name for the field.
   */
  public objectName = '';

  /**
   * Field API name.
   */
  public name = '';

  /**
   * Field data type.
   */
  public type = 'dynamic';

  /**
   * Field label.
   */
  public label = '';

  /**
   * True when field is updateable.
   */
  public updateable = false;

  /**
   * True when field is createable.
   */
  public creatable = false;

  /**
   * True when field is cascade delete.
   */
  public cascadeDelete = false;

  /**
   * True when field is auto-number.
   */
  public autoNumber = false;

  /**
   * True when field is unique.
   */
  public unique = false;

  /**
   * True when field is marked as External ID in metadata.
   */
  public isExternalIdInMetadata = false;

  /**
   * True when field is name field.
   */
  public nameField = false;

  /**
   * True when field is custom.
   */
  public custom = false;

  /**
   * True when field is calculated.
   */
  public calculated = false;

  /**
   * True when field is a lookup.
   */
  public lookup = false;

  /**
   * Referenced object type for lookup fields.
   */
  public referencedObjectType = '';

  /**
   * Reference target list for lookup fields.
   */
  public referenceTo: string[] = [];

  /**
   * Polymorphic referenced object type.
   */
  public polymorphicReferenceObjectType = '';

  /**
   * Field length.
   */
  public length = 0;

  /**
   * Original referenced object type for polymorphic correction.
   */
  public originalReferencedObjectType = '';

  /**
   * True when field metadata is described by the org.
   */
  public isDescribed = false;

  /**
   * Script object owning this field.
   */
  public scriptObject?: ScriptObject;

  /**
   * Parent lookup object for reference fields.
   */
  public parentLookupObject?: ScriptObject;

  /**
   * Child relationship fields referencing this external id.
   */
  // eslint-disable-next-line camelcase
  public child__rSFields: SFieldDescribe[] = [];

  /**
   * Relationship field metadata for __r fields.
   */
  public __rSField?: SFieldDescribe;

  /**
   * Id field metadata backing an __r field.
   */
  public idSField?: SFieldDescribe;

  /**
   * True when field is defined as polymorphic in metadata.
   */
  public isPolymorphicFieldDefinition = false;

  /**
   * True when field is explicitly marked polymorphic in query.
   */
  public isPolymorphicField = false;

  /**
   * Mapped field name used in target org.
   */
  public mappedName = '';

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new field description instance.
   *
   * @param init - Initial values.
   */
  public constructor(init?: Partial<SFieldDescribe>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns the mapped target field name.
   *
   * @returns Target field name.
   */
  public get targetName(): string {
    return this.mappedName || this.name;
  }

  /**
   * Returns true when the field is mapped.
   *
   * @returns True when mapped.
   */
  public get isMapped(): boolean {
    return Boolean(this.mappedName) && this.mappedName !== this.name;
  }

  /**
   * Returns true when field is readonly.
   *
   * @returns True when readonly.
   */
  public get readonly(): boolean {
    return !(this.creatable && !this.isFormula && !this.autoNumber);
  }

  /**
   * Returns true when field is a person account field.
   *
   * @returns True when person field.
   */
  public get person(): boolean {
    const nameId = this.nameId;
    return nameId.endsWith('__pc') || (nameId.startsWith('Person') && !this.custom);
  }

  /**
   * Returns true when field is standard.
   *
   * @returns True when standard.
   */
  public get standard(): boolean {
    return !this.custom;
  }

  /**
   * Returns true when field is a formula field.
   *
   * @returns True when formula.
   */
  public get isFormula(): boolean {
    return this.calculated;
  }

  /**
   * Returns true when field is master-detail.
   *
   * @returns True when master-detail.
   */
  public get isMasterDetail(): boolean {
    return this.lookup && (!this.updateable || this.cascadeDelete) && this.isSimpleReference;
  }

  /**
   * Returns true when field is boolean.
   *
   * @returns True when boolean.
   */
  public get isBoolean(): boolean {
    return this.type === 'boolean';
  }

  /**
   * Returns true when field is textual.
   *
   * @returns True when textual.
   */
  public get isTextual(): boolean {
    return TEXTUAL_FIELD_TYPES.includes(this.type);
  }

  /**
   * Returns true when field is complex.
   *
   * @returns True when complex.
   */
  public get isComplex(): boolean {
    return Common.isComplexField(this.name);
  }

  /**
   * Returns true when field contains complex parts.
   *
   * @returns True when complex content exists.
   */
  public get isContainsComplex(): boolean {
    return Common.isContainsComplexField(this.name);
  }

  /**
   * Returns true when field is an __r field.
   *
   * @returns True when __r.
   */
  // eslint-disable-next-line camelcase
  public get is__r(): boolean {
    return Boolean(this.idSField);
  }

  /**
   * Returns true when field is complex or __r.
   *
   * @returns True when complex or __r.
   */
  // eslint-disable-next-line camelcase
  public get isComplexOr__r(): boolean {
    return Common.isComplexOr__rField(this.name);
  }

  /**
   * Returns true when field is simple and not a lookup.
   *
   * @returns True when simple non-lookup.
   */
  public get isSimpleNotLookup(): boolean {
    return this.isSimple && !this.lookup;
  }

  /**
   * Returns true when field is simple (not complex/__r).
   *
   * @returns True when simple.
   */
  public get isSimple(): boolean {
    return !this.isComplexOr__r;
  }

  /**
   * Returns true when field is a simple reference.
   *
   * @returns True when simple reference.
   */
  public get isSimpleReference(): boolean {
    const simpleReferenceFields = SIMPLE_REFERENCE_FIELDS.get(this.objectName) ?? [];
    return simpleReferenceFields.includes(this.name) || (this.lookup && !this.is__r);
  }

  /**
   * Returns true when field is a self-reference.
   *
   * @returns True when self-reference.
   */
  public get isSimpleSelfReference(): boolean {
    return this.isSimpleReference && this.referencedObjectType === this.objectName;
  }

  /**
   * Returns true when field is the external id of the script object.
   *
   * @returns True when external id field.
   */
  public get isExternalIdField(): boolean {
    return this.scriptObject?.externalId === this.name;
  }

  /**
   * Returns true when field is the original external id of the script object.
   *
   * @returns True when original external id field.
   */
  public get isOriginalExternalIdField(): boolean {
    return this.scriptObject?.originalExternalId === this.name;
  }

  /**
   * Returns relationship field name (Account__c -> Account__r).
   *
   * @returns Relationship field name.
   */
  // eslint-disable-next-line camelcase
  public get name__r(): string {
    return Common.getFieldName__r(this);
  }

  /**
   * Returns field API name without __r suffix.
   *
   * @returns Field API name.
   */
  public get nameId(): string {
    return Common.getFieldNameId(this);
  }

  /**
   * Returns relationship field for current external id.
   *
   * @returns Relationship field name.
   */
  // eslint-disable-next-line camelcase
  public get fullName__r(): string {
    if (!this.lookup || !this.parentLookupObject) {
      return this.name__r;
    }
    const name = `${this.name__r}.${Common.getComplexField(this.parentLookupObject.externalId)}`;
    const specialField = __R_FIELD_MAPPING.get(this.objectName)?.[name];
    return specialField ?? name;
  }

  /**
   * Returns relationship field for original external id.
   *
   * @returns Relationship field name.
   */
  // eslint-disable-next-line camelcase
  public get fullOriginalName__r(): string {
    if (!this.lookup || !this.parentLookupObject) {
      return this.name__r;
    }
    const name = `${this.name__r}.${Common.getComplexField(this.parentLookupObject.originalExternalId)}`;
    const specialField = __R_FIELD_MAPPING.get(this.objectName)?.[name];
    return specialField ?? name;
  }

  /**
   * Returns relationship field for Id lookups.
   *
   * @returns Relationship field name.
   */
  // eslint-disable-next-line camelcase
  public get fullIdName__r(): string {
    if (!this.lookup) {
      return this.name__r;
    }
    return `${this.name__r}.Id`;
  }

  /**
   * Returns expanded __r names for complex fields.
   *
   * @returns List of __r field names.
   */
  // eslint-disable-next-line camelcase
  public get __rNames(): string[] {
    if (!this.is__r) {
      return [];
    }
    const parts = this.name.split('.');
    if (parts.length <= 1) {
      return [this.name];
    }
    return Common.flattenArrays(
      parts.slice(1).map((part) => {
        const fields = Common.getFieldFromComplexField(part);
        return fields.split(COMPLEX_FIELDS_SEPARATOR).map((field) => `${parts[0]}.${field}`);
      })
    );
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Builds a TYPEOF query segment for polymorphic relationship fields.
   *
   * @param relationshipName - Relationship segment (e.g. What).
   * @param fieldName - Field name to select (e.g. Name).
   * @returns TYPEOF query segment or original field path.
   */
  public getPolymorphicQueryField(relationshipName: string, fieldName: string): string {
    if (this.isPolymorphicField && this.is__r && relationshipName && fieldName) {
      return `TYPEOF ${relationshipName} WHEN ${this.polymorphicReferenceObjectType} THEN ${fieldName} END`;
    }
    if (relationshipName && fieldName) {
      return `${relationshipName}.${fieldName}`;
    }
    return relationshipName || fieldName;
  }

  /**
   * Creates a dynamic field placeholder for missing metadata.
   *
   * @param key - Field API name.
   * @returns Updated field description.
   */
  public dynamic(key: string): SFieldDescribe {
    this.creatable = false;
    this.name = key;
    this.label = key;
    this.updateable = false;
    this.type = 'dynamic';
    return this;
  }

  /**
   * Creates a complex field placeholder.
   *
   * @param key - Field API name.
   * @returns Updated field description.
   */
  public complex(key: string): SFieldDescribe {
    this.name = key;
    this.label = key;
    this.calculated = true;
    this.isDescribed = true;
    return this;
  }
}
