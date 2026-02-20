/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Common } from '../../../src/modules/common/Common.js';
import { ADDON_EVENTS, DATA_MEDIA_TYPE, OPERATION } from '../../../src/modules/common/Enumerations.js';
import {
  __ID_FIELD_NAME,
  __IS_PROCESSED_FIELD_NAME,
  __SOURCE_ID_FIELD_NAME,
  TARGET_CSV_OLD_ID_FIELD_NAME,
} from '../../../src/modules/constants/Constants.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import MigrationJobTask from '../../../src/modules/models/job/MigrationJobTask.js';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import Script from '../../../src/modules/models/script/Script.js';
import type { LookupIdMapType } from '../../../src/modules/models/script/LookupIdMapType.js';
import ScriptMockField from '../../../src/modules/models/script/ScriptMockField.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import SFieldDescribe from '../../../src/modules/models/sf/SFieldDescribe.js';
import SObjectDescribe from '../../../src/modules/models/sf/SObjectDescribe.js';
import CjsDependencyAdapters from '../../../src/modules/dependencies/CjsDependencyAdapters.js';
import OrgDataService from '../../../src/modules/org/OrgDataService.js';

type TaskFixtureType = {
  task: MigrationJobTask;
};

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-task-'));

type FieldInitType = Partial<SFieldDescribe> & { name: string };

const createDescribe = (objectName: string, fields: FieldInitType[]): SObjectDescribe => {
  const describe = new SObjectDescribe({ name: objectName });
  fields.forEach((field) => {
    describe.addField(
      new SFieldDescribe({
        ...field,
        isDescribed: true,
      })
    );
  });
  return describe;
};

const createLoggingService = (): LoggingService => {
  const context = new LoggingContext({
    commandName: 'run',
    rootPath: os.tmpdir(),
    fileLogEnabled: false,
  });
  return new LoggingService(context);
};

const createTaskFixture = (): TaskFixtureType => {
  const script = new Script();
  const job = new MigrationJob({ script });
  const scriptObject = new ScriptObject('Account');
  const task = new MigrationJobTask({ job, scriptObject });
  return { task };
};

const createMap = (pairs: Array<[string, string]>): LookupIdMapType => new Map(pairs);

