import { MigrationJobTask } from "..";
import { IPluginTask, IPluginTaskData } from "./addonSharedPackage";
import PluginTaskData from "./pluginTaskData";

export default  class PluginTask implements IPluginTask {
    
    #migrationJobTask : MigrationJobTask;
    #sourceTaskData : IPluginTaskData;
    #targetTaskData : IPluginTaskData;

    constructor(migrationJobTask : MigrationJobTask){
        this.#migrationJobTask = migrationJobTask;
        this.#sourceTaskData = new PluginTaskData(migrationJobTask.sourceData);
        this.#targetTaskData = new PluginTaskData(migrationJobTask.targetData);
    }

    get sourceToTargetRecordMap(): Map<any, any> {
        return this.#migrationJobTask.data.sourceToTargetRecordMap;
    }
    get sourceTaskData(): IPluginTaskData {
        return this.#sourceTaskData;
    }
    get targetTaskData(): IPluginTaskData {
        return this.#targetTaskData;
    }
}