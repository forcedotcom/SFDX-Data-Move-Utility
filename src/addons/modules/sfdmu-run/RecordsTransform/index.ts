/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import SfdmuRunAddonModule from "../../../components/sfdmu-run/sfdmuRunAddonModule";
import AddonResult from "../../../components/common/addonResult";
import IAddonContext from "../../../components/common/IAddonContext";
import { ADDON_EVENTS } from "../../../../modules/components/common_components/enumerations";
import { SFDMU_RUN_ADDON_MESSAGES } from "../../../messages/sfdmuRunAddonMessages";
import SfdmuRunAddonTask from "../../../components/sfdmu-run/sfdmuRunAddonTask";
import { composeQuery, parseQuery, Query } from "soql-parser-js";
import { Common } from "../../../../modules/components/common_components/common";
import { SFieldDescribe } from "../../../../modules/models";
import { OPERATION } from "../custom-addons/package";
import ISfdmuRunScript from "../../../components/sfdmu-run/ISfdmuRunScript";
import ISfdmuRunScriptObject from "../../../components/sfdmu-run/ISfdmuRunScriptObject";


interface ITransformation {

  // Original -----
  targetObject: string
  targetField: string,
  formula: string,
  includeLookupFields: Array<string>,
  expressions: Array<string>,

  // Runtime ------
  targetTask: SfdmuRunAddonTask,
  lookupFieldMap: Map<string, string[]> // referenced object => child id fields
}

interface IField {

  // Original -----
  alias: string,
  sourceObject: string,
  sourceField: string,
  includeLookupFields: Array<string>, // deprecated
  includeFields: Array<string>, // same as includeLookupFields
  isConstant: boolean;
  lookupExpression: string;
  lookupSource: 'source' | 'target';

  // Runtime ------
  sourceTask: SfdmuRunAddonTask,
  lookupFieldMap: Map<string, string[]>, // referenced object => child id fields
  constantValue: any;
}

interface IOnExecuteArguments {
  fields: Array<IField>;
  transformations: Array<ITransformation>;
}

const CONST = {
  SUPPORTED_EVENTS: [
    ADDON_EVENTS.onDataRetrieved,
    ADDON_EVENTS.onBeforeUpdate
  ]
};

export default class RecordsTransform extends SfdmuRunAddonModule {

  async onInit(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

    let script = this.runtime.getScript();

    // Add all extra fields used in the all transformation to the original query string
    let objects = script.objects.map(object => {
      return {
        object,
        parsedQuery: parseQuery(object.query)
      };
    });

    args.fields.forEach(field => {
      let object = objects.find(ob => ob.parsedQuery.sObject == field.sourceObject);

      if (!object) {
        object = __addScriptObject(script, {
          objectName: field.sourceObject,
          operation: OPERATION.Readonly
        });
        objects.push(object);
      }

      Common.addOrRemoveQueryFields(object.parsedQuery, [field.sourceField]);

      const includeFields = field.includeFields || field.includeLookupFields;

      if (includeFields) {
        includeFields.forEach(field => {
          if (field) {
            let parts = field.split('.');
            if (parts.length == 1) {
              Common.addOrRemoveQueryFields(object.parsedQuery, [field]);
            } else {
              let obj = objects.find(ob => ob.parsedQuery.sObject == parts[0]);
              if (!obj) {
                obj = __addScriptObject(script, {
                  objectName: parts[0],
                  operation: OPERATION.Readonly
                });
                objects.push(obj);
              }
              Common.addOrRemoveQueryFields(obj.parsedQuery, [parts.splice(1).join('.')]);
            }
          }
        });
      }

    });

    args.transformations.forEach(transformation => {
      let object = objects.find(ob => ob.parsedQuery.sObject == transformation.targetObject);

      if (!object) {
        object = __addScriptObject(script, {
          objectName: transformation.targetObject,
          operation: OPERATION.Readonly
        });
        objects.push(object);
      }

      Common.addOrRemoveQueryFields(object.parsedQuery, [transformation.targetField]);

      if (transformation.includeLookupFields) {
        transformation.includeLookupFields.forEach(field => {
          if (field) {
            let parts = field.split('.');
            if (parts.length == 1) {
              Common.addOrRemoveQueryFields(object.parsedQuery, [field]);
            } else {
              let obj = objects.find(ob => ob.parsedQuery.sObject == parts[0]);
              if (!obj) {
                obj = __addScriptObject(script, {
                  objectName: parts[0],
                  operation: OPERATION.Readonly
                });
                objects.push(obj);
              }
              Common.addOrRemoveQueryFields(obj.parsedQuery, [parts[1]]);
            }
          }
        });
      }

      let scriptObject = script.objects.find(object => object.name == transformation.targetObject);
      if (scriptObject) {
        if (scriptObject.extraFieldsToUpdate.indexOf(transformation.targetField) < 0) {
          scriptObject.extraFieldsToUpdate = scriptObject.extraFieldsToUpdate.concat(transformation.targetField);
        }
      }
    });

    objects.forEach(object => {
      object.object.query = composeQuery(object.parsedQuery);
    });

    return null;



    // ----------------- Helpers ---------------------------- //
    function __addScriptObject(script: ISfdmuRunScript, object: ISfdmuRunScriptObject): {
      object: ISfdmuRunScriptObject,
      parsedQuery: Query
    } {
      let newObject = script.addScriptObject({
        objectName: object.objectName,
        operation: OPERATION.Readonly
      });
      return {
        object: newObject,
        parsedQuery: parseQuery(newObject.query)
      };
    }
  }