describe('MigrationJobTask field capability warnings', () => {
  it('warns only for explicit update query fields that are not updateable', () => {
    const originalLogger = Common.logger;
    const { task } = createTaskFixture();
    const logger = createLoggingService();
    const warnCalls: string[] = [];
    const originalWarn = logger.warn.bind(logger) as (...args: unknown[]) => void;
    logger.warn = ((message: string, ...tokens: string[]) => {
      warnCalls.push(message);
      originalWarn(message, ...tokens);
    }) as typeof logger.warn;

    Common.logger = logger;
    task.job.script.logger = logger;
    task.scriptObject.operation = OPERATION.Update;

    (
      task.scriptObject as unknown as {
        _originalFieldsInQuery: string[];
      }
    )._originalFieldsInQuery = ['Explicit__c'];

    const resolveFieldsToRemove = (
      task as unknown as {
        _resolveFieldsToRemove: (
          processedData: { fields: SFieldDescribe[] },
          fieldsToCompareRecords: string[]
        ) => { notInsertableFields: string[]; notUpdateableFields: string[] };
      }
    )._resolveFieldsToRemove.bind(task);

    try {
      resolveFieldsToRemove(
        {
          fields: [
            new SFieldDescribe({
              name: 'Explicit__c',
              isDescribed: true,
              creatable: true,
              updateable: false,
            }),
            new SFieldDescribe({
              name: 'AutoAdded__c',
              isDescribed: true,
              creatable: true,
              updateable: false,
            }),
          ],
        },
        []
      );

      assert.equal(warnCalls.filter((key) => key === 'queryFieldNotWritableForOperationExcluded').length, 1);
    } finally {
      Common.logger = originalLogger;
    }
  });

  it('does not emit writeability warnings for delete operation', () => {
    const originalLogger = Common.logger;
    const { task } = createTaskFixture();
    const logger = createLoggingService();
    const warnCalls: string[] = [];
    const originalWarn = logger.warn.bind(logger) as (...args: unknown[]) => void;
    logger.warn = ((message: string, ...tokens: string[]) => {
      warnCalls.push(message);
      originalWarn(message, ...tokens);
    }) as typeof logger.warn;

    Common.logger = logger;
    task.job.script.logger = logger;
    task.scriptObject.operation = OPERATION.Delete;

    (
      task.scriptObject as unknown as {
        _originalFieldsInQuery: string[];
      }
    )._originalFieldsInQuery = ['Explicit__c'];

    const resolveFieldsToRemove = (
      task as unknown as {
        _resolveFieldsToRemove: (
          processedData: { fields: SFieldDescribe[] },
          fieldsToCompareRecords: string[]
        ) => { notInsertableFields: string[]; notUpdateableFields: string[] };
      }
    )._resolveFieldsToRemove.bind(task);

    try {
      resolveFieldsToRemove(
        {
          fields: [
            new SFieldDescribe({
              name: 'Explicit__c',
              isDescribed: true,
              creatable: false,
              updateable: false,
            }),
          ],
        },
        []
      );

      assert.equal(warnCalls.includes('queryFieldNotWritableForOperationExcluded'), false);
    } finally {
      Common.logger = originalLogger;
    }
  });

  it('warns for explicit insert query fields that are not createable', () => {
    const originalLogger = Common.logger;
    const { task } = createTaskFixture();
    const logger = createLoggingService();
    const warnCalls: string[] = [];
    const originalWarn = logger.warn.bind(logger) as (...args: unknown[]) => void;
    logger.warn = ((message: string, ...tokens: string[]) => {
      warnCalls.push(message);
      originalWarn(message, ...tokens);
    }) as typeof logger.warn;

    Common.logger = logger;
    task.job.script.logger = logger;
    task.scriptObject.operation = OPERATION.Insert;

    (
      task.scriptObject as unknown as {
        _originalFieldsInQuery: string[];
      }
    )._originalFieldsInQuery = ['Explicit__c'];

    const resolveFieldsToRemove = (
      task as unknown as {
        _resolveFieldsToRemove: (
          processedData: { fields: SFieldDescribe[] },
          fieldsToCompareRecords: string[]
        ) => { notInsertableFields: string[]; notUpdateableFields: string[] };
      }
    )._resolveFieldsToRemove.bind(task);

    try {
      resolveFieldsToRemove(
        {
          fields: [
            new SFieldDescribe({
              name: 'Explicit__c',
              isDescribed: true,
              creatable: false,
              updateable: true,
            }),
          ],
        },
        []
      );

      assert.equal(warnCalls.includes('queryFieldNotWritableForOperationExcluded'), true);
    } finally {
      Common.logger = originalLogger;
    }
  });

  it('writes detailed diagnostic reasons for DML field exclusions', () => {
    const originalLogger = Common.logger;
    const { task } = createTaskFixture();
    const logger = createLoggingService();
    const verboseCalls: string[] = [];
    const originalVerboseFile = logger.verboseFile.bind(logger) as (...args: unknown[]) => void;
    logger.verboseFile = ((message: string, ...tokens: string[]) => {
      verboseCalls.push(typeof message === 'string' ? message : String(message));
      originalVerboseFile(message, ...tokens);
    }) as typeof logger.verboseFile;

    Common.logger = logger;
    task.job.script.logger = logger;
    task.scriptObject.operation = OPERATION.Upsert;

    const resolveFieldsToRemove = (
      task as unknown as {
        _resolveFieldsToRemove: (
          processedData: { fields: SFieldDescribe[] },
          fieldsToCompareRecords: string[]
        ) => { notInsertableFields: string[]; notUpdateableFields: string[] };
      }
    )._resolveFieldsToRemove.bind(task);

    try {
      resolveFieldsToRemove(
        {
          fields: [
            new SFieldDescribe({
              name: 'Readonly__c',
              isDescribed: true,
              creatable: false,
              updateable: false,
            }),
          ],
        },
        ['CompareOnly__c']
      );

      assert.equal(
        verboseCalls.some(
          (line) =>
            line.includes('[diagnostic] DML field excluded:') &&
            line.includes('field=Readonly__c') &&
            line.includes('not createable for Insert operation')
        ),
        true
      );
      assert.equal(
        verboseCalls.some(
          (line) =>
            line.includes('[diagnostic] DML field excluded:') &&
            line.includes('field=Readonly__c') &&
            line.includes('not updateable for Update operation')
        ),
        true
      );
      assert.equal(
        verboseCalls.some(
          (line) =>
            line.includes('[diagnostic] DML field excluded:') &&
            line.includes('field=CompareOnly__c') &&
            line.includes('used only for comparison')
        ),
        true
      );
    } finally {
      Common.logger = originalLogger;
    }
  });

  it('writes person-account field exclusion reasons to diagnostic log', () => {
    const originalLogger = Common.logger;
    const { task } = createTaskFixture();
    const logger = createLoggingService();
    const verboseCalls: string[] = [];
    const originalVerboseFile = logger.verboseFile.bind(logger) as (...args: unknown[]) => void;
    logger.verboseFile = ((message: string, ...tokens: string[]) => {
      verboseCalls.push(typeof message === 'string' ? message : String(message));
      originalVerboseFile(message, ...tokens);
    }) as typeof logger.verboseFile;

    Common.logger = logger;
    task.job.script.logger = logger;
    task.scriptObject.name = 'Account';
    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.script = task.job.script;
    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.script = task.job.script;
    task.job.script.sourceOrg = sourceOrg;
    task.job.script.targetOrg = targetOrg;

    const applyPersonAccountFieldFiltering = (
      task as unknown as {
        _applyPersonAccountFieldFiltering: (
          fields: SFieldDescribe[],
          processPersonAccounts: boolean
        ) => { shouldProcess: boolean; fields: SFieldDescribe[] };
      }
    )._applyPersonAccountFieldFiltering.bind(task);

    try {
      applyPersonAccountFieldFiltering(
        [
          new SFieldDescribe({ name: 'Name' }),
          new SFieldDescribe({ name: 'PersonEmail', custom: false }),
          new SFieldDescribe({ name: 'Custom__c' }),
        ],
        false
      );
      applyPersonAccountFieldFiltering([new SFieldDescribe({ name: 'Name' })], true);

      assert.equal(
        verboseCalls.some(
          (line) => line.includes('{Account.PersonEmail}') && line.includes('person-account field is not valid')
        ),
        true
      );
      assert.equal(
        verboseCalls.some(
          (line) => line.includes('{Account.Name}') && line.includes('not valid for person-account DML')
        ),
        true
      );
    } finally {
      Common.logger = originalLogger;
    }
  });
});

