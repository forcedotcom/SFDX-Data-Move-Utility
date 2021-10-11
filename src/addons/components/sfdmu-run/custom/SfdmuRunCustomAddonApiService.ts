import { ISfdmuRunCustomAddonCommandRunInfo, ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonModule, ISfdmuRunCustomAddonProcessedData } from "../../../modules/sfdmu-run/custom-addons/package";
import ISfdmuRunCustomAddonApiService from "../../../modules/sfdmu-run/custom-addons/package/ISfdmuRunCustomAddonApiService";
import SfdmuRunAddonJob from "../sfdmuRunAddonJob";
import SfdmuRunAddonRuntime from "../sfdmuRunAddonRuntime";
import SfdmuRunAddonTask from "../sfdmuRunAddonTask";


export default class SfdmuRunCustomAddonApiService implements ISfdmuRunCustomAddonApiService {

    runtime: SfdmuRunAddonRuntime;

    constructor(runtime: SfdmuRunAddonRuntime) {
        this.runtime = runtime;
    }

    getPluginRunInfo(): ISfdmuRunCustomAddonCommandRunInfo {
        return this.runtime.runInfo;
    }

    getProcessedData(context: ISfdmuRunCustomAddonContext): ISfdmuRunCustomAddonProcessedData {
        return this.#getPluginTask(context).processedData;
    }

    log(module: ISfdmuRunCustomAddonModule, message: string | object, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void {
        if (typeof message === 'string') {
            (this.runtime as any).logFormatted(module, message, messageType, ...tokens);
        } else {
            (this.runtime as any).log(message, messageType, ...tokens);
        }
    }


    // ------------- Helpers ------------- //
    get #pluginJob(): SfdmuRunAddonJob {
        return this.runtime.pluginJob;
    }

    #getPluginTask(context: ISfdmuRunCustomAddonContext): SfdmuRunAddonTask {
        return this.#pluginJob.tasks.find(task => task.sObjectName == context.objectName);
    }


}