  async onExecute(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

    const self = this;

    this.runtime.logAddonExecutionStarted(this);

    // Verify current event
    if (!this.runtime.validateSupportedEvents(this, CONST.SUPPORTED_EVENTS)) {
      this.runtime.logFormattedWarning(this,
        SFDMU_RUN_ADDON_MESSAGES.General_EventNotSupported,
        context.eventName,
        context.moduleDisplayName,
        CONST.SUPPORTED_EVENTS.join());
      return null;
    }


    const job = this.runtime.pluginJob;
    const fieldsMap: Map<string, IField> = new Map<string, IField>();
    const transformsMap: Map<string, ITransformation> = new Map<string, ITransformation>();

    this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.General_CheckingArgs);

    // Verify module args
    if (!args) {
      this.runtime.logFormattedWarning(this,
        SFDMU_RUN_ADDON_MESSAGES.General_ArgumentsCannotBeParsed);
      return null;
    }


    this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_CreatingMappingScheme);

    // Create fields map
    try {
      args.fields.forEach(field => {
        let task = job.tasks.find(task => task.sObjectName == field.sourceObject);
        if (!task) {
          this.runtime.logFormattedInfo(this,
            SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_SourceTaskNotFound,
            field.sourceField,
            field.sourceObject);
        } else {
          if (task.sourceTaskData.records.length
            && !task.sourceTaskData.records[0].hasOwnProperty(field.sourceField)) {
            this.runtime.logFormattedInfo(this,
              SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_SourceFieldNotFound,
              field.sourceField,
              field.sourceObject);
          } else {
            if (task.fieldsInQuery.indexOf(field.sourceField) < 0) {
              this.runtime.logFormattedInfo(this,
                SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_SourceFieldNotFound,
                field.sourceField,
                field.sourceObject);
            } else {
              fieldsMap.set(field.alias, Object.assign(field, {
                sourceTask: task,
                lookupFieldMap: __getLookups(task.fieldsInQueryMap)
              }));
            }

          }
        }
      });


      // Create transformations map
      args.transformations.forEach(transformation => {
        let task = job.tasks.find(task => task.sObjectName == transformation.targetObject);
        if (!task) {
          this.runtime.logFormattedInfo(this,
            SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_TargetFieldNotFound,
            transformation.targetField,
            transformation.targetObject);
        } else {
          transformsMap.set(transformation.targetField, Object.assign(transformation, {
            targetTask: task,
            lookupFieldMap: __getLookups(task.fieldsInQueryMap)
          }));
        }
      });

      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_Tranforming);
      let totallyTransformed = 0;

      // Execute
      transformsMap.forEach((transformation: ITransformation) => {

        // ===> Account records
        let transformedRecords = ___getTaskRecords(transformation.targetTask);
        totallyTransformed += transformedRecords.length;

        transformedRecords.forEach(transformedRecord => {

          let formula = {};

          // Generate formula properties for further eval() on the targetRecord
          fieldsMap.forEach((field: IField) => {

            let sourceRecords = field.sourceTask.sourceTaskData.records;
            let targetRecords = field.sourceTask.targetTaskData.records;

            if (transformation.targetObject == field.sourceObject) {
              // Same object => direct transformation (formula[accountCategory] = Account.Category__c)
              __setFormulaValue(formula, transformedRecord, transformedRecord, field, sourceRecords, targetRecords);
            } else {
              // Different object => lookup based transformation
              let sourceIdFields = transformation.lookupFieldMap.get(field.sourceObject);// [Account.Country__c]
              if (sourceIdFields) {
                // Target ==> Source: selecting the source record using the target lookup to the source record (Account.Country__c => Country Id)
                sourceIdFields.forEach(sourceIdField => {
                  let sourceId = transformedRecord[sourceIdField];
                  let sourceRecord = field.sourceTask.sourceTaskData.idRecordsMap.get(sourceId);
                  __setFormulaValue(formula, sourceRecord, transformedRecord, field, sourceRecords, targetRecords);
                });
              } else {
                let targetIdFields = field.lookupFieldMap.get(transformation.targetObject); // [Country__c.BusinessAccount__c]
                if (targetIdFields) {
                  // Source ==> Target: selecting the source record using source lookup to the target record (Country__c.BusinessAccount__c => Account.Id => Country Id
                  let targetId = transformedRecord["Id"];
                  if (targetId) {
                    // Find all the source records which is pointing to the current targetId
                    for (let index = 0; index < sourceRecords.length; index++) {
                      const sourceRecord = sourceRecords[index];
                      if (Object.keys(sourceRecord).some(fieldName => {
                        return sourceRecord[fieldName] == targetId;
                      })) {
                        __setFormulaValue(formula, sourceRecord, transformedRecord, field, sourceRecords, targetRecords);
                        break;
                      }
                    }
                  }
                }
              }
            }

            formula[field.alias] = formula[field.alias] || null;
          });

          // Expresisons
          if (transformation.expressions) {
            transformation.expressions.forEach(expression => eval(expression));
          }

          // Evaluate
          transformedRecord[transformation.targetField] = eval(transformation.formula);

        });

      });

      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_TotallyTranformed, String(totallyTransformed));

    } catch (e) {
      this.runtime.logFormattedWarning(this,
        SFDMU_RUN_ADDON_MESSAGES.General_AddOnRuntimeError,
        context.moduleDisplayName);
      return null;
    }

    this.runtime.logAddonExecutionFinished(this);

    return null;


    // ----------------------- local functions ------------------------- //
    function __getLookups(fieldsInQueryMap: Map<string, SFieldDescribe>): Map<string, string[]> {
      const m: Map<string, string[]> = new Map<string, string[]>();
      fieldsInQueryMap.forEach(field => {
        if (field.referencedObjectType) {
          m.set(field.referencedObjectType, (m.get(field.referencedObjectType) || []).concat(field.name));
        }
      });
      return m;
    }

    function __setFormulaValue(formula: any, source: any, target: any,
      field: IField,
      sourceRecords: any[],
      targetRecords: any[]) {
      source = source || {};
      target = target || {};
      if (field.isConstant && field.constantValue) {
        formula[field.alias] = field.constantValue;
        return;
      }
      let value: any;
      if (!field.lookupExpression) {
        value = source[field.sourceField];
      } else {
        const updateWithRecord = field.lookupSource != 'target'
          ? sourceRecords.find(source => eval(field.lookupExpression))
          : targetRecords.find(target => eval(field.lookupExpression));
        value = updateWithRecord && updateWithRecord[field.sourceField];
      }
      formula[field.alias] = field.constantValue = value;
    }

    function ___getTaskRecords(task: SfdmuRunAddonTask): any[] {
      return self.context.eventName == ADDON_EVENTS.onBeforeUpdate
        ? task.processedData.recordsToInsert.concat(
          task.processedData.recordsToUpdate
        ) : task.sourceTaskData.records;
    }
  }


}
