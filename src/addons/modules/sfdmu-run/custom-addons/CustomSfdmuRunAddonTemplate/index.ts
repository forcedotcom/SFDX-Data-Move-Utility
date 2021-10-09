import { SYSTEM_MESSAGES } from "../../../../messages/system";
import SfdmuRunAddonModuleBase from "../../../../components/sfdmu-run/sfdmuRunAddonModuleBase";
import IAddonContext from "../../../../components/common/IAddonContext";

/**
 * This test example of Add-On manipulates with the source Json string right before the target update. 
 * It extracts the Json value from the LongText__c, then stores the extracted string into the TEST1__c.
 * 
 * 
 */
export default class CustomSfdmuRunAddonTemlate extends SfdmuRunAddonModuleBase {

    async onExecute(context: IAddonContext, args: any): Promise<void> {

        // Print start message
        this.runtime.writeStartMessage(this);

        // Print some test messages
        this.runtime.writeSystemMessage(this, SYSTEM_MESSAGES.NewLine); // Print new line
        this.runtime.writeMessage('Arguments passed are: ');                // Print string
        this.runtime.writeMessage(args, 'OBJECT');                          // Print object
        this.runtime.writeSystemMessage(this, SYSTEM_MESSAGES.NewLine); // Print new line


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