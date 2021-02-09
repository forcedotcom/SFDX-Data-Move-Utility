import { IAddonModule, IPluginExecutionContext, IPluginRuntime } from "../../../modules/models/addons_models/addonSharedPackage";


export default class TestCustomAddon implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnAfter functionality here

        //this.runtime.writeLogConsoleMessage(JSON.stringify(context));
        //this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Source Org = " + this.runtime.getOrgInfo(true).instanceUrl);
        //this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Target Org = " + this.runtime.getOrgInfo(false).instanceUrl);
    }

}