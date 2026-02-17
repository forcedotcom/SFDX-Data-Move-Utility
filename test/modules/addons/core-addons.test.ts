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
import { Common } from '../../../src/modules/common/Common.js';
import { ADDON_EVENTS } from '../../../src/modules/common/Enumerations.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import MigrationJobTask from '../../../src/modules/models/job/MigrationJobTask.js';
import ScriptAddonManifestDefinition from '../../../src/modules/models/script/ScriptAddonManifestDefinition.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';
import SfdmuRunAddonManager from '../../../src/modules/addons/SfdmuRunAddonManager.js';

const createLoggingService = (): LoggingService => {
  const context = new LoggingContext({
    commandName: 'run',
    rootPath: os.tmpdir(),
    fileLogEnabled: false,
  });
  return new LoggingService(context);
};

describe('Core add-ons', () => {
  let originalLogger: typeof Common.logger;

  const executeBadWordsFilterAsync = async (
    settings: Record<string, unknown>,
    records: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sfdmu-core-addon-'));
    const badwordsPath = path.join(tempDir, 'badwords.json');
    await fs.writeFile(badwordsPath, JSON.stringify({ badwords: ['foo'] }));

    const scriptObject = new ScriptObject('Account');
    scriptObject.filterRecordsAddons = [
      new ScriptAddonManifestDefinition({
        module: 'core:RecordsFilter',
        args: {
          filterType: 'BadWords',
          settings: {
            badwordsFile: 'badwords.json',
            detectFields: ['Name'],
            outputMatches: false,
            ...settings,
          },
        },
      }),
    ];

    const script = new Script();
    script.basePath = tempDir;
    script.logger = createLoggingService();
    script.objectSets = [new ScriptObjectSet([scriptObject])];

    const job = new MigrationJob({ script });
    script.job = job;
    const task = new MigrationJobTask({ job, scriptObject });
    task.tempRecords = records;
    job.tasks = [task];

    const manager = new SfdmuRunAddonManager(script);
    await manager.initializeAsync();
    const executed = await manager.triggerAddonModuleMethodAsync(ADDON_EVENTS.filterRecordsAddons, 'Account');
    assert.equal(executed, true, 'Core add-on did not execute');
    return task.tempRecords;
  };

  beforeEach(() => {
    originalLogger = Common.logger;
    Common.logger = createLoggingService();
  });

  afterEach(() => {
    Common.logger = originalLogger;
  });

  it('executes core RecordsFilter (BadWords) add-on', async () => {
    const filteredRecords = await executeBadWordsFilterAsync({}, [
      { Name: 'Bad foo', Description: 'contains foo' },
      { Name: 'Good', Description: 'clean' },
    ]);

    assert.equal(filteredRecords.length, 1);
    assert.equal(filteredRecords[0]?.['Name'], 'Bad foo');
  });

  it('accepts highlightWords only as boolean', async () => {
    const filteredRecords = await executeBadWordsFilterAsync({ highlightWords: '[[[$1]]]' }, [
      { Name: 'Bad foo', Description: 'contains foo' },
      { Name: 'Good', Description: 'clean' },
    ]);

    assert.equal(filteredRecords.length, 1);
    assert.equal(filteredRecords[0]?.['Name'], 'Bad foo');
  });
});
