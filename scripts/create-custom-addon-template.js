import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const ROOT_DIR = path.resolve(CURRENT_DIR, '..');
const CUSTOM_ADDON_ROOT = path.join(ROOT_DIR, 'custom-addon-sdk', 'custom-modules');
const SDK_PACKAGE_NAME = 'sfdmu-addon-sdk';

/**
 * Converts a kebab/underscore name to PascalCase.
 *
 * @param {string} rawName - Raw module name.
 * @returns {string} PascalCase class name.
 */
const toPascalCase = (rawName) => {
  const parts = rawName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    return 'CustomAddon';
  }
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
};

/**
 * Builds index.ts contents for a custom add-on module.
 *
 * @param {string} className - Add-on class name.
 * @param {string} addonName - Add-on module name.
 * @returns {string} File contents.
 */
const buildIndexTemplate = (className, addonName) => `/**
 * Custom Add-On template.
 *
 * Guide:
 * - Compile this add-on (standalone): npm install && npm run compile (from this add-on folder)
 * - Build this add-on (standalone): npm run build (from this add-on folder)
 * - Compile in the SFDMU repo: npm run compile (compiles SFDMU + all add-ons)
 * - Build in the SFDMU repo: npm run build (builds SFDMU + all add-ons)
 * - Run in SFDMU: set export.json add-on module to ${addonName}/dist/index.js
 * - Debug in the SFDMU repo: point export.json module to ${addonName}/index.ts and run via dev tooling
 * - Publish from this add-on folder after build: npm pack / npm publish
 */
import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime
} from '${SDK_PACKAGE_NAME}/interfaces';

/**
 * Custom add-on implementation.
 */
export default class ${className} implements ISfdmuRunCustomAddonModule {
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
    this.runtime.service.log(this, \`Add-On \${context.moduleDisplayName} started.\`);
    this.runtime.service.log(
      this,
      \`Context metadata: objectSetIndex=\${String(context.objectSetIndex ?? 0)} passNumber=\${String(
        context.passNumber ?? 0
      )} isFirstPass=\${String(context.isFirstPass ?? true)}.\`
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
    this.runtime.service.log(this, \`Add-On \${context.moduleDisplayName} init completed.\`);
    this.runtime.service.log(
      this,
      \`Init context metadata: objectSetIndex=\${String(context.objectSetIndex ?? 0)} passNumber=\${String(
        context.passNumber ?? 0
      )} isFirstPass=\${String(context.isFirstPass ?? true)}.\`
    );
    this.runtime.service.log(this, args, 'JSON');
    await Promise.resolve();
    return { cancel: false };
  }
}
`;

/**
 * Builds package.json contents for a custom add-on module.
 *
 * @param {string} name - Package name.
 * @returns {string} File contents.
 */
const buildPackageJson = (name) =>
  JSON.stringify(
    {
      name,
      version: '1.0.0',
      description: `SFDMU custom add-on: ${name}.`,
      private: true,
      type: 'module',
      main: './dist/index.js',
      types: './index.ts',
      scripts: {
        compile: 'tsc -p . --pretty',
        build: 'npm run compile',
      },
      devDependencies: {
        [SDK_PACKAGE_NAME]: 'file:../../',
        typescript: '^5.4.5',
      },
    },
    null,
    2
  ) + '\n';

/**
 * Builds tsconfig.json contents for a custom add-on module.
 *
 * @returns {string} File contents.
 */
const buildTsconfig = () =>
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './dist',
        rootDir: '.',
        sourceMap: true,
        strict: true,
        skipLibCheck: true,
      },
      include: ['./index.ts'],
    },
    null,
    2
  ) + '\n';

/**
 * Builds messages.md contents for a custom add-on module.
 *
 * @returns {string} File contents.
 */
const buildMessagesTemplate = () => `# hello_world

Hello world from custom add-on!
`;

/**
 * Builds LICENSE.md contents for a custom add-on module.
 *
 * @returns {string} File contents.
 */
