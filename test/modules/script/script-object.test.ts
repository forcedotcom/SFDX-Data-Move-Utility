/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as os from 'node:os';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import { Common } from '../../../src/modules/common/Common.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import { DATA_MEDIA_TYPE, OPERATION } from '../../../src/modules/common/Enumerations.js';
import { CommandInitializationError } from '../../../src/modules/models/common/CommandInitializationError.js';
import { UnresolvableWarning } from '../../../src/modules/models/common/UnresolvableWarning.js';
import ScriptMappingItem from '../../../src/modules/models/script/ScriptMappingItem.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import SFieldDescribe from '../../../src/modules/models/sf/SFieldDescribe.js';
import SObjectDescribe from '../../../src/modules/models/sf/SObjectDescribe.js';

type FieldInitType = Partial<SFieldDescribe> & { name: string };

const createDescribe = (objectName: string, fields: FieldInitType[]): SObjectDescribe => {
  const describe = new SObjectDescribe({ name: objectName });
  fields.forEach((fieldInit) => {
    const field = new SFieldDescribe({ ...fieldInit, objectName });
    describe.addField(field);
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

describe('Script object multiselect', () => {
  it('expands all and skips restricted lookup fields', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.query = 'SELECT all FROM Account';
    object.excludedFromUpdateFields = ['Custom__c'];
    object.setup(script);

    const describe = createDescribe('Account', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Custom__c', type: 'string', updateable: true, creatable: true, custom: true },
      { name: 'OtherLookup__c', type: 'reference', lookup: true, referencedObjectType: 'Account' },
      { name: 'MasterRecordId', type: 'reference', lookup: true, referencedObjectType: 'Account' },
      { name: 'OwnerId', type: 'reference', lookup: true, referencedObjectType: 'User' },
    ]);

    object.applyDescribe(describe);

    const fields = object.fieldsInQuery;
    assert.ok(fields.includes('Name'));
    assert.ok(fields.includes('Custom__c'));
    assert.ok(fields.includes('OtherLookup__c'));
    assert.ok(!fields.includes('MasterRecordId'));
    assert.ok(!fields.includes('OwnerId'));
    assert.ok(!object.excludedFromUpdateFields.includes('Custom__c'));
  });

  it('applies keyword AND logic', () => {
    const script = new Script();
    const object = new ScriptObject('Contact');
    object.query = 'SELECT custom_true, lookup_true FROM Contact';
    object.setup(script);

    const describe = createDescribe('Contact', [
      { name: 'CustomLookup__c', type: 'reference', lookup: true, referencedObjectType: 'Account', custom: true },
      { name: 'CustomText__c', type: 'string', lookup: false, custom: true },
      { name: 'AccountId', type: 'reference', lookup: true, referencedObjectType: 'Account', custom: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
    ]);

    object.applyDescribe(describe);

    const fields = object.fieldsInQuery;
    assert.ok(fields.includes('CustomLookup__c'));
    assert.ok(!fields.includes('CustomText__c'));
    assert.ok(!fields.includes('AccountId'));
  });

  it('selects fields by type keyword', () => {
    const script = new Script();
    const object = new ScriptObject('Lead');
    object.query = 'SELECT type_boolean FROM Lead';
    object.setup(script);

    const describe = createDescribe('Lead', [
      { name: 'IsConverted', type: 'boolean', updateable: true, creatable: true },
      { name: 'Company', type: 'string', updateable: true, creatable: true },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
    ]);

    object.applyDescribe(describe);

    const fields = object.fieldsInQuery;
    assert.ok(fields.includes('IsConverted'));
    assert.ok(!fields.includes('Company'));
  });
});

describe('Script object query parsing', () => {
  it('drops referenced fields from the initial query', () => {
    const script = new Script();
    const object = new ScriptObject('Contact');
    object.query = 'SELECT Id, Name, Account.Name, Owner.Name FROM Contact';
    object.setup(script);

    const fields = object.fieldsInQuery;
    assert.ok(fields.includes('Id'));
    assert.ok(fields.includes('Name'));
    assert.ok(!fields.includes('Account.Name'));
    assert.ok(!fields.includes('Owner.Name'));
  });

  it('normalizes query field casing from describe metadata', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.query = 'SELECT ID, NAME, TYPE FROM Account';
    object.operation = OPERATION.Upsert;
    object.externalId = 'Name';
    object.setup(script);

    const describe = createDescribe('Account', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Type', type: 'string', updateable: true, creatable: true },
    ]);

    object.applyDescribe(describe, describe);

    assert.ok(object.fieldsInQuery.includes('Id'));
    assert.ok(object.fieldsInQuery.includes('Name'));
    assert.ok(object.fieldsInQuery.includes('Type'));
    assert.ok(!object.fieldsInQuery.includes('ID'));
    assert.ok(!object.fieldsInQuery.includes('NAME'));
    assert.notEqual(object.fieldsInQueryMap.get('Name')?.type, 'dynamic');

    const fieldsToUpdate = object.fieldsToUpdate;
    assert.ok(fieldsToUpdate.includes('Name'));
    assert.ok(fieldsToUpdate.includes('Type'));
  });

  it('keeps explicit polymorphic lookups to Group', () => {
    const script = new Script();
    const object = new ScriptObject('Task');
    object.query = 'SELECT Id, OwnerId$Group, Subject FROM Task';
    object.setup(script);

    const describe = createDescribe('Task', [
      { name: 'Id', type: 'id' },
      { name: 'Subject', type: 'string', updateable: true, creatable: true },
      {
        name: 'OwnerId',
        type: 'reference',
        lookup: true,
        referenceTo: ['User', 'Group'],
        referencedObjectType: 'User',
      },
    ]);

    object.applyDescribe(describe);

    const fields = object.fieldsInQuery;
    assert.ok(fields.includes('OwnerId'));
  });
});

