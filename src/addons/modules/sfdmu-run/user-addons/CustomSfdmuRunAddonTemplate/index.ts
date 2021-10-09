import { STANDARD_MESSAGES } from "../../../../messages/standard";

import IPluginExecutionContext from "../../../../components/addon_components/interfaces/IPluginExecutionContext";
import SfdmuRunAddonModuleBase from "../../../../components/addon_components/classes/sfdmu/sfdmuRunAddonModuleBase";

/**
 * This test example of AddOn manipulates with the source Json string right before the target update. 
 * It extracts the Json value from the LongText__c, then stores the extracted string into the TEST1__c.
 * 
 * 
 */
export default class CustomSfdmuRunAddonTemlate extends SfdmuRunAddonModuleBase {

    get displayName(): string {
        return "user:" + this.constructor.name;
    }

    async onExecute(context: IPluginExecutionContext, args: any): Promise<void> {

        // Print start message
        this.runtime.writeStartMessage(this);

        // Print some test messages
        this.runtime.writeStandardMessage(this, STANDARD_MESSAGES.NewLine); // Print new line
        this.runtime.writeMessage('Arguments passed are: ');                // Print string
        this.runtime.writeMessage(args, 'OBJECT');                          // Print object
        this.runtime.writeStandardMessage(this, STANDARD_MESSAGES.NewLine); // Print new line


        // Get the currently running task
        const task = this.runtime.getPluginTask(this);

        // Make manipuation with the records
        [].concat(task.processedData.recordsToInsert, task.processedData.recordsToUpdate).forEach(record => {
            const jsonString = String(record['LongText__c']) || '{}';
            if (jsonString) {
                const obj = JSON.parse(jsonString);
                record['TEST1__c'] = obj['TEST1__c'];
            }
            if (args) {
                Object.keys(args).forEach(function (prop) {
                    record[prop] = args[prop];
                });
            }
        });

        // Print finish message
        this.runtime.writeFinishMessage(this);

    }

}