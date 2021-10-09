import { SYSTEM_MESSAGES } from "../../messages/system";
import IAddonModuleBase from "./IAddonModuleBase";


export interface IAddonRuntimeSystem {
    getSystemMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): string,
    writeSystemInfoMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void,
    writeSystemWarningMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void,
    writeSystemErrorMessage(module: IAddonModuleBase, message: SYSTEM_MESSAGES, ...tokens: string[]): void,
}