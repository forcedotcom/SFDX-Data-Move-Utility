import { TaskOrgData } from "..";
import { IPluginTaskData } from "./addonSharedPackage";


export default class PluginTaskData implements IPluginTaskData {

    #taskOrgData : TaskOrgData;

    constructor(taskOrgData : TaskOrgData){
        this.#taskOrgData = taskOrgData;
    }

    get records(): any[] {
        return this.#taskOrgData.records;
    }
}