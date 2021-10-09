import { IAddonRuntimeSystem } from "../common/IAddonRuntimeSystem";

export interface ISfdmuRunAddonRuntimeSystem extends IAddonRuntimeSystem {
    createSfdmuPluginJob(): void
}
