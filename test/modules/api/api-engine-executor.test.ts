/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import type { Connection } from '@jsforce/jsforce-node';
import { OPERATION } from '../../../src/modules/common/Enumerations.js';
import { ERRORS_FIELD_NAME } from '../../../src/modules/constants/Constants.js';
import ApiEngineExecutor from '../../../src/modules/api/ApiEngineExecutor.js';
import RestApiEngine from '../../../src/modules/api/engines/RestApiEngine.js';
import type { LoggerType } from '../../../src/modules/logging/LoggerType.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';

describe('ApiEngineExecutor', () => {
  it('executes REST batches and updates Ids', async () => {
    let createCalls = 0;
    let idCounter = 1;

    const connection = {
      sobject: () => ({
        create: async (records: Array<Record<string, unknown>>) => {
          createCalls += 1;
          return records.map(() => ({
            success: true,
            id: `00A${idCounter++}`,
          }));
        },
        update: async () => [],
        upsert: async () => [],
        destroy: async () => [],
      }),
    } as unknown as Connection;

    const script = new Script();
    script.restApiBatchSize = 1;

    const scriptObject = new ScriptObject('Account');
    scriptObject.script = script;
    scriptObject.restApiBatchSize = 1;

    const logger: LoggerType = {
      log: () => undefined,
      logColored: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      verboseFile: () => undefined,
      yesNoPromptAsync: async () => true,
      textPromptAsync: async () => '',
      getResourceString: (key: string) => key,
    };

    const engine = new RestApiEngine({ connection, sObjectName: 'Account' });
    const records: Array<Record<string, unknown>> = [{ Name: 'A' }, { Name: 'B' }];

    const executor = new ApiEngineExecutor({
      engine,
      operation: OPERATION.Insert,
      records,
      updateRecordId: true,
      logger,
      script,
      scriptObject,
    });

    const result = await executor.executeCrudAsync();

    assert.equal(createCalls, 2);
    assert.equal(result[0]?.Id, '00A1');
    assert.equal(result[1]?.Id, '00A2');
    assert.equal(result[0]?.[ERRORS_FIELD_NAME], null);
    assert.equal(result[1]?.[ERRORS_FIELD_NAME], null);
  });
});