describe('Script object external id', () => {
  it('resolves missing external id based on metadata', () => {
    const script = new Script();
    const object = new ScriptObject('Case');
    object.query = 'SELECT Subject FROM Case';
    object.setup(script);

    const describe = createDescribe('Case', [
      { name: 'Id', type: 'id' },
      { name: 'Subject', type: 'string', updateable: true, creatable: true },
      { name: 'CaseNumber', autoNumber: true },
    ]);

    object.applyDescribe(describe);

    assert.equal(object.externalId, 'CaseNumber');
    assert.ok(object.query.includes('Id'));
    assert.ok(object.query.includes('CaseNumber'));
  });

  it('uses RecordType default external id when missing in the script', () => {
    const script = new Script();
    const object = new ScriptObject('RecordType');
    object.query = 'SELECT Id FROM RecordType';
    object.setup(script);

    assert.equal(object.externalId, 'DeveloperName;NamespacePrefix;SobjectType');
    assert.ok(object.query.includes('DeveloperName'));
    assert.ok(object.query.includes('NamespacePrefix'));
    assert.ok(object.query.includes('SobjectType'));
  });

  it('adds complex external id parts to the query', () => {
    const script = new Script();
    const object = new ScriptObject('RecordType');
    object.externalId = 'DeveloperName;NamespacePrefix;SobjectType';
    object.query = 'SELECT Id FROM RecordType';
    object.setup(script);

    const describe = createDescribe('RecordType', [
      { name: 'Id', type: 'id' },
      { name: 'DeveloperName', nameField: true },
      { name: 'NamespacePrefix' },
      { name: 'SobjectType' },
    ]);

    object.applyDescribe(describe);

    assert.ok(object.query.includes('DeveloperName'));
    assert.ok(object.query.includes('NamespacePrefix'));
    assert.ok(object.query.includes('SobjectType'));
  });

  it('keeps mixed relationship and local composite externalId fields separated', () => {
    const script = new Script();
    const object = new ScriptObject('TestObject3__c');
    object.externalId = 'TestObject2__r.Name;Test2__c';
    object.query = 'SELECT Name, TestObject2__c, Test2__c FROM TestObject3__c';
    object.setup(script);

    const describe = createDescribe('TestObject3__c', [
      { name: 'Id', type: 'id' },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Test2__c', type: 'string', updateable: true, creatable: true, custom: true },
      {
        name: 'TestObject2__c',
        type: 'reference',
        updateable: true,
        creatable: true,
        lookup: true,
        referencedObjectType: 'TestObject2__c',
        custom: true,
      },
    ]);

    object.applyDescribe(describe);

    assert.ok(object.query.includes('TestObject2__r.Name'));
    assert.ok(object.query.includes('Test2__c'));
    assert.ok(!object.query.includes('TestObject2__r.Test2__c'));
  });

  it('recalculates target query after external id change', () => {
    const script = new Script();
    const object = new ScriptObject('RecordType');
    object.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'RecordType__c';
    mappingItem.sourceField = 'DeveloperName';
    mappingItem.targetField = 'DevName__c';
    object.fieldMapping = [mappingItem];
    object.query = 'SELECT Id FROM RecordType';
    object.setup(script);

    const sourceDescribe = createDescribe('RecordType', [
      { name: 'Id', type: 'id' },
      { name: 'DeveloperName', nameField: true },
      { name: 'NamespacePrefix' },
      { name: 'SobjectType' },
    ]);
    const targetDescribe = createDescribe('RecordType__c', [
      { name: 'Id', type: 'id' },
      { name: 'DevName__c' },
      { name: 'NamespacePrefix' },
      { name: 'SobjectType' },
    ]);

    object.applyDescribe(sourceDescribe, targetDescribe);

    assert.equal(object.externalId, 'DeveloperName;NamespacePrefix;SobjectType');
    const targetQuery = object.targetQuery;
    assert.ok(targetQuery.includes('FROM RecordType__c'));
    assert.ok(targetQuery.includes('DevName__c'));
    assert.ok(targetQuery.includes('NamespacePrefix'));
    assert.ok(targetQuery.includes('SobjectType'));
    assert.ok(!targetQuery.includes('DeveloperName'));
  });

  it('recalculates target query after external id changes to multi-level relationship', () => {
    const script = new Script();
    const object = new ScriptObject('Contact');
    object.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'Contact__c';
    mappingItem.sourceField = 'Account__c';
    mappingItem.targetField = 'AccountNew__c';
    object.fieldMapping = [mappingItem];
    object.query = 'SELECT Id FROM Contact';
    object.setup(script);

    const sourceDescribe = createDescribe('Contact', [
      { name: 'Id', type: 'id' },
      { name: 'Account__c', type: 'reference', lookup: true, referencedObjectType: 'Account', custom: true },
      { name: 'Account__r', type: 'reference', lookup: true, referencedObjectType: 'Account' },
      { name: 'Account__r.Owner__r.Name', nameField: true },
    ]);

    object.applyDescribe(sourceDescribe);

    assert.equal(object.externalId, 'Account__r.Owner__r.Name');
    const targetQuery = object.targetQuery;
    assert.ok(targetQuery.includes('FROM Contact__c'));
    assert.ok(targetQuery.includes('AccountNew__r.Owner__r.Name'));
  });

  it('keeps relationship prefix for complex RecordType tokens in target query', () => {
    const object = new ScriptObject('Account');
    object.useFieldMapping = true;
    const mapper = object as unknown as {
      _mapComplexFieldNameToTarget(fieldName: string, contextObject: ScriptObject): string;
    };

    const mapped = mapper._mapComplexFieldNameToTarget('RecordType.DeveloperName;NamespacePrefix;SobjectType', object);

    assert.equal(mapped, 'RecordType.$$DeveloperName$NamespacePrefix$SobjectType');
  });

  it('maps target query when external id uses ParentId', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'Account__c';
    mappingItem.sourceField = 'ParentId';
    mappingItem.targetField = 'NewParent__c';
    object.fieldMapping = [mappingItem];
    object.query = 'SELECT Id FROM Account';
    object.setup(script);

    const sourceDescribe = createDescribe('Account', [
      { name: 'Id', type: 'id' },
      { name: 'ParentId', type: 'reference', lookup: true, referencedObjectType: 'Account' },
      { name: 'Parent.Name', nameField: true },
    ]);

    object.applyDescribe(sourceDescribe);

    assert.equal(object.externalId, 'Parent.Name');
    const targetQuery = object.targetQuery;
    assert.ok(targetQuery.includes('FROM Account__c'));
    assert.ok(targetQuery.includes('NewParent__r.Name'));
  });
});

