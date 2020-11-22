import { IAddonModule, IPluginRuntime } from "../../../modules/models/addons_models/addonSharedPackage";


export default class TestCustomAddon implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }
    
    async onExecute(...args : any[]) : Promise<void>  {
        this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Source Org = " + this.runtime.getOrgInfo(true).instanceUrl);
        this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Target Org = " + this.runtime.getOrgInfo(false).instanceUrl);
    }

}