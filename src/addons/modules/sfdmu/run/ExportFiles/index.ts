/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */

import { AddonModuleBase, IPluginExecutionContext, OPERATION } from "../../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginRuntime } from "../../../../components/shared_packages/sfdmuRunAddonComponents";

interface IOnExecuteArguments {
    deleteOldData: boolean;
    operation: OPERATION;
}

export default class ExportFiles extends AddonModuleBase {

    get displayName(): string {
        return "core:ExportFiles";
    }

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        super();
        this.runtime = runtime;
    }
   
    async onExecute(context: IPluginExecutionContext, args: IOnExecuteArguments): Promise<void> {

        this.runtime.writeStartMessage(this);

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];

        if (!task) {
            return;
        }

        // Delete old target Files ---------------------
        // ---------------------------------------------
        if (args.deleteOldData || args.operation == OPERATION.Delete) {


        }

        if (args.operation == OPERATION.Delete){
            return;
        }


        // Export new Files ----------------------------
        // ---------------------------------------------
        // Query for the ContentDocumentLink records associated
        
        // TEST:
        // let records = await this.runtime.queryAsync(false, "SELECT Id, Name FROM Account LIMIT 1");
        // let ids = records.map(record => record["Id"]);
        // let query = this.runtime.createFieldInQueries(["Id", "Name"], "Id", "Account", ids);
        // query[0] = query[0].replace("IN", "NOT IN") + " LIMIT 1";
        // records = records.concat(await this.runtime.queryMultiAsync(false, query));
        // let output = await this.runtime.updateTargetRecordsAsync("Account", OPERATION.Delete, records);
        // console.log(output);

        // let records2 = [{           
        //     Origin: "Phone"
        // }];

        // let output2 = await this.runtime.updateTargetRecordsAsync("Case", OPERATION.Insert, records2);




        this.runtime.writeFinishMessage(this);



    }

}