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




interface ITransformation {
    targetObject: string
    targetField: string,
    formula: string
}

interface IField {

    // Original -----
    alias: string,
    sourceObject: string,
    sourceField: string,

    // Runtime ------
    sourceTask: SfdmuRunAddonTask,
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


        // Verify event type
        if (CONST.SUPPORTED_EVENTS.indexOf(context.eventName) < 0) {
            this.runtime.logFormattedWarning(this,
                SFDMU_RUN_ADDON_MESSAGES.General_EventNotSupported,
                context.eventName,
                context.moduleDisplayName,
                CONST.SUPPORTED_EVENTS.join());
            return null;
        }

        const job = this.runtime.pluginJob;
        const task = this.runtime.getPluginTask(this);
        const fieldsMap: Map<string, IField> = new Map<string, IField>();
        // [Transformation formula] =>  [Field data]
        const tramsformMap = new Map<string, IField>();

        // Verify args
        if (!args) {
            this.runtime.logFormattedWarning(this,
                SFDMU_RUN_ADDON_MESSAGES.General_ArgumentsCannotBeParsed);
            return null;
        }

        // Create mapping
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
                                sourceTask: task
                            }));
                        }

                    }
                }
            });
        } catch (e) {
            this.runtime.logFormattedWarning(this,
                SFDMU_RUN_ADDON_MESSAGES.General_ArgumentsCannotBeParsed);
            return null;
        }





        // Create transformMap
        console.log(job, task, fieldsMap, tramsformMap);





        return null;
    }

    async onInit(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

        let script = this.runtime.getScript();

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
            }
        });

        args.transformations.forEach(tramsformation => {
            let object = objects.find(ob => ob.parsedQuery.sObject == tramsformation.targetObject);
            if (object) {
                Common.addOrRemoveQueryFields(object.parsedQuery, [tramsformation.targetField]);
            }
        });

        objects.forEach(object => {
            object.object.query = composeQuery(object.parsedQuery);
        });

        return null;
    }


    // ---------------------- Helpers ------------------------------- //


}