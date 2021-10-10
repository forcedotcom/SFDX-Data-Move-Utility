import { ISfdmuRunCustomAddonModule } from "../../../modules/sfdmu-run/custom-addons/package";
import ISfdmuRunCustomAddonService from "../../../modules/sfdmu-run/custom-addons/package/ISfdmuRunCustomAddonService";
import SfdmuRunAddonRuntime from "../sfdmuRunAddonRuntime";


export default class SfdmuRunCustomAddonService implements ISfdmuRunCustomAddonService {

    runtime: SfdmuRunAddonRuntime;

    constructor(runtime: SfdmuRunAddonRuntime) {
        this.runtime = runtime;
    }

    logFormatted(module: ISfdmuRunCustomAddonModule, message: string, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void { 
        (this.runtime as any).logFormatted(module, message, messageType, ...tokens);
    }

    log(message: string | object, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "JSON", ...tokens: string[]): void {
        (this.runtime as any).log(message, messageType, ...tokens);
    }
}