describe('MigrationJobTask polymorphic lookup matching', () => {
  it('merges User and Group maps for polymorphic fields without explicit target', () => {
    const { task } = createTaskFixture();
    const field = new SFieldDescribe({ name: 'OwnerId', lookup: true, isPolymorphicField: true });
    const userMap = createMap([
      ['sharedKey', 'userId'],
      ['userKey', 'userOnly'],
    ]);
    const groupMap = createMap([
      ['sharedKey', 'groupId'],
      ['groupKey', 'groupOnly'],
    ]);
    const defaultMap = createMap([]);

    const sharedId = task.resolveLookupIdValue(field, 'sharedKey', userMap, groupMap, defaultMap);
    const userId = task.resolveLookupIdValue(field, 'userKey', userMap, groupMap, defaultMap);
    const groupId = task.resolveLookupIdValue(field, 'groupKey', userMap, groupMap, defaultMap);

    assert.equal(sharedId, 'userId');
    assert.equal(userId, 'userOnly');
    assert.equal(groupId, 'groupOnly');
  });

  it('uses explicit polymorphic target map when provided', () => {
    const { task } = createTaskFixture();
    const field = new SFieldDescribe({
      name: 'OwnerId',
      lookup: true,
      isPolymorphicField: true,
      polymorphicReferenceObjectType: 'Group',
    });
    const userMap = createMap([['sharedKey', 'userId']]);
    const groupMap = createMap([['sharedKey', 'groupId']]);
    const defaultMap = createMap([]);

    const resolved = task.resolveLookupIdValue(field, 'sharedKey', userMap, groupMap, defaultMap);

    assert.equal(resolved, 'groupId');
  });

  it('uses the default map for non-polymorphic fields', () => {
    const { task } = createTaskFixture();
    const field = new SFieldDescribe({ name: 'AccountId', lookup: true, isPolymorphicField: false });
    const userMap = createMap([['key', 'userId']]);
    const groupMap = createMap([['key', 'groupId']]);
    const defaultMap = createMap([['key', 'defaultId']]);

    const resolved = task.resolveLookupIdValue(field, 'key', userMap, groupMap, defaultMap);

    assert.equal(resolved, 'defaultId');
  });
});

