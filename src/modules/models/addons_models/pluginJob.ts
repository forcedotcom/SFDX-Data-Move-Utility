import { MigrationJob } from "..";
import { IPluginJob, IPluginTask } from "./addonSharedPackage";
import PluginTask from "./pluginTask";

export default class PluginJob implements IPluginJob {
    
    #migrationJob : MigrationJob;
    #pluginTasks: IPluginTask[];

    constructor(migrationJob : MigrationJob){
        
        // Setup props
        this.#migrationJob = migrationJob;
        
        // Setup tasks
        this.#pluginTasks = this.#migrationJob.tasks.map(jobTask => new PluginTask(jobTask));

    }
    
    get tasks() : IPluginTask[] {
       return this.#pluginTasks;
    }
}