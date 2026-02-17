/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Query } from 'soql-parser-js';
import { Common } from '../../../../common/Common.js';
import { ADDON_EVENTS, OPERATION } from '../../../../common/Enumerations.js';
import { __ID_FIELD_NAME } from '../../../../constants/Constants.js';
import CjsDependencyAdapters from '../../../../dependencies/CjsDependencyAdapters.js';
import ScriptObject from '../../../../models/script/ScriptObject.js';
import type {
  ISFdmuRunCustomAddonJob,
  ISFdmuRunCustomAddonTask,
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
  ISfdmuRunCustomAddonScript,
  ISfdmuRunCustomAddonScriptObject,
  ISfdmuRunCustomAddonSFieldDescribe,
} from '../../../../../../custom-addon-sdk/interfaces/index.js';
import AddonResult from '../../../models/AddonResult.js';

type RecordType = Record<string, unknown>;

type FieldArgsType = {
  alias: string;
  sourceObject: string;
  sourceField: string;
  includeLookupFields?: string[];
  includeFields?: string[];
  isConstant?: boolean;
  lookupExpression?: string;
  lookupSource?: 'source' | 'target';
  valueSource?: 'source' | 'target';
};

type TransformationArgsType = {
  targetObject: string;
  targetField: string;
  formula: string;
  includeLookupFields?: string[];
  expressions?: string[];
};

type RecordsTransformArgsType = {
  fields: FieldArgsType[];
  transformations: TransformationArgsType[];
};

type FieldRuntimeType = FieldArgsType & {
  sourceTask: ISFdmuRunCustomAddonTask;
  lookupFieldMap: Map<string, string[]>;
  constantValue?: unknown;
  targetToSourceRecordMap: Map<RecordType, RecordType>;
};

type TransformationRuntimeType = TransformationArgsType & {
  targetTask: ISFdmuRunCustomAddonTask;
  lookupFieldMap: Map<string, string[]>;
};

const SUPPORTED_EVENTS: ADDON_EVENTS[] = [ADDON_EVENTS.onDataRetrieved, ADDON_EVENTS.onBeforeUpdate];

const { parseQuery, composeQuery } = CjsDependencyAdapters.getSoqlParser();

/**
 * Core records transformation add-on.
 */
