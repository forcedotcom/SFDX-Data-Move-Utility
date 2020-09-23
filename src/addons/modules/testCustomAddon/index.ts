import { IAddonModule, IScriptRunInfo } from "../../../modules/models/addons_models/IAddonModule";
import { IPluginRuntime } from "../../../modules/models/addons_models/IPluginRuntime";


export default class TestCustomAddon implements IAddonModule {
    runtime : IPluginRuntime;
    constructor(runtime : IPluginRuntime){
        this.runtime = runtime;
    }
    async onScriptSetup(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>{
        console.log("TestCustomAddon : runInfo=" + runInfo);
        runInfo.apiVersion = "49.0";
        return runInfo;
    }

}