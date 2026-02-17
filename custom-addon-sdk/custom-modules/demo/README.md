# Demo Custom Add-On

## Create

1. From the repo root run: `node scripts/create-custom-addon-template.js <addon-name>`
2. The template is created in `custom-addon-sdk/custom-modules/<addon-name>`

## Develop

1. Go to the add-on folder.
2. Install deps: `npm install`
3. Compile: `npm run compile` (standalone, add-on only).
4. Build (alias): `npm run build` (standalone, add-on only).
5. Compile with the main plugin: from repo root run `npm run compile` (builds SFDMU and all add-ons).
6. Build with the main plugin: from repo root run `npm run build` (builds SFDMU and all add-ons).

## Implement

1. Write add-on logic in `index.ts` inside the class that implements `ISfdmuRunCustomAddonModule`.
2. Use `onInit` for one-time setup and `onExecute` for the add-on runtime logic.
3. Add helper files next to `index.ts` and import them as needed.
4. Add messages in `resources/messages.md` when you need localized output.

## Use In export.json

Option A: Local file path via `module` (recommended for development)

1. Use `module` and pass a file path to the built file.
2. Paths can be absolute or relative to the `export.json` location.
3. `command` defaults to `sfdmu:run` and can be omitted.
4. `args` is optional and can be omitted when not needed.
5. Example with a relative path:

```json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "./custom-addon-sdk/custom-modules/demo/dist/index.js"
    }
  ]
}
```

Example with an absolute path in `module`:

```json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "C:/path/to/custom-addon-sdk/custom-modules/demo/dist/index.js"
    }
  ]
}
```

Option B: NPM package (recommended for distribution)

1. Publish the add-on package to npm.
2. Install it in the project where SFDMU runs:
3. Local project install: `npm install <package-name>`
4. Global install (optional): `npm install -g <package-name>`
5. Use `module` in export.json to reference the package by name:

```json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "<package-name>"
    }
  ]
}
```

Notes:

1. When using `module`, the loader resolves modules from the local project first, then tries globally installed modules.
2. `path` is also supported as a legacy local file locator. At least one of `module` or `path` must be present.
3. If both `module` and `path` are missing, SFDMU logs a warning and skips that add-on entry.
4. The loader supports both `.js` and `.ts` entry points when `module` or `path` contains a file path.

## Debug With Plugin

1. In `export.json`, set the add-on `module` to `./custom-addon-sdk/custom-modules/demo/index.ts`.
2. Run the main plugin from the repo root with the cross-platform debug runner: `./sfdmu-run-debug.cmd --sourceusername source@mail.com --targetusername target@mail.com --path .`.
3. Attach your debugger to the process started by `./sfdmu-run-debug.cmd`.
4. Set breakpoints in the add-on `index.ts`. When the plugin loads and runs the add-on, the debugger will stop on those breakpoints.

## Publish To NPM

1. Update `package.json` name and version.
2. Build: `npm run build`
3. Publish: `npm publish`

## Module Format (ESM / CJS)

This demo add-on is ESM by default (see `"type": "module"` in `package.json`).
The SFDMU loader can resolve **both** ESM and CommonJS add-ons:

1. It tries ESM `import` first.
2. If that fails, it tries the alternate `.ts`/`.js` entry.
3. If still not found, it falls back to CommonJS `require`.

So custom add-ons are **not** limited to ESM only.

Each add-on can define its own messages in `resources/messages.md` using the same key/value format as
`messages/logging.md`. Add-ons can also access the plugin-wide keys from `messages/logging.md`.
These local keys are scoped to the current add-on:

1. Other custom add-ons cannot resolve them.
2. The main plugin cannot resolve them.
3. Core add-on bundle keys from `messages/sfdmu-run-core-addon.md` are available only to core add-ons.

Note: the plugin evolves over time, so specific keys in `messages/logging.md` are not guaranteed to exist in future
versions. Prefer local add-on messages for stability.

## Runtime Context Metadata

The runtime context includes pass metadata for multi-pass events:

1. `context.objectSetIndex`: zero-based object set index currently being processed.
2. `context.passNumber`: zero-based pass number for events executed multiple times within an object set.
3. `context.isFirstPass`: `true` only for the first pass invocation in the current object set.

These fields are useful in `onBeforeUpdate`, `onAfterUpdate`, and record-filter events to implement deterministic
pass-specific logic.

## License

This add-on is distributed under the MIT License and is not affiliated with Salesforce.
See `LICENSE.md` for full terms.
Salesforce is a trademark of Salesforce, Inc.