export default class RecordsTransform implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Execution context assigned by the add-on manager.
   */
  public context: ISfdmuRunCustomAddonContext;

  /**
   * Runtime instance provided by the add-on manager.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new records transformation add-on.
   *
   * @param runtime - Runtime instance provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
    this.context = {
      eventName: '',
      moduleDisplayName: '',
      objectName: '',
      objectDisplayName: '',
      description: '',
    };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Updates script queries with transformation fields.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public onInit(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    const normalizedArgs = this._normalizeArgs(args);
    if (!normalizedArgs) {
      return Promise.resolve(new AddonResult());
    }

    const script = this.runtime.getScript();
    const objectEntries = script.getAllObjects().map((object) => ({
      object,
      parsedQuery: parseQuery(object.query ?? ''),
    }));

    normalizedArgs.fields.forEach((field) => {
      const entry = this._ensureObjectEntry(script, objectEntries, field.sourceObject);
      Common.addOrRemoveQueryFields(entry.parsedQuery, [field.sourceField]);

      const includeFields = field.includeFields ?? field.includeLookupFields ?? [];
      includeFields.forEach((includeField) => {
        const parts = includeField.split('.');
        if (parts.length === 1) {
          Common.addOrRemoveQueryFields(entry.parsedQuery, [includeField]);
          return;
        }
        const targetEntry = this._ensureObjectEntry(script, objectEntries, parts[0]);
        const fieldName = parts.slice(1).join('.');
        Common.addOrRemoveQueryFields(targetEntry.parsedQuery, [fieldName]);
      });
    });

    normalizedArgs.transformations.forEach((transformation) => {
      const entry = this._ensureObjectEntry(script, objectEntries, transformation.targetObject);
      Common.addOrRemoveQueryFields(entry.parsedQuery, [transformation.targetField]);

      const includeFields = transformation.includeLookupFields ?? [];
      includeFields.forEach((includeField) => {
        const parts = includeField.split('.');
        if (parts.length === 1) {
          Common.addOrRemoveQueryFields(entry.parsedQuery, [includeField]);
          return;
        }
        const targetEntry = this._ensureObjectEntry(script, objectEntries, parts[0]);
        const fieldName = parts.slice(1).join('.');
        Common.addOrRemoveQueryFields(targetEntry.parsedQuery, [fieldName]);
      });

      const scriptObject = script.getAllObjects().find((object) => object.name === transformation.targetObject);
      if (scriptObject && !scriptObject.extraFieldsToUpdate.includes(transformation.targetField)) {
        scriptObject.extraFieldsToUpdate = scriptObject.extraFieldsToUpdate.concat(transformation.targetField);
      }
    });

    objectEntries.forEach((entry) => {
      const { object, parsedQuery } = entry;
      object.query = composeQuery(parsedQuery);
    });

    void context;
    return Promise.resolve(new AddonResult());
  }

  /**
   * Executes the records transform logic.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    this.runtime.logAddonExecutionStarted(this);

    if (!this.runtime.validateSupportedEvents(this, SUPPORTED_EVENTS)) {
      this.runtime.logFormattedWarning(
        this,
        'General_EventNotSupported',
        context.eventName,
        context.moduleDisplayName,
        SUPPORTED_EVENTS.join()
      );
      this.runtime.logAddonExecutionFinished(this);
      return Promise.resolve(new AddonResult());
    }

    const normalizedArgs = this._normalizeArgs(args);
    if (!normalizedArgs) {
      this.runtime.logFormattedWarning(this, 'General_ArgumentsCannotBeParsed');
      this.runtime.logAddonExecutionFinished(this);
      return Promise.resolve(new AddonResult());
    }

    const job = this.runtime.getScript().job;
    if (!job) {
      this.runtime.logFormattedWarning(this, 'General_AddOnRuntimeError', context.moduleDisplayName);
      this.runtime.logAddonExecutionFinished(this);
      return Promise.resolve(new AddonResult());
    }

    this.runtime.logFormattedInfo(this, 'General_CheckingArgs');

    const fieldsMap = this._buildFieldsMap(job, normalizedArgs.fields);
    const transformsMap = this._buildTransformationsMap(job, normalizedArgs.transformations);

    this.runtime.logFormattedInfo(this, 'RecordsTransform_Tranforming');

    let totalTransformed = 0;

    const resolvedEvent = this._resolveEvent(context.eventName);
    transformsMap.forEach((transformation) => {
      const transformedRecords = this._getTaskRecords(transformation.targetTask, resolvedEvent);
      totalTransformed += transformedRecords.length;

      transformedRecords.forEach((transformedRecord) => {
        const formula: Record<string, unknown> = {};
        const formulaValues = formula;
        const recordId = String(transformedRecord[__ID_FIELD_NAME] ?? '');
        const sourceRecord = transformation.targetTask.sourceData.idRecordsMap.get(recordId);
        const targetRecord = sourceRecord
          ? transformation.targetTask.sourceToTargetRecordMap.get(sourceRecord)
          : undefined;

        fieldsMap.forEach((field) => {
          const sourceRecords = field.sourceTask.sourceData.records;
          const targetRecords = field.sourceTask.targetData.records;

          if (transformation.targetObject === field.sourceObject || field.lookupExpression) {
            const mappedTarget = sourceRecord ? field.sourceTask.sourceToTargetRecordMap.get(sourceRecord) : undefined;
            const tempSourceRecord = field.valueSource !== 'target' ? sourceRecord : mappedTarget;
            this._setFormulaValue(formula, tempSourceRecord, targetRecord, field, sourceRecords, targetRecords);
          } else {
            const sourceIdFields = transformation.lookupFieldMap.get(field.sourceObject);
            if (sourceIdFields) {
              sourceIdFields.forEach((sourceIdField) => {
                const targetId = transformedRecord[sourceIdField];
                if (typeof targetId !== 'string') {
                  return;
                }
                const lookupTarget = field.sourceTask.targetData.idRecordsMap.get(targetId);
                const lookupSource = lookupTarget ? field.targetToSourceRecordMap.get(lookupTarget) : undefined;
                const tempSourceRecord = field.valueSource !== 'target' ? lookupSource : lookupTarget;
                this._setFormulaValue(formula, tempSourceRecord, targetRecord, field, sourceRecords, targetRecords);
              });
            } else {
              const targetIdFields = field.lookupFieldMap.get(transformation.targetObject);
              if (targetIdFields && targetRecord) {
                const targetId = String(targetRecord['Id'] ?? '');
                if (targetId) {
                  for (const candidateTarget of targetRecords) {
                    if (this._hasLookupMatch(candidateTarget, targetIdFields, targetId)) {
                      const lookupSource = field.targetToSourceRecordMap.get(candidateTarget);
                      const tempSourceRecord = field.valueSource !== 'target' ? lookupSource : candidateTarget;
                      this._setFormulaValue(
                        formula,
                        tempSourceRecord,
                        targetRecord,
                        field,
                        sourceRecords,
                        targetRecords
                      );
                      break;
                    }
                  }
                }
              }
            }
          }

          formulaValues[field.alias] = formulaValues[field.alias] ?? null;
        });

        if (Array.isArray(transformation.expressions)) {
          transformation.expressions.forEach((expression) => {
            // eslint-disable-next-line no-eval
            eval(expression);
          });
        }

        // eslint-disable-next-line no-eval
        const recordToUpdate = transformedRecord;
        // eslint-disable-next-line no-eval
        recordToUpdate[transformation.targetField] = eval(transformation.formula);
      });
    });

    this.runtime.logFormattedInfo(this, 'RecordsTransform_TotallyTranformed', String(totalTransformed));
    this.runtime.logAddonExecutionFinished(this);

    return Promise.resolve(new AddonResult());
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Ensures an object entry exists for the given object name.
   *
   * @param script - Script instance.
   * @param entries - Existing entries.
   * @param objectName - Object name to locate.
   * @returns Entry for the object.
   */
  private _ensureObjectEntry(
    script: ISfdmuRunCustomAddonScript,
    entries: Array<{ object: ISfdmuRunCustomAddonScriptObject; parsedQuery: Query }>,
    objectName: string
  ): { object: ISfdmuRunCustomAddonScriptObject; parsedQuery: Query } {
    void this;
    const existing = entries.find((entry) => entry.object.name === objectName);
    if (existing) {
      return existing;
    }
    const newObject = new ScriptObject(objectName);
    newObject.operation = OPERATION.Readonly;
    newObject.isAutoAdded = true;
    script.addObjectToFirstSet(newObject);
    const parsedQuery = parseQuery(newObject.query ?? '');
    const created = {
      object: newObject,
      parsedQuery,
    };
    entries.push(created);
    return created;
  }

  /**
   * Normalizes raw add-on arguments.
   *
   * @param args - Raw arguments.
   * @returns Normalized args or undefined.
   */
  private _normalizeArgs(args: Record<string, unknown>): RecordsTransformArgsType | undefined {
    const candidate = args as Partial<RecordsTransformArgsType>;
    if (!Array.isArray(candidate.fields) || !Array.isArray(candidate.transformations)) {
      return undefined;
    }
    return {
      fields: candidate.fields.filter((field): field is FieldArgsType => this._isFieldArgs(field)),
      transformations: candidate.transformations.filter((item): item is TransformationArgsType =>
        this._isTransformationArgs(item)
      ),
    };
  }

  /**
   * Builds the field mapping for transformations.
   *
   * @param job - Migration job.
   * @param fields - Field args.
   * @returns Field map keyed by alias.
   */
  private _buildFieldsMap(job: ISFdmuRunCustomAddonJob, fields: FieldArgsType[]): Map<string, FieldRuntimeType> {
    const fieldsMap = new Map<string, FieldRuntimeType>();

    this.runtime.logFormattedInfo(this, 'RecordsTransform_CreatingMappingScheme');

    fields.forEach((field) => {
      const task = job.tasks.find((item) => item.sObjectName === field.sourceObject);
      if (!task) {
        this.runtime.logFormattedInfo(
          this,
          'RecordsTransform_SourceTaskNotFound',
          field.sourceObject,
          field.sourceField
        );
        return;
      }

      const sourceRecords = task.sourceData.records;
      if (sourceRecords.length > 0 && typeof sourceRecords[0][field.sourceField] === 'undefined') {
        this.runtime.logFormattedInfo(
          this,
          'RecordsTransform_SourceFieldNotFound',
          field.sourceObject,
          field.sourceField
        );
        return;
      }

      if (!task.data.fieldsInQueryMap.has(field.sourceField)) {
        this.runtime.logFormattedInfo(
          this,
          'RecordsTransform_SourceFieldNotFound',
          field.sourceObject,
          field.sourceField
        );
        return;
      }

      const runtimeField: FieldRuntimeType = {
        ...field,
        sourceTask: task,
        lookupFieldMap: this._getLookups(task.data.fieldsInQueryMap),
        targetToSourceRecordMap: new Map(),
      };
      task.sourceToTargetRecordMap.forEach((targetRecord, sourceRecord) => {
        runtimeField.targetToSourceRecordMap.set(targetRecord, sourceRecord);
      });
      fieldsMap.set(field.alias, runtimeField);
    });

    return fieldsMap;
  }

  /**
   * Builds the transformations map.
   *
   * @param job - Migration job.
   * @param transformations - Transform args.
   * @returns Transformations map keyed by field name.
   */
  private _buildTransformationsMap(
    job: ISFdmuRunCustomAddonJob,
    transformations: TransformationArgsType[]
  ): Map<string, TransformationRuntimeType> {
    const transformsMap = new Map<string, TransformationRuntimeType>();

    transformations.forEach((transformation) => {
      const task = job.tasks.find((item) => item.sObjectName === transformation.targetObject);
      if (!task) {
        this.runtime.logFormattedInfo(
          this,
          'RecordsTransform_TargetFieldNotFound',
          transformation.targetObject,
          transformation.targetField
        );
        return;
      }

      transformsMap.set(transformation.targetField, {
        ...transformation,
        targetTask: task,
        lookupFieldMap: this._getLookups(task.data.fieldsInQueryMap),
      });
    });

    return transformsMap;
  }

  /**
   * Returns lookup mapping based on fields in query.
   *
   * @param fieldsInQueryMap - Map of fields.
   * @returns Lookup map.
   */
  private _getLookups(
    fieldsInQueryMap: ReadonlyMap<string, ISfdmuRunCustomAddonSFieldDescribe>
  ): Map<string, string[]> {
    void this;
    const lookupMap = new Map<string, string[]>();
    fieldsInQueryMap.forEach((field) => {
      if (field.referencedObjectType) {
        lookupMap.set(field.referencedObjectType, (lookupMap.get(field.referencedObjectType) ?? []).concat(field.name));
      }
    });
    return lookupMap;
  }

  /**
   * Sets a formula value for a field.
   *
   * @param formula - Formula values object.
   * @param source - Source record.
   * @param target - Target record.
   * @param field - Field configuration.
   * @param sourceRecords - Source records.
   * @param targetRecords - Target records.
   */
  private _setFormulaValue(
    formula: Record<string, unknown>,
    sourceRecord: RecordType | undefined,
    targetRecord: RecordType | undefined,
    field: FieldRuntimeType,
    sourceRecords: RecordType[],
    targetRecords: RecordType[]
  ): void {
    void this;
    const safeSource = sourceRecord ?? {};
    const safeTarget = targetRecord ?? {};
    const formulaValues = formula;
    if (field.isConstant && typeof field.constantValue !== 'undefined') {
      formulaValues[field.alias] = field.constantValue;
      return;
    }

    let value: unknown;
    if (!field.lookupExpression) {
      value = safeSource[field.sourceField];
    } else {
      const lookupExpression = field.lookupExpression;
      if (field.lookupSource !== 'target') {
        const updateWithRecord = sourceRecords.find((candidate) => {
          const source = candidate;
          const target = safeTarget;
          void source;
          void target;
          // eslint-disable-next-line no-eval
          return eval(lookupExpression);
        });
        value = updateWithRecord?.[field.sourceField];
      } else {
        const updateWithRecord = targetRecords.find((candidate) => {
          const source = candidate;
          const target = safeTarget;
          void source;
          void target;
          // eslint-disable-next-line no-eval
          return eval(lookupExpression);
        });
        value = updateWithRecord?.[field.sourceField];
      }
    }
    if (field.isConstant) {
      const currentField = field;
      currentField.constantValue = value;
    }
    formulaValues[field.alias] = value;
  }

  /**
   * Returns records for the task based on event type.
   *
   * @param task - Migration task.
   * @param eventName - Current event.
   * @returns Records to transform.
   */
  private _getTaskRecords(task: ISFdmuRunCustomAddonTask, eventName: ADDON_EVENTS): RecordType[] {
    void this;
    if (eventName === ADDON_EVENTS.onBeforeUpdate) {
      return task.processedData.recordsToInsert.concat(task.processedData.recordsToUpdate);
    }
    return task.sourceData.records;
  }

  /**
   * Checks if a record has any lookup field pointing to target id.
   *
   * @param record - Record to inspect.
   * @param fieldNames - Lookup field names.
   * @param targetId - Target id to match.
   * @returns True when match found.
   */
  private _hasLookupMatch(record: RecordType, fieldNames: string[], targetId: string): boolean {
    void this;
    return fieldNames.some((fieldName) => record[fieldName] === targetId);
  }

  /**
   * Determines if raw value looks like field args.
   *
   * @param value - Candidate value.
   * @returns True when matching.
   */
  private _isFieldArgs(value: unknown): value is FieldArgsType {
    if (!this._isRecord(value)) {
      return false;
    }
    return (
      typeof value.alias === 'string' && typeof value.sourceObject === 'string' && typeof value.sourceField === 'string'
    );
  }

  /**
   * Determines if raw value looks like transformation args.
   *
   * @param value - Candidate value.
   * @returns True when matching.
   */
  private _isTransformationArgs(value: unknown): value is TransformationArgsType {
    if (!this._isRecord(value)) {
      return false;
    }
    return (
      typeof value.targetObject === 'string' &&
      typeof value.targetField === 'string' &&
      typeof value.formula === 'string'
    );
  }

  /**
   * Checks if a value is a plain record.
   *
   * @param value - Candidate value.
   * @returns True when record-like.
   */
  private _isRecord(value: unknown): value is Record<string, unknown> {
    void this;
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Resolves a string event name into the enum value.
   *
   * @param eventName - Raw event name.
   * @returns Resolved add-on event.
   */
  private _resolveEvent(eventName: string): ADDON_EVENTS {
    void this;
    const match = (Object.values(ADDON_EVENTS) as string[]).find((event) => event === eventName);
    return match ? (match as ADDON_EVENTS) : ADDON_EVENTS.none;
  }
}
