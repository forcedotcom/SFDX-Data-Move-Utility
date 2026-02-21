/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import MigrationJobTask from '../../../src/modules/models/job/MigrationJobTask.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';

const createTask = (): MigrationJobTask => {
  const script = new Script();
  const job = new MigrationJob({ script });
  const scriptObject = new ScriptObject('Account');
  return new MigrationJobTask({ job, scriptObject });
};

describe('TaskOrgData bulk query selection', () => {
  it('uses bulk query when total count equals threshold', () => {
    const task = createTask();
    task.job.script.queryBulkApiThreshold = 100;
    task.sourceData.totalRecordCount = 100;

    assert.equal(task.sourceData.useBulkQueryApi, true);
  });

  it('uses bulk query when threshold is zero', () => {
    const task = createTask();
    task.job.script.queryBulkApiThreshold = 0;
    task.sourceData.totalRecordCount = 0;

    assert.equal(task.sourceData.useBulkQueryApi, true);
  });

  it('forces rest query when alwaysUseRestApi is enabled on object', () => {
    const task = createTask();
    task.job.script.queryBulkApiThreshold = 0;
    task.sourceData.totalRecordCount = 100;
    task.scriptObject.alwaysUseRestApi = true;

    assert.equal(task.sourceData.useBulkQueryApi, false);
  });

  it('forces bulk query when alwaysUseBulkApi is enabled on object', () => {
    const task = createTask();
    task.job.script.queryBulkApiThreshold = 1000;
    task.sourceData.totalRecordCount = 1;
    task.scriptObject.alwaysUseBulkApi = true;

    assert.equal(task.sourceData.useBulkQueryApi, true);
  });
});
