/**
 * Custom Add-On template.
 *
 * Guide:
 * - Compile this add-on (standalone): npm install && npm run compile (from this add-on folder)
 * - Build this add-on (standalone): npm run build (from this add-on folder)
 * - Compile in the SFDMU repo: npm run compile (compiles SFDMU + all add-ons)
 * - Build in the SFDMU repo: npm run build (builds SFDMU + all add-ons)
 * - Run in SFDMU: set export.json add-on module to demo/dist/index.js
 * - Debug in the SFDMU repo: point export.json module to demo/index.ts and run via dev tooling
 * - Publish from this add-on folder after build: npm pack / npm publish
 */
import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
} from 'sfdmu-addon-sdk/interfaces';

/**
 * Custom add-on implementation.
 */
export default class TestAddon implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Runtime provided by the plugin.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on instance.
   *
   * @param runtime - Runtime provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes add-on logic.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public async onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    this.runtime.logFormattedInfo(this, 'hello_world');
    this.runtime.service.log(this, `Add-On ${context.moduleDisplayName} started.`);
    this.runtime.service.log(
      this,
      `Context metadata: objectSetIndex=${String(context.objectSetIndex ?? 0)} passNumber=${String(
        context.passNumber ?? 0
      )} isFirstPass=${String(context.isFirstPass ?? true)}.`
    );
    this.runtime.service.log(this, args, 'JSON');
    await Promise.resolve();
    return { cancel: false };
  }

  /**
   * Executes one-time initialization logic after the script is loaded but before the job starts.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public async onInit(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    this.runtime.service.log(this, `Add-On ${context.moduleDisplayName} init completed.`);
    this.runtime.service.log(
      this,
      `Init context metadata: objectSetIndex=${String(context.objectSetIndex ?? 0)} passNumber=${String(
        context.passNumber ?? 0
      )} isFirstPass=${String(context.isFirstPass ?? true)}.`
    );
    this.runtime.service.log(this, args, 'JSON');
    await Promise.resolve();
    return { cancel: false };
  }
}
