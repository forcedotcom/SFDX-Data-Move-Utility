/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import AddonModule from '../../../src/modules/addons/AddonModule.js';
import AddonRuntime from '../../../src/modules/addons/AddonRuntime.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import type { IAddonContext } from '../../../src/modules/addons/models/IAddonContext.js';
import type AddonResult from '../../../src/modules/addons/models/AddonResult.js';

const createLoggingService = (): LoggingService => {
  const context = new LoggingContext({
    commandName: 'run',
    rootPath: os.tmpdir(),
    fileLogEnabled: false,
  });
  return new LoggingService(context);
};

const createAddonRuntime = (): AddonRuntime => new AddonRuntime(createLoggingService());

const createContext = (moduleDisplayName: string, isCore = false): IAddonContext => ({
  eventName: 'onBefore',
  objectName: 'Account',
  description: 'Test add-on',
  objectDisplayName: 'Account',
  moduleDisplayName,
  isCore,
});

const createMessagesFileAsync = async (baseDir: string, content: string): Promise<string> => {
  const resourcesPath = path.join(baseDir, 'resources');
  await fs.mkdir(resourcesPath, { recursive: true });
  const filePath = path.join(resourcesPath, 'messages.md');
  await fs.writeFile(filePath, content);
  return filePath;
};

/**
 * Test add-on module used for message resolution checks.
 */
class TestAddonModule extends AddonModule {
  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new test module instance.
   *
   * @param runtime - Add-on runtime instance.
   */
  public constructor(runtime: AddonRuntime) {
    super(runtime);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * No-op implementation required by the abstract base class.
   *
   * @returns Add-on result or void.
   */
  public async onExecuteAsync(): Promise<AddonResult | void> {
    void this;
    return undefined;
  }
}

describe('Addon message resolver', () => {
  it('resolves core add-on messages', () => {
    const runtime = createAddonRuntime();
    const module = new TestAddonModule(runtime);
    module.context = createContext('core:Test', true);

    const message = runtime.createFormattedMessage(module, 'ExportFiles_RetrievedRecords', '5');
    assert.ok(message.includes('Fetched 5 records'));
  });

  it('resolves custom messages per module', async () => {
    const runtime = createAddonRuntime();

    const tempDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'sfdmu-addon-msg-a-'));
    const tempDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'sfdmu-addon-msg-b-'));

    const messagesPathA = await createMessagesFileAsync(tempDirA, '# Custom_Key\n\nHello %s');
    const messagesPathB = await createMessagesFileAsync(tempDirB, '# Custom_Key\n\nHola %s');

    const moduleA = new TestAddonModule(runtime);
    moduleA.context = createContext('custom:ModuleA');
    const moduleB = new TestAddonModule(runtime);
    moduleB.context = createContext('custom:ModuleB');

    await runtime.registerAddonMessagesAsync(moduleA, messagesPathA);
    await runtime.registerAddonMessagesAsync(moduleB, messagesPathB);

    const messageA = runtime.createFormattedMessage(moduleA, 'Custom_Key', 'Alpha');
    const messageB = runtime.createFormattedMessage(moduleB, 'Custom_Key', 'Beta');

    assert.ok(messageA.includes('Hello Alpha'));
    assert.ok(messageB.includes('Hola Beta'));
  });

  it('does not resolve core bundle messages for custom add-ons', () => {
    const runtime = createAddonRuntime();
    const module = new TestAddonModule(runtime);
    module.context = createContext('custom:NoCore', false);

    const message = runtime.createFormattedMessage(module, 'ExportFiles_RetrievedRecords', '5');
    assert.ok(message.includes('ExportFiles_RetrievedRecords'));
  });

  it('falls back to logging messages when custom messages are missing', () => {
    const runtime = createAddonRuntime();
    const module = new TestAddonModule(runtime);
    module.context = createContext('custom:Fallback');

    const message = runtime.createFormattedMessage(module, 'noRecords');
    assert.ok(message.includes('No records'));
  });
});
