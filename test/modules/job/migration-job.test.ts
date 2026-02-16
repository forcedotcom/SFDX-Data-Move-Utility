/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as os from 'node:os';
import { Common } from '../../../src/modules/common/Common.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import { ADDON_EVENTS, DATA_MEDIA_TYPE, OPERATION } from '../../../src/modules/common/Enumerations.js';
import { UnresolvableWarning } from '../../../src/modules/models/common/UnresolvableWarning.js';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import type { IMetadataProvider } from '../../../src/modules/models/job/IMetadataProvider.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptMappingItem from '../../../src/modules/models/script/ScriptMappingItem.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import SFieldDescribe from '../../../src/modules/models/sf/SFieldDescribe.js';
import SObjectDescribe from '../../../src/modules/models/sf/SObjectDescribe.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';

type FieldInitType = Partial<SFieldDescribe> & { name: string };
type OrgConnectionStubType = {
  accessToken?: string;
  instanceUrl?: string;
  baseUrl?: () => string;
  getAuthInfoFields?: () => { username?: string; instanceUrl?: string };
  singleRecordQuery?: <T>(query: string) => Promise<T>;
  query?: <T>(query: string) => Promise<{ records: T[] }>;
};

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

const createMetadataProvider = (describes: Map<string, SObjectDescribe>): IMetadataProvider => ({
  describeSObjectAsync: async (objectName: string, isSource: boolean): Promise<SObjectDescribe> => {
    const sourceKey = `${objectName}::source`;
    const targetKey = `${objectName}::target`;
    const describe = isSource
      ? describes.get(sourceKey) ?? describes.get(objectName)
      : describes.get(targetKey) ?? describes.get(objectName);
    if (!describe) {
      throw new Error(`Missing describe for ${objectName}`);
    }
    return describe;
  },
});

const createOrgConnectionStub = (): OrgConnectionStubType => ({
  accessToken: 'token',
  instanceUrl: 'https://example.com',
  getAuthInfoFields: () => ({
    username: 'test@example.com',
    instanceUrl: 'https://example.com',
  }),
  singleRecordQuery: async <T>(query: string): Promise<T> => {
    if (query.includes('FROM Organization')) {
      return { OrganizationType: 'Developer Edition', IsSandbox: false } as T;
    }
    if (query.includes('FROM Account')) {
      return { IsPersonAccount: false } as T;
    }
    return {} as T;
  },
});

const createLoggingService = (): LoggingService => {
  const context = new LoggingContext({
    commandName: 'run',
    rootPath: os.tmpdir(),
    fileLogEnabled: false,
  });
  return new LoggingService(context);
};

