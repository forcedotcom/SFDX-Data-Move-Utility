/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import { OPERATION } from '../../../src/modules/common/Enumerations.js';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import MigrationJobTask from '../../../src/modules/models/job/MigrationJobTask.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';

type DmlSettingsType = {
  alwaysUseRest: boolean;
  bulkThreshold: number;
  restApiBatchSizeOverride?: number;
};

const createTask = (): MigrationJobTask => {
  const script = new Script();
  const job = new MigrationJob({ script });
  const scriptObject = new ScriptObject('Account');
  return new MigrationJobTask({ job, scriptObject });
};

const resolveDmlSettings = (task: MigrationJobTask, operation: OPERATION): DmlSettingsType =>
  (
    task as unknown as {
      _resolveDmlExecutionSettings: (nextOperation: OPERATION) => DmlSettingsType;
    }
  )._resolveDmlExecutionSettings(operation);

describe('MigrationJobTask dml execution settings', () => {
  it('forces rest one-by-one for delete when respectOrderByOnDeleteRecords is enabled', () => {
    const task = createTask();
    task.scriptObject.respectOrderByOnDeleteRecords = true;

    const settings = resolveDmlSettings(task, OPERATION.Delete);
    assert.equal(settings.alwaysUseRest, true);
    assert.equal(settings.restApiBatchSizeOverride, 1);
  });

  it('does not force rest one-by-one for non-delete operations', () => {
    const task = createTask();
    task.scriptObject.respectOrderByOnDeleteRecords = true;

    const settings = resolveDmlSettings(task, OPERATION.Update);
    assert.equal(settings.alwaysUseRest, false);
    assert.equal(settings.restApiBatchSizeOverride, undefined);
  });

  it('forces bulk threshold zero when alwaysUseBulkApiToUpdateRecords is enabled', () => {
    const task = createTask();
    task.job.script.bulkThreshold = 200;
    task.scriptObject.alwaysUseBulkApiToUpdateRecords = true;

    const settings = resolveDmlSettings(task, OPERATION.Update);
    assert.equal(settings.bulkThreshold, 0);
    assert.equal(settings.alwaysUseRest, false);
  });

  it('keeps rest precedence over object bulk toggles', () => {
    const task = createTask();
    task.job.script.bulkThreshold = 200;
    task.scriptObject.alwaysUseBulkApiToUpdateRecords = true;
    task.scriptObject.alwaysUseBulkApi = true;
    task.scriptObject.alwaysUseRestApi = true;

    const settings = resolveDmlSettings(task, OPERATION.Update);
    assert.equal(settings.alwaysUseRest, true);
    assert.equal(settings.bulkThreshold, 200);
  });
});
