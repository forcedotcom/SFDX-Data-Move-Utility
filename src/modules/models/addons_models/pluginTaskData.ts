import { TaskOrgData } from "..";
import { IPluginTaskData, PLUGIN_TASK_DATA_MEDIA_TYPE } from "./addonSharedPackage";


export default class PluginTaskData implements IPluginTaskData {

    #taskOrgData: TaskOrgData;

    constructor(taskOrgData: TaskOrgData) {
        this.#taskOrgData = taskOrgData;
    }

    get mediaType(): PLUGIN_TASK_DATA_MEDIA_TYPE {
        let numValue: number = this.#taskOrgData.org.media;
        return <PLUGIN_TASK_DATA_MEDIA_TYPE>numValue;
    }

    get sObjectName(): string {
        return this.#taskOrgData.task.sObjectName;
    }

    get isSource(): boolean {
        return this.#taskOrgData.isSource;
    }

    get idRecordsMap(): Map<string, any> {
        return this.#taskOrgData.idRecordsMap;
    }

    get extIdRecordsMap(): Map<string, string> {
        return this.#taskOrgData.extIdRecordsMap;
    }

    get records(): any[] {
        return this.#taskOrgData.records;
    }
}