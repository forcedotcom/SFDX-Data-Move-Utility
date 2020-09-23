import { AddonModuleBase, IScriptRunInfo } from "../../../modules/models/addons_models/AddonModuleBase";


export default class TestCustomAddon extends AddonModuleBase {
    async onScriptSetup(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>{
        console.log("TestCustomAddon : runInfo=" + runInfo);
        return runInfo;
    }

}