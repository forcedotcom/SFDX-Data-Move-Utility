**Overview**
This folder contains the interface SDK for building SFDMU run add-on modules without importing the plugin runtime. It is intended to be copied or installed from disk so you can compile and type-check custom add-ons in isolation.

**Install**

1. Run `npm install <absolute-path-to>/custom-addon-sdk` in your add-on project.
2. Use `import type` to bring in the interfaces.

**Example**

```ts
import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
} from 'sfdmu-addon-sdk';

/**
 * Example add-on module.
 */
export default class MyAddon implements ISfdmuRunCustomAddonModule {
  /**
   * Runtime provided by the plugin.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  /**
   * Creates a new add-on instance.
   *
   * @param runtime - Runtime provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
  }

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
    this.runtime.service.log(this, `Addon ${context.moduleDisplayName} started for ${context.eventName}.`);
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
    this.runtime.service.log(this, `Addon ${context.moduleDisplayName} init for ${context.eventName}.`);
    return { cancel: false };
  }
}
```

**External Add-On Loading**
Use `export.json` or `addons.json` to point to an external add-on file:

```json
{
  "beforeUpdateAddons": [
    {
      "description": "My external add-on",
      "module": "C:\\MyAddons\\MyAddon\\dist\\index.js",
      "args": {
        "example": true
      }
    }
  ]
}
```

In `export.json`, use `module` for both package names and file paths. File paths may be absolute or relative to the
`export.json` location. You can also use `path` as a legacy local file locator. At least one of `module` or `path`
must be provided. If both are missing, SFDMU logs a warning and skips that add-on entry. Custom add-ons must be
compiled to JavaScript so Node can load them at runtime.

**Runtime Context Metadata**

For multi-pass events, the runtime context also provides:

1. `context.objectSetIndex` (zero-based object set index).
2. `context.passNumber` (zero-based pass number inside the current object set).
3. `context.isFirstPass` (`true` only for the first pass invocation in the current object set).

**Repo Build (No Flags)**
When working inside this repository, `npm run compile` and `npm run build` compile the plugin **and** all add-ons located under `custom-addon-sdk/custom-modules` without any flags.