describe('Script object operations', () => {
  it('keeps parallelBulkJobs undefined at object level by default', () => {
    const object = new ScriptObject('Account');
    assert.equal(object.parallelBulkJobs, undefined);
  });

  it('normalizes delete and insert operations', () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const deleteObject = new ScriptObject('Account');
    deleteObject.operation = OPERATION.DeleteSource;
    deleteObject.externalId = 'Name';
    deleteObject.query = 'SELECT Id, Name FROM Account';
    deleteObject.setup(script);

    assert.equal(deleteObject.operation, OPERATION.Delete);
    assert.equal(deleteObject.deleteFromSource, true);
    assert.equal(deleteObject.externalId, 'Id');

    const insertObject = new ScriptObject('Contact');
    insertObject.operation = OPERATION.Insert;
    insertObject.externalId = 'Email';
    insertObject.query = 'SELECT Id, Email FROM Contact';
    insertObject.setup(script);

    assert.equal(insertObject.externalId, 'Id');
  });

  it('keeps delete-by-hierarchy as delete operation', () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const object = new ScriptObject('Account');
    object.operation = OPERATION.DeleteHierarchy;
    object.externalId = 'Name';
    object.query = 'SELECT Id, Name FROM Account';
    object.setup(script);

    assert.equal(object.operation, OPERATION.Delete);
    assert.equal(object.deleteByHierarchy, true);
    assert.equal(object.isHierarchicalDeleteOperation, true);
  });

  it('forces RecordType operation to readonly', () => {
    const script = new Script();
    const object = new ScriptObject('RecordType');
    object.operation = OPERATION.Upsert;
    object.query = 'SELECT Id FROM RecordType';
    object.setup(script);

    assert.equal(object.operation, OPERATION.Readonly);
  });

  it('adds person account fields and delete filters', () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.isPersonAccountEnabled = true;
    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    targetOrg.isPersonAccountEnabled = true;
    script.sourceOrg = sourceOrg;
    script.targetOrg = targetOrg;

    const object = new ScriptObject('Contact');
    object.deleteOldData = true;
    object.query = 'SELECT Id, Name FROM Contact WHERE Name != null';
    object.setup(script);

    assert.ok(object.query.includes('IsPersonAccount'));
    assert.ok(object.query.includes('AccountId'));
    assert.ok(object.deleteQuery.includes('IsPersonAccount'));
    assert.equal(object.excludedFieldsFromUpdate.includes('AccountId'), false);
  });

  it('builds target query using field mapping', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'Account__c';
    mappingItem.sourceField = 'Name';
    mappingItem.targetField = 'Title__c';
    object.fieldMapping = [mappingItem];
    object.query = 'SELECT Id, Name FROM Account';
    object.setup(script);

    const targetQuery = object.targetQuery;
    assert.ok(targetQuery.includes('FROM Account__c'));
    assert.ok(targetQuery.includes('Title__c'));
  });

  it('keeps mapped source fields when target describe contains mapped target field', () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    script.sourceOrg = sourceOrg;
    const targetOrg = new ScriptOrg();
    targetOrg.media = DATA_MEDIA_TYPE.Org;
    script.targetOrg = targetOrg;

    const accountObject = new ScriptObject('Account');
    accountObject.query = 'SELECT Id, Name FROM Account';
    accountObject.externalId = 'Name';
    accountObject.originalExternalId = 'Name';
    accountObject.setup(script);

    const object = new ScriptObject('TestObject2__c');
    object.useFieldMapping = true;
    object.operation = OPERATION.Upsert;
    object.query = "SELECT Id, Name, Account__c FROM TestObject2__c WHERE Name = 'SFDMU_FT_FIX60_UNIT'";

    const targetObjectMapping = new ScriptMappingItem();
    targetObjectMapping.targetObject = 'TestObject3__c';
    const nameMapping = new ScriptMappingItem();
    nameMapping.sourceField = 'Name';
    nameMapping.targetField = 'Test__c';
    const lookupToTextMapping = new ScriptMappingItem();
    lookupToTextMapping.sourceField = 'Account__c';
    lookupToTextMapping.targetField = 'Test2__c';
    object.fieldMapping = [targetObjectMapping, nameMapping, lookupToTextMapping];
    object.setup(script);

    const sourceDescribe = createDescribe('TestObject2__c', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Account__c', type: 'reference', updateable: true, creatable: true, lookup: true, custom: true },
    ]);
    const targetDescribe = createDescribe('TestObject3__c', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true, nameField: true },
      { name: 'Test__c', type: 'string', updateable: true, creatable: true },
      { name: 'Test2__c', type: 'string', updateable: true, creatable: true },
    ]);

    object.applyDescribe(sourceDescribe, targetDescribe);
    const sourceLookupField = object.sourceSObjectDescribe?.fieldsMap.get('Account__c');
    assert.ok(sourceLookupField);
    sourceLookupField.parentLookupObject = accountObject;
    object.ensureLookupFieldsInQuery();

    assert.ok(object.fieldsInQuery.includes('Account__c'));
    assert.ok(
      object.fieldsInQuery.some((fieldName) => fieldName.startsWith('Account__') && fieldName.endsWith('.Name'))
    );
    assert.ok(object.targetQuery.includes('Test2__c'));
    assert.ok(!object.targetQuery.includes('Test2__r.'));
  });

  it('maps where/order by fields in target query', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.useFieldMapping = true;

    const mappingItem = new ScriptMappingItem();
    mappingItem.targetObject = 'Account__c';
    mappingItem.sourceField = 'Name';
    mappingItem.targetField = 'Title__c';
    object.fieldMapping = [mappingItem];
    object.query = "SELECT Id, Name, CreatedDate FROM Account WHERE Name = 'ACC_1' ORDER BY Name DESC";
    object.setup(script);

    const targetQuery = object.targetQuery;
    assert.ok(targetQuery.includes('FROM Account__c'));
    assert.ok(targetQuery.includes("WHERE Title__c = 'ACC_1'"));
    assert.ok(targetQuery.includes('ORDER BY Title__c DESC'));
    assert.ok(targetQuery.includes('CreatedDate'));
  });

  it('filters fieldsToUpdate by readonly and excluded fields', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.operation = OPERATION.Update;
    object.query = 'SELECT Id, Name, Readonly__c FROM Account';
    object.setup(script);

    const describe = createDescribe('Account', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true },
      { name: 'Readonly__c', type: 'string', updateable: false, creatable: false },
    ]);

    object.applyDescribe(describe, describe);
    object.excludedFromUpdateFields = ['Name'];
    object.excludedFieldsFromUpdate = ['Readonly__c'];

    const fieldsToUpdate = object.fieldsToUpdate;
    assert.ok(!fieldsToUpdate.includes('Name'));
    assert.ok(!fieldsToUpdate.includes('Readonly__c'));
  });

  it('supports string values in excluded field lists without runtime crash', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.operation = OPERATION.Update;
    object.query = 'SELECT Id, Name, Type, Readonly__c FROM Account';
    object.setup(script);

    const describe = createDescribe('Account', [
      { name: 'Id', type: 'id', updateable: false, creatable: false },
      { name: 'Name', type: 'string', updateable: true, creatable: true },
      { name: 'Type', type: 'string', updateable: true, creatable: true },
      { name: 'Readonly__c', type: 'string', updateable: false, creatable: false },
    ]);

    object.excludedFields = 'Type' as unknown as string[];
    object.excludedFromUpdateFields = 'Name' as unknown as string[];
    object.excludedFieldsFromUpdate = 'Readonly__c' as unknown as string[];
    object.applyDescribe(describe, describe);

    const fieldsToUpdate = object.fieldsToUpdate;
    assert.ok(!object.fieldsInQuery.includes('Type'));
    assert.ok(!fieldsToUpdate.includes('Name'));
    assert.ok(!fieldsToUpdate.includes('Readonly__c'));
  });
});

