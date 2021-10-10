import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonModule, ISfdmuRunCustomAddonRuntime } from "../package";


/**
 * This test custom Add-On makes some manipulations with the records 
 * right before the Taget environment gettng update.
 * You can use this template to build your own Sfdmu modules.
 */
export default class CustomSfdmuRunAddonTemlate implements ISfdmuRunCustomAddonModule {

    /**
     * The constructor is called by the Add-On framework when the module is initialized.
     * It's mandatory to have this constructor in the module class.
     * You will not get any runtime methods & properties in your module if you will get this constructor out...
     * 
     * @param runtime The Add-On runtime passed from the current running context.
     */
    constructor(runtime: ISfdmuRunCustomAddonRuntime) {
        this.runtime = runtime;
    }

    runtime: ISfdmuRunCustomAddonRuntime;

    async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<void> {

        // Print start message
        

        this.runtime.service.logFormatted(this, 'test message');
        this.runtime.service.log('test message2', 'WARNING');

    }

    
}