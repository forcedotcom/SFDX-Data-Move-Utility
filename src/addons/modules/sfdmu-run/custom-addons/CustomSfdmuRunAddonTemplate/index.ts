import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonModule, ISfdmuRunCustomAddonResult, ISfdmuRunCustomAddonRuntime } from "../package";


/**
 * This test Custom Add-On module 
 *  makes simple manipulations with the source records 
 *  before they being uploaded to the Target.
 * 
 * You can use this template to create your own custom Add-On module.
 */
export default class CustomSfdmuRunAddonTemlate implements ISfdmuRunCustomAddonModule {

    /**
     * This constructor is called by the Add-On Framework when the custom module is being initialized.
     * Please, don't remove it from your module code.
     * 
     * @param runtime The current instance of the Add-On module runtime, passed to the module by the Plugin.
     */
    constructor(runtime: ISfdmuRunCustomAddonRuntime) {
        this.runtime = runtime;
    }


    /**
     * The current instance of the Add-On module runtime.
     */
    runtime: ISfdmuRunCustomAddonRuntime;


    /**
     * The module entry point.
     */
    async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {

        // Print start message
        this.runtime.service.log(this, `The Add-On module ${context.moduleDisplayName} has been successfully started. The event ${context.eventName} has been fired.`);

        // Print some test logs
        this.runtime.service.log(this, '');                        // Prints new line
        this.runtime.service.log(this, 'The arguments are:');  // Prints string
        this.runtime.service.log(this, args, "JSON");              // Prints object as fromatted JSON
        this.runtime.service.log(this, '');                        // Prints new line

        // Get the currently running task
        const data = this.runtime.service.getProcessedData(context);

        // Make required manipuation with the source records.
        // The Plugin then will use the already modified records to update the Target.
        [].concat(data.recordsToInsert, data.recordsToUpdate).forEach(record => {
            const jsonString = String(record['LongText__c']) || '{}';
            if (jsonString) {
                const obj = JSON.parse(jsonString);
                record['TEST1__c'] = obj['TEST1__c'];
            }
            if (args) {
                Object.keys(args).forEach(function (prop) {
                    record[prop] = args[prop];
                });
            }
        });

        // Print finish message
        this.runtime.service.log(this, `The Add-On module ${context.moduleDisplayName} has been successfully completed.`);

        return { cancel: true };

        //return null;
    }


}