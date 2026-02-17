/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { Common } from '../../../src/modules/common/Common.js';
import { ADDON_EVENTS } from '../../../src/modules/common/Enumerations.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import { CommandAbortedByAddOnError } from '../../../src/modules/models/common/CommandAbortedByAddOnError.js';
import ScriptAddonManifestDefinition from '../../../src/modules/models/script/ScriptAddonManifestDefinition.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';
import SfdmuRunAddonManager from '../../../src/modules/addons/SfdmuRunAddonManager.js';

declare global {
  // eslint-disable-next-line no-var
  var __addonCalls: string[] | undefined;
}

const createLoggingService = (): LoggingService => {
  const context = new LoggingContext({
    commandName: 'run',
    rootPath: os.tmpdir(),
    fileLogEnabled: false,
  });
  return new LoggingService(context);
};

describe('SfdmuRunAddonManager', () => {
  let originalLogger: typeof Common.logger;

  beforeEach(() => {
    originalLogger = Common.logger;
    Common.logger = createLoggingService();
    globalThis.__addonCalls = [];
  });

  afterEach(() => {
    Common.logger = originalLogger;
    globalThis.__addonCalls = undefined;
  });

  it('loads addons from script and addons.json manifests', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sfdmu-addon-'));
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');
    const manifestPath = path.join(tempDir, 'addons.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        addons: [
          {
            command: 'sfdmu:run',
            module: addonPath,
            event: 'onBefore',
            args: { label: 'file' },
          },
        ],
      })
    );

    const script = new Script();
    script.basePath = tempDir;
    script.logger = createLoggingService();
    script.beforeAddons = [
      new ScriptAddonManifestDefinition({
        module: addonPath,
        args: { label: 'script' },
      }),
    ];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBefore);

    const calls = globalThis.__addonCalls ?? [];
    assert.ok(calls.some((call) => call.includes('onBefore::file')));
    assert.ok(calls.some((call) => call.includes('onBefore::script')));
  });

  it('treats empty command as default sfdmu:run', async () => {
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');

    const script = new Script();
    script.basePath = process.cwd();
    script.logger = createLoggingService();
    script.beforeAddons = [
      new ScriptAddonManifestDefinition({
        command: '',
        module: addonPath,
        args: { label: 'empty-command' },
      }),
    ];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBefore);

    const calls = globalThis.__addonCalls ?? [];
    assert.ok(calls.some((call) => call.includes('onBefore::empty-command')));
  });

  it('loads add-on when only path is provided', async () => {
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');

    const script = new Script();
    script.basePath = process.cwd();
    script.logger = createLoggingService();
    script.beforeAddons = [
      new ScriptAddonManifestDefinition({
        path: addonPath,
        args: { label: 'path-only' },
      }),
    ];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBefore);

    const calls = globalThis.__addonCalls ?? [];
    assert.ok(calls.some((call) => call.includes('onBefore::path-only')));
  });

  it('warns and skips add-ons when both module and path are missing', async () => {
    const warnings: string[] = [];
    const logger = createLoggingService();
    const originalWarn = logger.warn.bind(logger);
    logger.warn = ((message: string, ...tokens: string[]) => {
      warnings.push(logger.getResourceString(message, ...tokens));
      originalWarn(message, ...tokens);
    }) as typeof logger.warn;

    const script = new Script();
    script.basePath = process.cwd();
    script.logger = logger;
    script.beforeAddons = [
      new ScriptAddonManifestDefinition({
        args: { label: 'missing-locator' },
      }),
    ];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    const executed = await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBefore);

    assert.equal(executed, false);
    assert.ok(warnings.some((entry) => entry.includes('Cannot load module')));
  });

  it('filters object-level add-ons by object name', async () => {
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');
    const account = new ScriptObject('Account');
    account.beforeUpdateAddons = [
      new ScriptAddonManifestDefinition({
        module: addonPath,
        args: { label: 'account' },
      }),
    ];

    const script = new Script();
    script.basePath = process.cwd();
    script.logger = createLoggingService();
    script.objectSets = [new ScriptObjectSet([account])];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBeforeUpdate, 'Account');
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBeforeUpdate, 'Contact');

    const calls = globalThis.__addonCalls ?? [];
    assert.ok(calls.some((call) => call.includes('onBeforeUpdate:Account:account')));
    assert.ok(!calls.some((call) => call.includes('onBeforeUpdate:Contact:account')));
  });

  it('aborts when add-on requests cancellation', async () => {
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');
    const script = new Script();
    script.basePath = process.cwd();
    script.logger = createLoggingService();
    script.beforeAddons = [
      new ScriptAddonManifestDefinition({
        module: addonPath,
        args: { label: 'cancel', cancel: true },
      }),
    ];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();

    await assert.rejects(
      () => manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBefore),
      (error: unknown) => error instanceof CommandAbortedByAddOnError
    );
  });

  it('passes pass metadata into add-on context overrides', async () => {
    const addonPath = path.resolve('test/fixtures/addons/TestAddon.ts');
    const account = new ScriptObject('Account');
    account.beforeUpdateAddons = [
      new ScriptAddonManifestDefinition({
        module: addonPath,
        args: { label: 'context-meta' },
      }),
    ];

    const script = new Script();
    script.basePath = process.cwd();
    script.logger = createLoggingService();
    script.objectSetIndex = 3;
    script.objectSets = [new ScriptObjectSet([account])];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.onBeforeUpdate, 'Account', {
      objectSetIndex: 3,
      passNumber: 2,
      isFirstPass: false,
    });

    const calls = globalThis.__addonCalls ?? [];
    assert.ok(calls.some((call) => call.includes('onBeforeUpdate:Account:context-meta')));
    assert.ok(calls.some((call) => call.includes(':set=3:pass=2:first=false')));
  });
});