describe('MigrationJob', () => {
  let originalLogger: typeof Common.logger;

  beforeEach(() => {
    originalLogger = Common.logger;
    Common.logger = createLoggingService();
  });

  afterEach(() => {
    Common.logger = originalLogger;
  });

  it('orders tasks by RecordType, readonly, and lookup parents', async () => {
    const recordType = new ScriptObject('RecordType');
    recordType.operation = OPERATION.Readonly;

    const account = new ScriptObject('Account');
    account.operation = OPERATION.Readonly;
    account.query = 'SELECT Id, Name FROM Account';

    const contact = new ScriptObject('Contact');
    contact.operation = OPERATION.Upsert;
    contact.query = 'SELECT Id, Name, AccountId FROM Contact';

    const script = new Script();
    script.keepObjectOrderWhileExecute = false;
    script.objectSets = [new ScriptObjectSet([contact, account, recordType])];

    const describes = new Map<string, SObjectDescribe>([
      ['Account', createDescribe('Account', [{ name: 'Id' }, { name: 'Name', nameField: true }])],
      [
        'Contact',
        createDescribe('Contact', [
          { name: 'Id' },
          { name: 'Name' },
          { name: 'AccountId', lookup: true, referencedObjectType: 'Account', updateable: true, creatable: true },
        ]),
      ],
      [
        'RecordType',
        createDescribe('RecordType', [
          { name: 'Id' },
          { name: 'DeveloperName' },
          { name: 'NamespacePrefix' },
          { name: 'SobjectType' },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);

    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.deepEqual(
      job.tasks.map((task) => task.sObjectName),
      ['RecordType', 'Account', 'Contact']
    );
  });

  it('keeps RecordType first when keepObjectOrderWhileExecute is true', async () => {
    const recordType = new ScriptObject('RecordType');
    recordType.query = 'SELECT Id FROM RecordType';

    const contact = new ScriptObject('Contact');
    contact.query = 'SELECT Id, Name FROM Contact';

    const account = new ScriptObject('Account');
    account.query = 'SELECT Id, Name FROM Account';

    const script = new Script();
    script.keepObjectOrderWhileExecute = true;
    script.objectSets = [new ScriptObjectSet([contact, recordType, account])];

    const job = new MigrationJob({ script });

    await job.loadAsync();
    await job.setupAsync();

    assert.deepEqual(
      job.tasks.map((task) => task.sObjectName),
      ['RecordType', 'Contact', 'Account']
    );
  });

  it('records pipeline stages in order', async () => {
    const account = new ScriptObject('Account');
    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];

    const job = new MigrationJob({ script });
    await job.runPipelineAsync();

    assert.deepEqual(job.stageHistory, ['load', 'setup', 'processCsv', 'prepare', 'addons', 'execute']);
    assert.equal(job.tasks.length, 1);
  });

  it('applies mapping and polymorphic expansion during setup', async () => {
    const account = new ScriptObject('Account');
    account.polymorphicLookups = [
      { fieldName: 'OwnerId', referencedObjectType: 'User' },
      { fieldName: 'OwnerId', referencedObjectType: 'Group' },
    ];
    account.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'Account__c';
    mappingItem.sourceField = 'Name';
    mappingItem.targetField = 'Title__c';
    account.fieldMapping = [mappingItem];

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];

    const job = new MigrationJob({ script });
    await job.loadAsync();
    await job.setupAsync();

    const taskNames = job.tasks.map((task) => task.sObjectName);
    assert.ok(taskNames.includes('User'));
    assert.ok(taskNames.includes('Group'));

    const accountTask = job.tasks.find((task) => task.sObjectName === 'Account');
    assert.equal(accountTask?.targetObjectName, 'Account__c');
    assert.equal(job.mappingResolver.mapObjectNameToTarget('Account'), 'Account__c');
  });

  it('adds missing parent lookup objects and lookup __r fields from metadata', async () => {
    const contact = new ScriptObject('Contact');
    contact.operation = OPERATION.Upsert;
    contact.query = 'SELECT Id, AccountId FROM Contact';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([contact])];

    const describes = new Map<string, SObjectDescribe>([
      [
        'Contact',
        createDescribe('Contact', [
          { name: 'Id' },
          { name: 'AccountId', lookup: true, referencedObjectType: 'Account', updateable: true, creatable: true },
        ]),
      ],
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id' },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    const taskNames = job.tasks.map((task) => task.sObjectName);
    assert.ok(taskNames.includes('Account'));
    assert.ok(taskNames.includes('Contact'));
    assert.ok(taskNames.indexOf('Account') < taskNames.indexOf('Contact'));

    const accountObject = job.script.getAllObjects().find((object) => object.name === 'Account');
    assert.ok(accountObject?.isAutoAdded);
    assert.ok(contact.fieldsInQuery.includes('Account.Name'));
  });

  it('auto-adds User and Group for polymorphic lookup without explicit target', async () => {
    const task = new ScriptObject('Task');
    task.operation = OPERATION.Readonly;
    task.query = 'SELECT Id, OwnerId FROM Task';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([task])];

    const describes = new Map<string, SObjectDescribe>([
      [
        'Task',
        createDescribe('Task', [
          { name: 'Id' },
          {
            name: 'OwnerId',
            lookup: true,
            referenceTo: ['User', 'Group'],
            isPolymorphicFieldDefinition: true,
            updateable: true,
            creatable: true,
          },
        ]),
      ],
      [
        'User',
        createDescribe('User', [{ name: 'Id' }, { name: 'Name', nameField: true, updateable: true, creatable: true }]),
      ],
      [
        'Group',
        createDescribe('Group', [{ name: 'Id' }, { name: 'Name', nameField: true, updateable: true, creatable: true }]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    const taskNames = job.tasks.map((taskItem) => taskItem.sObjectName);
    assert.ok(taskNames.includes('User'));
    assert.ok(taskNames.includes('Group'));
  });

  it('auto-adds only the explicit polymorphic target', async () => {
    const task = new ScriptObject('Task');
    task.operation = OPERATION.Readonly;
    task.query = 'SELECT Id, OwnerId$User FROM Task';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([task])];

    const describes = new Map<string, SObjectDescribe>([
      [
        'Task',
        createDescribe('Task', [
          { name: 'Id' },
          {
            name: 'OwnerId',
            lookup: true,
            referenceTo: ['User', 'Group'],
            isPolymorphicFieldDefinition: true,
            updateable: true,
            creatable: true,
          },
        ]),
      ],
      [
        'User',
        createDescribe('User', [{ name: 'Id' }, { name: 'Name', nameField: true, updateable: true, creatable: true }]),
      ],
      [
        'Group',
        createDescribe('Group', [{ name: 'Id' }, { name: 'Name', nameField: true, updateable: true, creatable: true }]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    const taskNames = job.tasks.map((taskItem) => taskItem.sObjectName);
    assert.ok(taskNames.includes('User'));
    assert.ok(!taskNames.includes('Group'));
  });

  it('drops undefined fields during metadata validation', async () => {
    const account = new ScriptObject('Account');
    account.query = 'SELECT Id, Name, Missing__c FROM Account';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id' },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.ok(account.fieldsInQuery.includes('Name'));
    assert.ok(!account.fieldsInQuery.includes('Missing__c'));
  });

  it('throws when external id field is missing in metadata', async () => {
    const opportunity = new ScriptObject('Opportunity');
    opportunity.externalId = 'External_Id__c';
    opportunity.query = 'SELECT Id, External_Id__c FROM Opportunity';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([opportunity])];

    const describes = new Map<string, SObjectDescribe>([
      [
        'Opportunity',
        createDescribe('Opportunity', [
          { name: 'Id' },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();

    await assert.rejects(
      job.setupAsync(),
      (error: unknown) =>
        error instanceof UnresolvableWarning &&
        error.message.includes('{Opportunity} has no mandatory external Id field definition.')
    );
  });

  it('keeps Delete operation for deletable objects that are not createable/updateable', async () => {
    const knowledge = new ScriptObject('Knowledge__ka');
    knowledge.operation = OPERATION.Delete;
    knowledge.query = 'SELECT Id FROM Knowledge__ka';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([knowledge])];

    const knowledgeDescribe = createDescribe('Knowledge__ka', [{ name: 'Id' }]);
    knowledgeDescribe.createable = false;
    knowledgeDescribe.updateable = false;
    knowledgeDescribe.deletable = true;

    const describes = new Map<string, SObjectDescribe>([['Knowledge__ka', knowledgeDescribe]]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.equal(knowledge.operation, OPERATION.Delete);
    assert.ok(job.deleteTasks.some((task) => task.sObjectName === 'Knowledge__ka'));
  });

  it('forces Delete operation to Readonly for non-deletable objects', async () => {
    const knowledge = new ScriptObject('Knowledge__ka');
    knowledge.operation = OPERATION.Delete;
    knowledge.query = 'SELECT Id FROM Knowledge__ka';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([knowledge])];

    const knowledgeDescribe = createDescribe('Knowledge__ka', [{ name: 'Id' }]);
    knowledgeDescribe.createable = false;
    knowledgeDescribe.updateable = false;
    knowledgeDescribe.deletable = false;

    const describes = new Map<string, SObjectDescribe>([['Knowledge__ka', knowledgeDescribe]]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.equal(knowledge.operation, OPERATION.Readonly);
    assert.ok(!job.deleteTasks.some((task) => task.sObjectName === 'Knowledge__ka'));
  });

  it('downgrades Upsert to Update based on target metadata with field mapping', async () => {
    const sourceObject = new ScriptObject('SourceObject__c');
    sourceObject.operation = OPERATION.Upsert;
    sourceObject.query = 'SELECT Id, Name FROM SourceObject__c';
    sourceObject.useFieldMapping = true;

    const objectMapping = new ScriptMappingItem();
    objectMapping.targetObject = 'TargetObject__c';
    sourceObject.fieldMapping = [objectMapping];

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([sourceObject])];

    const sourceDescribe = createDescribe('SourceObject__c', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    sourceDescribe.createable = true;
    sourceDescribe.updateable = true;
    sourceDescribe.deletable = true;

    const targetDescribe = createDescribe('TargetObject__c', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    targetDescribe.createable = false;
    targetDescribe.updateable = true;
    targetDescribe.deletable = true;

    const describes = new Map<string, SObjectDescribe>([
      ['SourceObject__c::source', sourceDescribe],
      ['TargetObject__c::target', targetDescribe],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.equal(sourceObject.operation, OPERATION.Update);
  });

  it('downgrades Upsert to Insert when target is createable only', async () => {
    const sourceObject = new ScriptObject('SourceObject__c');
    sourceObject.operation = OPERATION.Upsert;
    sourceObject.query = 'SELECT Id, Name FROM SourceObject__c';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([sourceObject])];

    const sourceDescribe = createDescribe('SourceObject__c', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    sourceDescribe.createable = true;
    sourceDescribe.updateable = true;
    sourceDescribe.deletable = true;

    const targetDescribe = createDescribe('SourceObject__c', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    targetDescribe.createable = true;
    targetDescribe.updateable = false;
    targetDescribe.deletable = true;

    const describes = new Map<string, SObjectDescribe>([
      ['SourceObject__c::source', sourceDescribe],
      ['SourceObject__c::target', targetDescribe],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.equal(sourceObject.operation, OPERATION.Insert);
  });

  it('disables deleteOldData and hardDelete when target is not deletable', async () => {
    const account = new ScriptObject('Account');
    account.operation = OPERATION.Insert;
    account.deleteOldData = true;
    account.hardDelete = true;
    account.query = 'SELECT Id, Name FROM Account';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];

    const describe = createDescribe('Account', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    describe.createable = true;
    describe.updateable = true;
    describe.deletable = false;

    const describes = new Map<string, SObjectDescribe>([['Account', describe]]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    assert.equal(account.operation, OPERATION.Insert);
    assert.equal(account.deleteOldData, false);
    assert.equal(account.hardDelete, false);
  });

  it('keeps delete-from-source flags when only target is not deletable', async () => {
    const account = new ScriptObject('Account');
    account.operation = OPERATION.DeleteSource;
    account.hardDelete = true;
    account.query = 'SELECT Id, Name FROM Account';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;
    const targetOrg = new ScriptOrg();
    targetOrg.name = 'target';
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.script = script;
    script.targetOrg = targetOrg;

    const sourceDescribe = createDescribe('Account', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    sourceDescribe.createable = true;
    sourceDescribe.updateable = true;
    sourceDescribe.deletable = true;

    const targetDescribe = createDescribe('Account', [{ name: 'Id' }, { name: 'Name', updateable: true }]);
    targetDescribe.createable = true;
    targetDescribe.updateable = true;
    targetDescribe.deletable = false;

    const describes = new Map<string, SObjectDescribe>([
      ['Account::source', sourceDescribe],
      ['Account::target', targetDescribe],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createOrgConnectionStub() as never;

    try {
      await job.loadAsync();
      await job.setupAsync();
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }

    assert.equal(account.operation, OPERATION.Delete);
    assert.equal(account.deleteFromSource, true);
    assert.equal(account.hardDelete, true);
  });

  it('creates distinct tasks for duplicate object entries in the same object set', async () => {
    const softDelete = new ScriptObject('TestObject3__c');
    softDelete.operation = OPERATION.Delete;
    softDelete.externalId = 'Name';
    softDelete.query = "SELECT Id, Name FROM TestObject3__c WHERE Name = 'SOFT'";

    const hardDelete = new ScriptObject('TestObject3__c');
    hardDelete.operation = OPERATION.Delete;
    hardDelete.externalId = 'Name';
    hardDelete.hardDelete = true;
    hardDelete.query = "SELECT Id, Name FROM TestObject3__c WHERE Name = 'HARD'";

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([softDelete, hardDelete])];
    const job = new MigrationJob({ script });

    await job.loadAsync();
    await job.setupAsync();

    const deleteTasks = job.deleteTasks.filter((task) => task.sObjectName === 'TestObject3__c');
    assert.equal(deleteTasks.length, 2);

    const deleteQueries = deleteTasks.map((task) => {
      task.scriptObject.createDeleteQuery();
      return task.scriptObject.deleteQuery;
    });
    assert.ok(deleteQueries.some((query) => query.includes("Name = 'SOFT'")));
    assert.ok(deleteQueries.some((query) => query.includes("Name = 'HARD'")));
  });

  it('runs global addon events during execution', async () => {
    const account = new ScriptObject('Account');
    const script = new Script();
    script.objectSets = [new ScriptObjectSet([account])];

    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'csvfile';
    sourceOrg.media = DATA_MEDIA_TYPE.File;
    sourceOrg.script = script;
    const targetOrg = new ScriptOrg();
    targetOrg.name = 'target';
    targetOrg.media = DATA_MEDIA_TYPE.File;
    targetOrg.script = script;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const events: string[] = [];
    script.addonManager = {
      initializeAsync: async (): Promise<void> => {
        events.push('init');
      },
      runAddonEventAsync: async (event: ADDON_EVENTS): Promise<void> => {
        events.push(event);
      },
    };

    const job = new MigrationJob({ script });

    await job.loadAsync();
    await job.setupAsync();
    await job.runAddonsAsync();
    await job.executeAsync();

    assert.deepEqual(events, ['init', ADDON_EVENTS.onBefore, ADDON_EVENTS.onDataRetrieved, ADDON_EVENTS.onAfter]);
  });

  it('preflight links lookup relationships and prepares task data', async () => {
    const account = new ScriptObject('Account');
    account.operation = OPERATION.Upsert;
    account.query = 'SELECT Id, Name FROM Account';

    const contact = new ScriptObject('Contact');
    contact.operation = OPERATION.Upsert;
    contact.query = 'SELECT Id, LastName, AccountId FROM Contact';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([contact, account])];

    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    const targetOrg = new ScriptOrg();
    targetOrg.name = 'target';
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.script = script;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id' },
          { name: 'Name', nameField: true, unique: true, updateable: true, creatable: true },
        ]),
      ],
      [
        'Contact',
        createDescribe('Contact', [
          { name: 'Id' },
          { name: 'LastName', nameField: true, updateable: true, creatable: true },
          {
            name: 'AccountId',
            lookup: true,
            referencedObjectType: 'Account',
            updateable: true,
            creatable: true,
          },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createOrgConnectionStub() as never;

    try {
      await job.loadAsync();
      await job.setupAsync();
      await job.prepareAsync();
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }

    const contactTask = job.getTaskBySObjectName('Contact');
    const accountTask = job.getTaskBySObjectName('Account');
    assert.ok(contactTask);
    assert.ok(accountTask);
    assert.ok(contactTask?.data.parsedTargetQuery);
    assert.equal(contactTask?.preflightEligibility.canQuerySource, true);
    assert.equal(contactTask?.preflightEligibility.canQueryTarget, true);

    const accountExternalIdField = account.fieldsInQueryMap.get(account.externalId);
    const contactAccountField = contact.fieldsInQueryMap.get('AccountId');
    const relationshipFieldName = contactAccountField?.fullName__r ?? 'Account.Name';
    const relationshipField = contact.fieldsInQueryMap.get(relationshipFieldName);

    assert.ok(relationshipField);
    assert.equal(relationshipField?.idSField?.name, 'AccountId');
    assert.ok(accountExternalIdField?.child__rSFields.some((field) => field.name === relationshipFieldName));
  });

  it('maps lookup referenced object types back to source objects during preflight', async () => {
    const account = new ScriptObject('Account');
    account.operation = OPERATION.Upsert;
    account.query = 'SELECT Id, Name FROM Account';
    account.useFieldMapping = true;

    const accountMapping = new ScriptMappingItem();
    accountMapping.targetObject = 'Account__c';
    account.fieldMapping = [accountMapping];

    const contact = new ScriptObject('Contact');
    contact.operation = OPERATION.Upsert;
    contact.query = 'SELECT Id, LastName, AccountId FROM Contact';

    const script = new Script();
    script.objectSets = [new ScriptObjectSet([contact, account])];

    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    const targetOrg = new ScriptOrg();
    targetOrg.name = 'target';
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.script = script;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account::source',
        createDescribe('Account', [
          { name: 'Id' },
          { name: 'Name', nameField: true, unique: true, updateable: true, creatable: true },
        ]),
      ],
      [
        'Account__c::target',
        createDescribe('Account__c', [
          { name: 'Id' },
          { name: 'Name', nameField: true, unique: true, updateable: true, creatable: true },
        ]),
      ],
      [
        'Contact::source',
        createDescribe('Contact', [
          { name: 'Id' },
          { name: 'LastName', nameField: true, updateable: true, creatable: true },
          {
            name: 'AccountId',
            lookup: true,
            referencedObjectType: 'Account',
            updateable: true,
            creatable: true,
          },
        ]),
      ],
      [
        'Contact::target',
        createDescribe('Contact', [
          { name: 'Id' },
          { name: 'LastName', nameField: true, updateable: true, creatable: true },
          {
            name: 'AccountId',
            lookup: true,
            referencedObjectType: 'Account__c',
            updateable: true,
            creatable: true,
          },
        ]),
      ],
    ]);

    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createOrgConnectionStub() as never;

    try {
      await job.loadAsync();
      await job.setupAsync();
      await job.prepareAsync();
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }

    const contactAccountField = contact.fieldsInQueryMap.get('AccountId');
    assert.equal(contactAccountField?.parentLookupObject?.name, 'Account');
    assert.ok(!job.tasks.some((task) => task.sObjectName === 'Account__c'));
  });
});