const buildLicenseTemplate = () => `# License

This add-on is distributed under the MIT License.
This add-on is not affiliated with, sponsored by, or endorsed by Salesforce.
Salesforce is not responsible for this add-on.
Salesforce is a trademark of Salesforce, Inc.

MIT License

Copyright (c) <year> <owner>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/**
 * Builds README.md contents for a custom add-on module.
 *
 * @returns {string} File contents.
 */
const buildReadmeTemplate = () => `# Custom Add-On

## Create

1. From the repo root run: \`node scripts/create-custom-addon-template.js <addon-name>\`
2. The template is created in \`custom-addon-sdk/custom-modules/<addon-name>\`

## Develop

1. Go to the add-on folder.
2. Install deps: \`npm install\`
3. Compile: \`npm run compile\` (standalone, add-on only).
4. Build (alias): \`npm run build\` (standalone, add-on only).
5. Compile with the main plugin: from repo root run \`npm run compile\` (builds SFDMU and all add-ons).
6. Build with the main plugin: from repo root run \`npm run build\` (builds SFDMU and all add-ons).

## Implement

1. Write add-on logic in \`index.ts\` inside the class that implements \`ISfdmuRunCustomAddonModule\`.
2. Use \`onInit\` for one-time setup and \`onExecute\` for the add-on runtime logic.
3. Add helper files next to \`index.ts\` and import them as needed.
4. Add messages in \`resources/messages.md\` when you need localized output.

## Use In export.json

Option A: Local file path via \`module\` (recommended for development)
1. Use \`module\` and pass a file path to the built file.
2. File paths can be absolute or relative to the \`export.json\` location.
3. \`command\` defaults to \`sfdmu:run\` and can be omitted.
4. \`args\` is optional and can be omitted when not needed.
5. Example with a relative path:

\`\`\`json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "./custom-addon-sdk/custom-modules/<addon-name>/dist/index.js"
    }
  ]
}
\`\`\`

Example with an absolute path in \`module\`:

\`\`\`json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "C:/path/to/custom-addon-sdk/custom-modules/<addon-name>/dist/index.js"
    }
  ]
}
\`\`\`

Option B: NPM package (recommended for distribution)
1. Publish the add-on package to npm.
2. Install it in the project where SFDMU runs:
3. Local project install: \`npm install <package-name>\`
4. Global install (optional): \`npm install -g <package-name>\`
5. Use \`module\` in export.json to reference the package by name:

\`\`\`json
{
  "addons": [
    {
      "event": "onBefore",
      "module": "<package-name>"
    }
  ]
}
\`\`\`

Notes:
1. When using \`module\`, the loader resolves modules from the local project first, then tries globally installed modules.
2. \`path\` is also supported as a legacy local file locator. At least one of \`module\` or \`path\` must be present.
3. If both \`module\` and \`path\` are missing, SFDMU logs a warning and skips that add-on entry.
4. The loader supports both \`.js\` and \`.ts\` entry points when \`module\` or \`path\` contains a file path.

## Debug With Plugin

1. In \`export.json\`, set the add-on \`module\` to \`./custom-addon-sdk/custom-modules/<addon-name>/index.ts\`.
2. Run the main plugin in dev mode from the repo root: \`./bin/dev sfdmu run\` (Windows: \`bin\\\\dev.cmd sfdmu run\`).
3. To debug, start the main plugin with the Node inspector: \`sfdmu-run-debug.cmd\`, then attach your debugger.
4. Set breakpoints in the add-on \`index.ts\`. When the plugin loads and runs the add-on, the debugger will stop on those breakpoints.

## Publish To NPM

1. Update \`package.json\` name and version.
2. Build: \`npm run build\`
3. Publish: \`npm publish\`

## Module Format (ESM / CJS)

This template is ESM by default (see \`"type": "module"\` in \`package.json\`).
The SFDMU loader can resolve **both** ESM and CommonJS add-ons:

1. It tries ESM \`import\` first.
2. If that fails, it tries the alternate \`.ts\`/\`.js\` entry.
3. If still not found, it falls back to CommonJS \`require\`.

So custom add-ons are **not** limited to ESM only.

## Messages

Each add-on can define its own messages in \`resources/messages.md\` using the same key/value format as
\`messages/logging.md\`. Add-ons can also access the plugin-wide keys from \`messages/logging.md\`.
These local keys are scoped to the current add-on:

1. Other custom add-ons cannot resolve them.
2. The main plugin cannot resolve them.
3. Core add-on bundle keys from \`messages/sfdmu-run-core-addon.md\` are available only to core add-ons.

Note: the plugin evolves over time, so specific keys in \`messages/logging.md\` are not guaranteed to exist in future
versions. Prefer local add-on messages for stability.

## Runtime Context Metadata

The runtime context now includes pass metadata for multi-pass events:

1. \`context.objectSetIndex\`: zero-based object set index currently being processed.
2. \`context.passNumber\`: zero-based pass number for events executed multiple times within an object set.
3. \`context.isFirstPass\`: \`true\` only for the first pass invocation in the current object set.

These fields are especially useful in \`onBeforeUpdate\`, \`onAfterUpdate\`, and record-filter events to implement
deterministic pass-specific logic.

## License

This add-on is distributed under the MIT License and is not affiliated with Salesforce.
See \`LICENSE.md\` for full terms.
Salesforce is a trademark of Salesforce, Inc.
`;

