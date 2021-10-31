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
import { composeQuery, parseQuery } from "soql-parser-js";
import { Common } from "../../../../modules/components/common_components/common";
import { SFieldDescribe } from "../../../../modules/models";




interface ITransformation {

    // Original -----
    targetObject: string
    targetField: string,
    formula: string,
    includeLookupFields: Array<string>,
    expressions: Array<string>,

    // Runtime ------
    targetTask: SfdmuRunAddonTask,
    targetSFieldDescribe: SFieldDescribe,
    lookupFieldMap: Map<string, string[]> // referenced object => child id fields
}

interface IField {

    // Original -----
    alias: string,
    sourceObject: string,
    sourceField: string,
    includeLookupFields: Array<string>,

    // Runtime ------
    sourceTask: SfdmuRunAddonTask,
    sourceSFieldDescribe: SFieldDescribe,
    lookupFieldMap: Map<string, string[]> // referenced object => child id fields
}

interface IOnExecuteArguments {
    fields: Array<IField>;
    transformations: Array<ITransformation>;
}

const CONST = {
    SUPPORTED_EVENTS: [
        ADDON_EVENTS.onDataRetrieved.toString(),
        ADDON_EVENTS.onAfter.toString()
    ]
};

export default class RecordsTransform extends SfdmuRunAddonModule {

    async onExecute(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

        this.runtime.logAddonExecutionStarted(this);

        // Verify current event
        if (CONST.SUPPORTED_EVENTS.indexOf(context.eventName) < 0) {
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
                                sourceSFieldDescribe: task.fieldsInQueryMap.get(field.sourceField),
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
                        targetSFieldDescribe: task.fieldsInQueryMap.get(transformation.targetField),
                        lookupFieldMap: __getLookups(task.fieldsInQueryMap)
                    }));
                }
            });


            this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_Tranforming);

            // Execute
            transformsMap.forEach((transformation: ITransformation) => {

                let targetRecords = transformation.targetTask.sourceTaskData.records;

                targetRecords.forEach(targetRecord => {

                    let formula = {};

                    // Generate formula properties for further eval() on the targetRecord
                    fieldsMap.forEach((field: IField) => {

                        if (transformation.targetObject == field.sourceObject) {
                            // The same object => direct transformation:
                            //      source field => target field on the same targetRecord
                            formula[field.alias] = targetRecord[field.sourceField];
                        } else {
                            // Different object => lookup based transformation
                            let sourceIdFields = transformation.lookupFieldMap.get(field.sourceObject);
                            if (sourceIdFields) {
                                // Target => source
                                sourceIdFields.forEach(sourceIdField => {
                                    let sourceId = targetRecord[sourceIdField];
                                    let sourceRecord = field.sourceTask.sourceTaskData.idRecordsMap.get(sourceId);
                                    if (sourceRecord) {
                                        formula[field.alias] = sourceRecord[field.sourceField];
                                    }
                                });
                            } else {
                                // Source => target
                                let targetIdFields = field.lookupFieldMap.get(transformation.targetObject);
                                if (targetIdFields) {
                                    let targetId = targetRecord["Id"];
                                    if (targetId) {
                                        // Find all the source records which is pointing to the current targetId
                                        let sourceRecords = field.sourceTask.sourceTaskData.records;
                                        for (let index = 0; index < sourceRecords.length; index++) {
                                            const sourceRecord = sourceRecords[index];
                                            if (Object.keys(sourceRecord).some(fieldName => {
                                                return sourceRecord[fieldName] == targetId;
                                            })) {
                                                formula[field.alias] = sourceRecord[field.sourceField];
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
                    targetRecord[transformation.targetField] = eval(transformation.formula);

                });

            });

            this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.RecordsTransform_AppliedValueMapping);

            // Map values
            transformsMap.forEach((transformation: ITransformation) => {
                let targetRecords = transformation.targetTask.sourceTaskData.records;
                transformation.targetTask.mapRecords(targetRecords);
            });


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
    }

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
            if (object) {
                Common.addOrRemoveQueryFields(object.parsedQuery, [field.sourceField]);

                if (field.includeLookupFields) {
                    field.includeLookupFields.forEach(field => {
                        if (field) {
                            let parts = field.split('.');
                            if (parts.length == 1) {
                                Common.addOrRemoveQueryFields(object.parsedQuery, [field]);
                            } else {
                                let obj = objects.find(ob => ob.parsedQuery.sObject == parts[0]);
                                Common.addOrRemoveQueryFields(obj.parsedQuery, [parts[1]]);
                            }
                        }
                    });
                }
            }
        });

        args.transformations.forEach(transformation => {
            let object = objects.find(ob => ob.parsedQuery.sObject == transformation.targetObject);
            if (object) {

                Common.addOrRemoveQueryFields(object.parsedQuery, [transformation.targetField]);

                if (transformation.includeLookupFields) {
                    transformation.includeLookupFields.forEach(field => {
                        if (field) {
                            let parts = field.split('.');
                            if (parts.length == 1) {
                                Common.addOrRemoveQueryFields(object.parsedQuery, [field]);
                            } else {
                                let obj = objects.find(ob => ob.parsedQuery.sObject == parts[0]);
                                Common.addOrRemoveQueryFields(obj.parsedQuery, [parts[1]]);
                            }
                        }
                    });
                }
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
    }

}