describe('Script object errors', () => {
  it('keeps explicit master value from script', () => {
    const script = new Script();
    const object = new ScriptObject('Account');
    object.master = false;
    object.query = 'SELECT Id FROM Account';

    object.setup(script);

    assert.equal(object.master, false);
  });

  it('throws legacy malformed query message', () => {
    const originalLogger = Common.logger;
    Common.logger = createLoggingService();
    try {
      const script = new Script();
      const object = new ScriptObject('Account');
      object.query = 'SELECT FROM Account';
      assert.throws(
        () => object.setup(script),
        (error: unknown) => {
          const err = error as CommandInitializationError;
          assert.ok(err instanceof CommandInitializationError);
          assert.ok(err.message.includes('{Account} Malformed query string'));
          assert.ok(err.message.includes('Error message:'));
          return true;
        }
      );
    } finally {
      Common.logger = originalLogger;
    }
  });

  it('throws legacy external id missing message', () => {
    const originalLogger = Common.logger;
    Common.logger = createLoggingService();
    try {
      const script = new Script();
      const object = new ScriptObject('Account');
      object.externalId = 'Missing__c';
      object.query = 'SELECT Id, Missing__c FROM Account';
      object.setup(script);

      const describe = createDescribe('Account', [{ name: 'Id', type: 'id' }]);

      assert.throws(
        () => object.applyDescribe(describe),
        (error: unknown) => {
          const err = error as UnresolvableWarning;
          assert.ok(err instanceof UnresolvableWarning);
          assert.ok(err.message.includes('{Account} has no mandatory external Id field definition.'));
          return true;
        }
      );
    } finally {
      Common.logger = originalLogger;
    }
  });
});
