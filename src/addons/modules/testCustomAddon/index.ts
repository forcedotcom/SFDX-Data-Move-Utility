import { IAddonModule, IPluginRuntime, ICommandRunInfo } from "../../../modules/models/addons_models/addonSharedPackage";


export default class TestCustomAddon implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }

    async onScriptSetup(runInfo: ICommandRunInfo): Promise<ICommandRunInfo> {
        this.runtime.writeLogConsoleMessage("TestCustomAddon:onScriptSetup");
        this.runtime.writeLogConsoleMessage(runInfo, "OBJECT");
        this.runtime.writeLogConsoleMessage("Changing the apiVersion to 49.0...");
        runInfo.apiVersion = "49.0";
        return runInfo;
    }

    async onOrgsConnected(): Promise<any> {
        this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Source Org = " + this.runtime.getOrgInfo(true).instanceUrl);
        this.runtime.writeLogConsoleMessage("TestCustomAddon:onOrgsConnected. Target Org = " + this.runtime.getOrgInfo(false).instanceUrl);
    }

}