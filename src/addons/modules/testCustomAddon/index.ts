import { IAddonModule, IScriptRunInfo } from "../../../modules/models/addons_models/IAddonModule";
import { IPluginRuntime } from "../../../modules/models/addons_models/IPluginRuntime";


export default class TestCustomAddon implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }

    async onScriptSetup(runInfo: IScriptRunInfo): Promise<IScriptRunInfo> {        
        console.log("TestCustomAddon:OnScriptSetup. basePath = " + this.runtime.basePath);        
        console.log("TestCustomAddon:OnScriptSetup. RunInfo = " + JSON.stringify(runInfo));        
        runInfo.apiVersion = "49.0";
        return runInfo;
    }

    async onOrgsConnected(): Promise<any> {
        console.log("TestCustomAddon:onOrgsConnected. Source Org = " + this.runtime.getOrgInfo(true).instanceUrl);
        console.log("TestCustomAddon:onOrgsConnected. Target Org = " + this.runtime.getOrgInfo(false).instanceUrl);
    }


}