describe('MigrationJobTask retrieval', () => {
  it('retrieves source records from CSV for forward pass', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Id, Name FROM Account';
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    fs.mkdirSync(script.sourceDirectoryPath, { recursive: true });
    fs.writeFileSync(task.data.sourceCsvFilename, 'Id,Name\n001,Acme\n', 'utf8');

    try {
      const hasRecords = await task.retrieveRecordsAsync('forwards', false);

      assert.equal(hasRecords, true);
      assert.equal(task.sourceData.idRecordsMap.size, 1);
      assert.equal(task.sourceData.extIdToRecordIdMap.get('001'), '001');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('applies sourceRecordsFilter when retrieving from CSV source', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Id, Name FROM Account';
    scriptObject.sourceRecordsFilter = "Name <> 'Skip'";
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    fs.mkdirSync(script.sourceDirectoryPath, { recursive: true });
    fs.writeFileSync(task.data.sourceCsvFilename, 'Id,Name\n001,Keep\n002,Skip\n', 'utf8');

    try {
      const hasRecords = await task.retrieveRecordsAsync('forwards', false);

      assert.equal(hasRecords, true);
      assert.equal(task.sourceData.idRecordsMap.size, 1);
      assert.equal(task.sourceData.idRecordsMap.has('001'), true);
      assert.equal(task.sourceData.idRecordsMap.has('002'), false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('retrieves records for delete-by-hierarchy operations', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.operation = OPERATION.DeleteHierarchy;
    scriptObject.externalId = 'Name';
    scriptObject.query = 'SELECT Id, Name FROM Account';
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    fs.mkdirSync(script.sourceDirectoryPath, { recursive: true });
    fs.writeFileSync(task.data.sourceCsvFilename, 'Id,Name\n001,Delete Me\n', 'utf8');

    try {
      const hasRecords = await task.retrieveRecordsAsync('forwards', false);

      assert.equal(hasRecords, true);
      assert.equal(task.sourceData.idRecordsMap.size, 1);
      assert.equal(task.scriptObject.operation, OPERATION.Delete);
      assert.equal(task.scriptObject.deleteByHierarchy, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('removes target WHERE clause for delete-by-hierarchy target queries', () => {
    const script = new Script();

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.operation = OPERATION.DeleteHierarchy;
    scriptObject.externalId = 'Name';
    scriptObject.query = "SELECT Id, Name FROM Account WHERE Name = 'Parent'";
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const targetQuery = task.createQuery(undefined, false, undefined, false, true);
    assert.equal(targetQuery.includes('WHERE'), false);
    assert.equal(targetQuery, 'SELECT Id, Name FROM Account');
  });

  it('retrieves source records from org for processAllSource mode', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.name = 'source';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Id, Name FROM Account';
    scriptObject.processAllSource = true;
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalQueryOrgAsync = OrgDataService.prototype.queryOrgAsync;
    OrgDataService.prototype.queryOrgAsync = async () => [{ Id: '001', Name: 'Acme' }];

    try {
      const hasRecords = await task.retrieveRecordsAsync('forwards', false);

      assert.equal(hasRecords, true);
      assert.equal(task.sourceData.idRecordsMap.size, 1);
      assert.equal(task.sourceData.extIdToRecordIdMap.get('001'), '001');
    } finally {
      OrgDataService.prototype.queryOrgAsync = originalQueryOrgAsync;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('MigrationJobTask person account updates', () => {
  it('splits business vs person accounts and enforces name rules', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.simulationMode = true;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.name = 'source';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    sourceOrg.isPersonAccountEnabled = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    targetOrg.isPersonAccountEnabled = true;
    script.targetOrg = targetOrg;

    const accountObject = new ScriptObject('Account');
    accountObject.operation = OPERATION.Upsert;
    accountObject.externalId = 'Id';
    accountObject.query = 'SELECT Id, Name, FirstName, LastName, IsPersonAccount FROM Account';
    accountObject.setup(script);

    const accountDescribe = createDescribe('Account', [
      { name: 'Id', updateable: true, creatable: true, type: 'id' },
      { name: 'Name', updateable: true, creatable: true, nameField: true, type: 'string' },
      { name: 'FirstName', updateable: true, creatable: true, type: 'string' },
      { name: 'LastName', updateable: true, creatable: true, type: 'string' },
      { name: 'IsPersonAccount', updateable: true, creatable: true, type: 'boolean' },
    ]);
    accountObject.applyDescribe(accountDescribe, accountDescribe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject: accountObject });
    job.tasks = [task];
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const businessAccount = {
      Id: '001B00000000001',
      FirstName: 'Biz',
      LastName: 'Account',
      IsPersonAccount: false,
      Name: '',
    };
    const personAccount = {
      Id: '001P00000000001',
      Name: 'Jane Doe',
      IsPersonAccount: true,
    };
    task.registerRecords([businessAccount, personAccount], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 2);

      const businessTarget = task.sourceToTargetRecordMap.get(businessAccount);
      assert.ok(businessTarget);
      assert.equal(businessTarget?.Name, 'Biz Account');
      assert.equal(Object.prototype.hasOwnProperty.call(businessTarget ?? {}, 'FirstName'), false);

      const personTarget = task.sourceToTargetRecordMap.get(personAccount);
      assert.ok(personTarget);
      assert.equal(personTarget?.FirstName, 'Jane');
      assert.equal(personTarget?.LastName, 'Doe');
      assert.equal(Object.prototype.hasOwnProperty.call(personTarget ?? {}, 'Name'), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('backfills person contacts after person account insert', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.simulationMode = true;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.name = 'source';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    sourceOrg.isPersonAccountEnabled = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    targetOrg.isPersonAccountEnabled = true;
    script.targetOrg = targetOrg;

    const accountObject = new ScriptObject('Account');
    accountObject.operation = OPERATION.Upsert;
    accountObject.externalId = 'Id';
    accountObject.query = 'SELECT Id, Name, FirstName, LastName, IsPersonAccount FROM Account';
    accountObject.setup(script);

    const contactObject = new ScriptObject('Contact');
    contactObject.operation = OPERATION.Upsert;
    contactObject.externalId = 'Id';
    contactObject.query = 'SELECT Id, AccountId, Name, IsPersonAccount FROM Contact';
    contactObject.setup(script);

    const accountDescribe = createDescribe('Account', [
      { name: 'Id', updateable: true, creatable: true, type: 'id' },
      { name: 'Name', updateable: true, creatable: true, nameField: true, type: 'string' },
      { name: 'FirstName', updateable: true, creatable: true, type: 'string' },
      { name: 'LastName', updateable: true, creatable: true, type: 'string' },
      { name: 'IsPersonAccount', updateable: true, creatable: true, type: 'boolean' },
    ]);
    const contactDescribe = createDescribe('Contact', [
      { name: 'Id', updateable: true, creatable: true, type: 'id' },
      {
        name: 'AccountId',
        updateable: true,
        creatable: true,
        lookup: true,
        referencedObjectType: 'Account',
      },
      { name: 'Name', updateable: true, creatable: true, type: 'string' },
      { name: 'IsPersonAccount', updateable: true, creatable: true, type: 'boolean' },
    ]);
    accountObject.applyDescribe(accountDescribe, accountDescribe);
    contactObject.applyDescribe(contactDescribe, contactDescribe);

    const job = new MigrationJob({ script });
    const accountTask = new MigrationJobTask({ job, scriptObject: accountObject });
    const contactTask = new MigrationJobTask({ job, scriptObject: contactObject });
    job.tasks = [accountTask, contactTask];
    accountTask.data.refreshFromScriptObject();
    contactTask.data.refreshFromScriptObject();
    accountTask.refreshPreflightState();
    contactTask.refreshPreflightState();

    const sourceAccount = { Id: '001P00000000001', Name: 'Jane Doe', IsPersonAccount: true };
    accountTask.registerRecords([sourceAccount], accountTask.sourceData, false);

    const sourceContact: Record<string, unknown> = {
      Id: '003P00000000001',
      AccountId: '001P00000000001',
      Name: 'Jane Doe',
      IsPersonAccount: true,
    };
    contactTask.registerRecords([sourceContact], contactTask.sourceData, false);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalQueryOrgAsync = OrgDataService.prototype.queryOrgAsync;
    OrgDataService.prototype.queryOrgAsync = async (query: string): Promise<Array<Record<string, unknown>>> => {
      const match = query.match(/AccountId\s+IN\s*\(([^)]+)\)/i);
      const ids =
        match?.[1]
          ?.split(',')
          .map((value) => value.trim().replace(/['"]/g, ''))
          .filter((value) => value.length > 0) ?? [];
      const accountId = ids[0] ?? '001P00000000001';
      return [{ Id: '003T00000000001', AccountId: accountId }];
    };

    try {
      const processed = await accountTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetAccount = accountTask.sourceToTargetRecordMap.get(sourceAccount);
      assert.ok(targetAccount);
      const mappedContact = contactTask.sourceToTargetRecordMap.get(sourceContact);
      assert.ok(mappedContact);
      assert.equal(mappedContact?.AccountId, targetAccount?.Id);
      assert.equal(sourceContact[__IS_PROCESSED_FIELD_NAME], true);
    } finally {
      OrgDataService.prototype.queryOrgAsync = originalQueryOrgAsync;
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('MigrationJobTask file target output', () => {
  it('uses locale-specific casual generator for mock fields', () => {
    const { task } = createTaskFixture();
    task.scriptObject.updateWithMockData = true;

    const localizedMock = new ScriptMockField();
    localizedMock.name = 'Name';
    localizedMock.pattern = 'first_name';
    localizedMock.locale = 'ru_RU';

    const fallbackMock = new ScriptMockField();
    fallbackMock.name = 'Alias__c';
    fallbackMock.pattern = 'first_name';
    fallbackMock.locale = 'unknown_LOCALE';

    task.scriptObject.mockFields = [localizedMock, fallbackMock];

    const createCasualGenerator = (
      firstName: string
    ): Record<string, unknown> & {
      define: (name: string, generator: (...args: unknown[]) => unknown) => void;
    } => {
      const generator = {} as Record<string, unknown> & {
        define: (name: string, generator: (...args: unknown[]) => unknown) => void;
      };
      generator['first_name'] = firstName;
      generator.define = (name: string, valueGenerator: (...args: unknown[]) => unknown) => {
        Object.defineProperty(generator, name, {
          configurable: true,
          enumerable: true,
          get: () => valueGenerator(),
        });
      };
      return generator;
    };

    const baseGenerator = createCasualGenerator('John');
    baseGenerator['ru_RU'] = createCasualGenerator('Ivan');

    const originalGetCasualDescriptor = Object.getOwnPropertyDescriptor(CjsDependencyAdapters, 'getCasual');
    Object.defineProperty(CjsDependencyAdapters, 'getCasual', {
      configurable: true,
      value: (() => baseGenerator) as typeof CjsDependencyAdapters.getCasual,
    });

    const applyMocking = (
      task as unknown as {
        _applyMocking: (
          records: Array<Record<string, unknown>>,
          fields: SFieldDescribe[]
        ) => Array<Record<string, unknown>>;
      }
    )._applyMocking.bind(task);

    try {
      const records = [
        {
          Name: 'Original Name',
          ['Alias__c']: 'Original Alias',
        },
      ];
      const fields = [new SFieldDescribe({ name: 'Name' }), new SFieldDescribe({ name: 'Alias__c' })];
      const mockedRecords = applyMocking(records, fields);

      assert.equal(mockedRecords[0].Name, 'Ivan');
      assert.equal(mockedRecords[0]['Alias__c'], 'John');
    } finally {
      if (originalGetCasualDescriptor) {
        Object.defineProperty(CjsDependencyAdapters, 'getCasual', originalGetCasualDescriptor);
      }
    }
  });

  it('does not mock internal id fields when mockFields name is all', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.simulationMode = true;
    script.createTargetCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.name = 'source';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.name = 'target';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject3__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Name';
    scriptObject.skipRecordsComparison = true;
    scriptObject.updateWithMockData = true;
    scriptObject.query = 'SELECT Id, Name, Test__c, Test2__c, an__c, Date__c FROM TestObject3__c';
    const mockAll = new ScriptMockField();
    mockAll.name = 'all';
    mockAll.pattern = "c_set_value('FT59_MOCKED')";
    mockAll.excludeNames = ['Name', 'Date__c'];
    scriptObject.mockFields = [mockAll];
    scriptObject.setup(script);

    const describe = createDescribe('TestObject3__c', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Test__c', type: 'string', updateable: true, creatable: true },
      { name: 'Test2__c', type: 'string', updateable: true, creatable: true },
      { name: 'an__c', type: 'string', updateable: true, creatable: true },
      { name: 'Date__c', type: 'date', updateable: true, creatable: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const buildMockFieldRuntimeMap = (
      task as unknown as {
        _buildMockFieldRuntimeMap: (
          fields: SFieldDescribe[],
          recordFields: string[]
        ) => Map<string, { fn: string; regExcl: string; regIncl: string }>;
      }
    )._buildMockFieldRuntimeMap.bind(task);

    try {
      const fieldsToMock = [
        new SFieldDescribe({ name: 'Id', type: 'id' }),
        new SFieldDescribe({ name: 'Name', type: 'string' }),
        new SFieldDescribe({ name: 'Test__c', type: 'string' }),
        new SFieldDescribe({ name: __ID_FIELD_NAME, type: 'string' }),
        new SFieldDescribe({ name: __SOURCE_ID_FIELD_NAME, type: 'string' }),
        new SFieldDescribe({ name: __IS_PROCESSED_FIELD_NAME, type: 'boolean' }),
      ];
      const runtimeMap = buildMockFieldRuntimeMap(fieldsToMock, [
        'Id',
        'Name',
        'Test__c',
        __ID_FIELD_NAME,
        __SOURCE_ID_FIELD_NAME,
        __IS_PROCESSED_FIELD_NAME,
      ]);

      assert.equal(runtimeMap.has('Test__c'), true);
      assert.equal(runtimeMap.has('Id'), false);
      assert.equal(runtimeMap.has(__ID_FIELD_NAME), false);
      assert.equal(runtimeMap.has(__SOURCE_ID_FIELD_NAME), false);
      assert.equal(runtimeMap.has(__IS_PROCESSED_FIELD_NAME), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes plain target CSV files for file targets and preserves lookup values', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Id, Name, Parent__c FROM TestObject__c';
    scriptObject.setup(script);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const sourceRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Example',
    };
    sourceRecord['Parent__c'] = '001000000000001';
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c');
      assert.ok(fs.existsSync(targetFile));
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['Parent__c'], '001000000000001');
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('adds externalId fields to file target output when missing from query', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('Account');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'ExternalId__c';
    scriptObject.query = 'SELECT Name FROM Account';
    scriptObject.setup(script);

    const describe = createDescribe('Account', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      { name: 'ExternalId__c', updateable: true, creatable: true, custom: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const sourceRecord: Record<string, unknown> = {
      Id: '001000000000001',
      Name: 'Acme',
    };
    sourceRecord['ExternalId__c'] = 'EXT-001';
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'Account');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'ExternalId__c'));
      assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'Id'));
      assert.equal(rows[0]['ExternalId__c'], 'EXT-001');
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('replaces lookup ids with parent external ids when excludeIdsFromCSVFiles is true', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Upsert;
    parentObject.externalId = 'Name__c';
    parentObject.query = 'SELECT Name__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Upsert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name__c', updateable: true, creatable: true, custom: true },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentRecord['Name__c'] = 'Parent Name';
    parentTask.registerRecords([parentRecord], parentTask.sourceData, false);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const processed = await childTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'B__r.Name__c'));
      assert.equal(rows[0]['B__r.Name__c'], 'Parent Name');
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'B__c'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'Id'), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses projected parent external ids for child lookup columns in file output', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Insert;
    parentObject.externalId = 'Name__c';
    parentObject.query = 'SELECT Name__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Insert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name__c', updateable: true, creatable: true, custom: true },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentSourceRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentSourceRecord['Name__c'] = 'SOURCE-EXT';
    parentTask.registerRecords([parentSourceRecord], parentTask.sourceData, false);

    const parentProjectedRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentProjectedRecord['Name__c'] = 'PROJECTED-EXT';
    parentTask.sourceToTargetRecordMap.set(parentSourceRecord, parentProjectedRecord);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const processed = await childTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['B__r.Name__c'], 'PROJECTED-EXT');
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'B__c'), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('includes nested parent externalId paths in child csv when excludeIdsFromCSVFiles is true', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Upsert;
    parentObject.externalId = 'Name__c;Test__r.External_Id__c;Test2__r.Account__c';
    parentObject.query = 'SELECT Name__c, Test__r.External_Id__c, Test2__r.Account__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Upsert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name__c', updateable: true, creatable: true, custom: true },
      { name: 'Test__r.External_Id__c', updateable: true, creatable: true, custom: true },
      { name: 'Test2__r.Account__c', updateable: true, creatable: true, custom: true },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentRecord['Name__c'] = 'Parent Name';
    parentRecord['Test__r.External_Id__c'] = 'EXT-NESTED';
    parentRecord['Test2__r.Account__c'] = '001000000000001';
    parentTask.registerRecords([parentRecord], parentTask.sourceData, false);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const processed = await childTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['B__r.Name__c'], 'Parent Name');
      assert.equal(rows[0]['B__r.Test__r.External_Id__c'], 'EXT-NESTED');
      assert.equal(rows[0]['B__r.Test2__r.Account__c'], '001000000000001');
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'B__c'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'Id'), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps __r relationship fields and lookup ids when excludeIdsFromCSVFiles is false', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Upsert;
    parentObject.externalId = 'Name__c';
    parentObject.query = 'SELECT Name__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Upsert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c, B__r.Name__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name__c', updateable: true, creatable: true, custom: true },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentRecord['Name__c'] = 'Parent Name';
    parentTask.registerRecords([parentRecord], parentTask.sourceData, false);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childRecord['B__r.Name__c'] = 'Parent Name';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const processed = await childTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['B__c'], 'b00000000000001');
      assert.equal(rows[0]['B__r.Name__c'], 'Parent Name');
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'Id'), true);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('adds all parent external id relationship columns when excludeIdsFromCSVFiles is false', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Upsert;
    parentObject.externalId = 'Name__c;Code__c';
    parentObject.query = 'SELECT Name__c, Code__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Upsert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      {
        name: 'Name__c',
        updateable: true,
        creatable: true,
        custom: true,
        isExternalIdInMetadata: true,
      },
      {
        name: 'Code__c',
        updateable: true,
        creatable: true,
        custom: true,
        isExternalIdInMetadata: false,
      },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentRecord['Name__c'] = 'Parent External Name';
    parentRecord['Code__c'] = 'PARENT-CODE';
    parentTask.registerRecords([parentRecord], parentTask.sourceData, false);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const processed = await childTask.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['B__c'], 'b00000000000001');
      assert.equal(rows[0]['B__r.Name__c'], 'Parent External Name');
      assert.equal(rows[0]['B__r.Code__c'], 'PARENT-CODE');
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'Id'), true);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps own composite externalId fields and includes nested parent __r external ids in child csv', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.excludeIdsFromCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const parentObject = new ScriptObject('B__c');
    parentObject.operation = OPERATION.Upsert;
    parentObject.externalId = 'Name__c;Test__r.External_Id__c;Test2__r.Account__r.ExternalId__c';
    parentObject.query = 'SELECT Name__c, Test__r.External_Id__c, Test2__r.Account__r.ExternalId__c FROM B__c';
    parentObject.setup(script);

    const childObject = new ScriptObject('A__c');
    childObject.operation = OPERATION.Upsert;
    childObject.externalId = 'Name';
    childObject.query = 'SELECT Name, B__c FROM A__c';
    childObject.setup(script);

    const parentDescribe = createDescribe('B__c', [
      { name: 'Id', updateable: true, creatable: true },
      {
        name: 'Name__c',
        updateable: true,
        creatable: true,
        custom: true,
        isExternalIdInMetadata: true,
      },
      {
        name: 'Test__r.External_Id__c',
        updateable: true,
        creatable: true,
        custom: true,
        isExternalIdInMetadata: true,
      },
      {
        name: 'Test2__r.Account__r.ExternalId__c',
        updateable: true,
        creatable: true,
        custom: true,
        isExternalIdInMetadata: true,
      },
    ]);
    const childDescribe = createDescribe('A__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      {
        name: 'B__c',
        updateable: true,
        creatable: true,
        lookup: true,
        custom: true,
        referenceTo: ['B__c'],
        referencedObjectType: 'B__c',
      },
    ]);
    parentObject.applyDescribe(parentDescribe, parentDescribe);
    childObject.applyDescribe(childDescribe, childDescribe);

    const lookupField = childObject.sourceSObjectDescribe?.fieldsMap.get('B__c');
    if (lookupField) {
      lookupField.parentLookupObject = parentObject;
    }

    const job = new MigrationJob({ script });
    const parentTask = new MigrationJobTask({ job, scriptObject: parentObject });
    const childTask = new MigrationJobTask({ job, scriptObject: childObject });
    job.tasks = [parentTask, childTask];
    parentTask.data.refreshFromScriptObject();
    childTask.data.refreshFromScriptObject();
    parentTask.refreshPreflightState();
    childTask.refreshPreflightState();

    const parentRecord: Record<string, unknown> = {
      Id: 'b00000000000001',
    };
    parentRecord['Name__c'] = 'Parent Name';
    parentRecord['Test__r.External_Id__c'] = 'EXT-REL-1';
    parentRecord['Test2__r.Account__r.ExternalId__c'] = 'EXT-REL-2';
    parentTask.registerRecords([parentRecord], parentTask.sourceData, false);

    const childRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Child Name',
    };
    childRecord['B__c'] = 'b00000000000001';
    childTask.registerRecords([childRecord], childTask.sourceData, false);

    try {
      const parentProcessed = await parentTask.updateRecordsAsync('forwards');
      assert.equal(parentProcessed, 1);

      const childProcessed = await childTask.updateRecordsAsync('forwards');
      assert.equal(childProcessed, 1);

      const parentFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'B__c');
      const parentRows = await Common.readCsvFileAsync(parentFile);
      assert.equal(parentRows.length, 1);
      assert.equal(parentRows[0]['Name__c'], 'Parent Name');
      assert.equal(parentRows[0]['Test__r.External_Id__c'], 'EXT-REL-1');
      assert.equal(parentRows[0]['Test2__r.Account__r.ExternalId__c'], 'EXT-REL-2');

      const childFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'A__c');
      const childRows = await Common.readCsvFileAsync(childFile);
      assert.equal(childRows.length, 1);
      assert.equal(childRows[0]['B__c'], 'b00000000000001');
      assert.equal(childRows[0]['B__r.Name__c'], 'Parent Name');
      assert.equal(childRows[0]['B__r.Test__r.External_Id__c'], 'EXT-REL-1');
      assert.equal(childRows[0]['B__r.Test2__r.Account__r.ExternalId__c'], 'EXT-REL-2');
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes Id as the first column in all target CSV files', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Name FROM TestObject__c';
    scriptObject.setup(script);

    const describe = createDescribe('TestObject__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const sourceRecord: Record<string, unknown> = {
      Id: 'a00000000000003',
      Name: 'Example',
    };
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const operationName = ScriptObject.getStrOperation(scriptObject.operation).toLowerCase();
      const csvFiles = [
        Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c'),
        Common.getCSVFilename(script.targetDirectoryPath, 'TestObject__c', '_target'),
        Common.getCSVFilename(script.targetDirectoryPath, 'TestObject__c', `_${operationName}_target`),
      ];

      csvFiles.forEach((filePath) => {
        const header = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)[0] ?? '';
        const columns = header
          .split(Common.INTERNAL_CSV_FILE_DELIMITER)
          .map((value) => value.replace(/^\uFEFF/, '').replace(/^"+|"+$/g, ''))
          .filter((value) => value.length > 0);
        assert.equal(columns[0], 'Id');
      });
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes *_target CSV files using internal comma/quoted/utf8 format', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const previousReadDelimiter = Common.csvReadFileDelimiter;
    const previousWriteDelimiter = Common.csvWriteFileDelimiter;
    const previousEncoding = Common.csvFileEncoding;
    const previousUpperCaseHeaders = Common.csvWriteUpperCaseHeaders;
    Common.csvReadFileDelimiter = ';';
    Common.csvWriteFileDelimiter = ';';
    Common.csvFileEncoding = 'utf16le';
    Common.csvWriteUpperCaseHeaders = true;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = true;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Name FROM TestObject__c';
    scriptObject.setup(script);

    const describe = createDescribe('TestObject__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    task.registerRecords(
      [
        {
          Id: 'a00000000000004',
          Name: 'Example Internal Target',
        },
      ],
      task.sourceData,
      false
    );

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const plainTargetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c');
      const plainFileLines = fs.readFileSync(plainTargetFile, 'utf16le').split(/\r?\n/);
      const plainHeader = plainFileLines[0] ?? '';
      const plainFirstRow = plainFileLines[1] ?? '';
      assert.equal(plainHeader, '"ID";"NAME"');
      assert.equal(plainFirstRow, '"a00000000000004";"Example Internal Target"');

      const internalTargetFile = Common.getCSVFilename(script.targetDirectoryPath, 'TestObject__c', '_target');
      const internalHeader = (fs.readFileSync(internalTargetFile, 'utf8').split(/\r?\n/)[0] ?? '').replace(
        /^\uFEFF/,
        ''
      );
      assert.equal(internalHeader, '"Id","Name","Errors"');
      assert.equal(internalHeader.includes(';'), false);
      assert.equal(internalHeader.includes('\u0000'), false);
    } finally {
      Common.csvReadFileDelimiter = previousReadDelimiter;
      Common.csvWriteFileDelimiter = previousWriteDelimiter;
      Common.csvFileEncoding = previousEncoding;
      Common.csvWriteUpperCaseHeaders = previousUpperCaseHeaders;
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('maps internal ___SourceId to Old Id in target CSV payloads', () => {
    const { task } = createTaskFixture();
    const sanitizeTargetCsvRecords = (
      task as unknown as {
        _sanitizeTargetCsvRecords: (records: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
      }
    )._sanitizeTargetCsvRecords.bind(task);

    const sanitized = sanitizeTargetCsvRecords([
      {
        Id: 'a00000000000099',
        Name: 'Mapped Row',
        [__SOURCE_ID_FIELD_NAME]: 'a00000000000005',
      },
    ]);

    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].Id, 'a00000000000099');
    assert.equal(sanitized[0][TARGET_CSV_OLD_ID_FIELD_NAME], 'a00000000000005');
    assert.equal(Object.prototype.hasOwnProperty.call(sanitized[0], __SOURCE_ID_FIELD_NAME), false);
  });

  it('applies value mapping before onBeforeUpdate addons for file targets', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Name FROM TestObject__c';
    scriptObject.useValuesMapping = true;
    scriptObject.setup(script);

    const describe = createDescribe('TestObject__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    job.valueMapping.set('TestObject__cName', new Map([['Original', 'Mapped']]));

    script.addonManager = {
      triggerAddonModuleMethodAsync: async (event: ADDON_EVENTS, objectName?: string): Promise<void> => {
        if (event !== ADDON_EVENTS.onBeforeUpdate || objectName !== 'TestObject__c') {
          return;
        }
        const record = task.processedData.recordsToInsert[0];
        if (record) {
          record['Name'] = `${String(record['Name'] ?? '')}-X`;
        }
      },
    };

    const sourceRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Original',
    };
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['Name'], 'Mapped-X');
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves mapped #N/A values to null in file target CSV output', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT Name FROM TestObject__c';
    scriptObject.useValuesMapping = true;
    scriptObject.setup(script);

    const describe = createDescribe('TestObject__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    job.valueMapping.set('TestObject__cName', new Map([['Original', '#N/A']]));

    const sourceRecord: Record<string, unknown> = {
      Id: 'a00000000000002',
      Name: 'Original',
    };
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]['Name'], null);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('normalizes field casing in plain target CSV headers', async () => {
    const tempDir = createTempDir();
    const originalLogger = Common.logger;
    const logger = createLoggingService();
    Common.logger = logger;

    const script = new Script();
    script.basePath = tempDir;
    script.createTargetCSVFiles = false;
    script.logger = logger;

    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.name = 'csvfile';
    sourceOrg.script = script;
    sourceOrg.isSource = true;
    script.sourceOrg = sourceOrg;

    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.name = 'csvfile';
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const scriptObject = new ScriptObject('TestObject__c');
    scriptObject.operation = OPERATION.Upsert;
    scriptObject.externalId = 'Id';
    scriptObject.query = 'SELECT id, name, parent__c FROM TestObject__c';
    scriptObject.setup(script);

    const describe = createDescribe('TestObject__c', [
      { name: 'Id', updateable: true, creatable: true },
      { name: 'Name', updateable: true, creatable: true, nameField: true },
      { name: 'Parent__c', updateable: true, creatable: true, lookup: true, custom: true },
    ]);
    scriptObject.applyDescribe(describe, describe);

    const job = new MigrationJob({ script });
    const task = new MigrationJobTask({ job, scriptObject });
    task.data.refreshFromScriptObject();
    task.refreshPreflightState();

    const sourceRecord: Record<string, unknown> = {
      Id: 'a00000000000001',
      Name: 'Example',
    };
    sourceRecord['Parent__c'] = '001000000000001';
    task.registerRecords([sourceRecord], task.sourceData, false);

    try {
      const processed = await task.updateRecordsAsync('forwards');
      assert.equal(processed, 1);

      const targetFile = Common.getCSVFilename(script.rawSourceDirectoryPath, 'TestObject__c');
      const rows = await Common.readCsvFileAsync(targetFile);
      assert.equal(rows.length, 1);
      assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'Name'));
      assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'Parent__c'));
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'name'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'parent__c'), false);
    } finally {
      Common.logger = originalLogger;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