/**
 * Checks whether a path exists.
 *
 * @param {string} targetPath - Path to check.
 * @returns {Promise<boolean>} True when the path exists.
 */
const pathExistsAsync = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Ensures a directory exists and is empty.
 *
 * @param {string} dirPath - Directory to validate.
 */
const ensureEmptyDirAsync = async (dirPath) => {
  const entries = await fs.readdir(dirPath);
  const nonEmptyEntries = entries.filter((entry) => entry !== '.gitkeep' && entry !== '.DS_Store');
  if (nonEmptyEntries.length > 0) {
    throw new Error('Target add-on folder is not empty.');
  }
};

/**
 * Writes a file ensuring the parent directory exists.
 *
 * @param {string} filePath - Destination file path.
 * @param {string} contents - File contents.
 */
const writeFileAsync = async (filePath, contents) => {
  await fs.writeFile(filePath, contents, 'utf8');
};

/**
 * Generates a custom add-on template folder.
 */
const runAsync = async () => {
  const [rawName] = process.argv.slice(2);
  const name = rawName?.trim();
  if (!name) {
    // eslint-disable-next-line no-console
    console.error('Usage: node create-custom-addon-template.js <addon-name>');
    process.exitCode = 1;
    return;
  }

  const targetDir = path.join(CUSTOM_ADDON_ROOT, name);
  try {
    if (await pathExistsAsync(targetDir)) {
      const stats = await fs.stat(targetDir);
      if (!stats.isDirectory()) {
        throw new Error('Target add-on path is not a directory.');
      }
      await ensureEmptyDirAsync(targetDir);
    } else {
      await fs.mkdir(targetDir, { recursive: false });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`Unable to create add-on folder: ${message}`);
    process.exitCode = 1;
    return;
  }

  const className = `${toPascalCase(name)}Addon`;
  await writeFileAsync(path.join(targetDir, 'index.ts'), buildIndexTemplate(className, name));
  await writeFileAsync(path.join(targetDir, 'package.json'), buildPackageJson(name));
  await writeFileAsync(path.join(targetDir, 'tsconfig.json'), buildTsconfig());
  await writeFileAsync(path.join(targetDir, 'README.md'), buildReadmeTemplate());
  await writeFileAsync(path.join(targetDir, 'LICENSE.md'), buildLicenseTemplate());

  const resourcesDir = path.join(targetDir, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await writeFileAsync(path.join(resourcesDir, 'messages.md'), buildMessagesTemplate());
};

await runAsync();
