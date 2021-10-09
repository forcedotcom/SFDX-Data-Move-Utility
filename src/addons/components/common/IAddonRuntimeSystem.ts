import { STANDARD_MESSAGES } from "../../messages/standard";
import IAddonModuleBase from "./IAddonModuleBase";


export interface IAddonRuntimeSystem {
    ____$getStandardMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): string,
    ____$writeStandardInfoMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
    ____$writeStandardWarningMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
    ____$writeStandardErrorMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
}