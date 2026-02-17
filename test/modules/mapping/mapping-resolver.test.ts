/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import AddonMappingAdapter from '../../../src/modules/mapping/AddonMappingAdapter.js';
import MappingResolver from '../../../src/modules/mapping/MappingResolver.js';
import ScriptMappingItem from '../../../src/modules/models/script/ScriptMappingItem.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';

describe('MappingResolver', () => {
  it('builds object and field mappings from script objects', () => {
    const account = new ScriptObject('Account');
    account.useFieldMapping = true;
    const objectMapping = new ScriptMappingItem();
    objectMapping.targetObject = 'Account__c';
    objectMapping.sourceField = 'Name';
    objectMapping.targetField = 'Title__c';
    const ownerMapping = new ScriptMappingItem();
    ownerMapping.sourceField = 'OwnerId';
    ownerMapping.targetField = 'Owner__c';
    account.fieldMapping = [objectMapping, ownerMapping];

    const resolver = new MappingResolver();
    resolver.addScriptObjects([account]);

    assert.equal(resolver.mapObjectNameToTarget('Account'), 'Account__c');
    assert.equal(resolver.mapObjectNameToSource('Account__c'), 'Account');
    assert.equal(resolver.mapFieldNameToTarget('Account', 'Name'), 'Title__c');
    assert.equal(resolver.mapFieldNameToSource('Account__c', 'Title__c'), 'Name');
    assert.equal(resolver.mapFieldNameToTarget('Account', 'Owner'), 'Owner__r');
  });

  it('maps records between source and target field names', () => {
    const account = new ScriptObject('Account');
    account.useFieldMapping = true;
    const objectMapping = new ScriptMappingItem();
    objectMapping.targetObject = 'Account__c';
    objectMapping.sourceField = 'Name';
    objectMapping.targetField = 'Title__c';
    const ownerMapping = new ScriptMappingItem();
    ownerMapping.sourceField = 'OwnerId';
    ownerMapping.targetField = 'Owner__c';
    account.fieldMapping = [objectMapping, ownerMapping];

    const resolver = new MappingResolver();
    resolver.addScriptObjects([account]);
    const sourceRecord = { Id: '001', Name: 'Acme', OwnerId: '005' };

    const targetRecord = resolver.mapRecordToTarget('Account', sourceRecord);
    /* eslint-disable camelcase */
    assert.deepEqual(targetRecord, { Id: '001', Title__c: 'Acme', Owner__c: '005' });

    const restored = resolver.mapRecordToSource('Account__c', targetRecord);
    assert.deepEqual(restored, { Id: '001', Name: 'Acme', OwnerId: '005' });
  });

  it('maps polymorphic field types using object mappings', () => {
    const oldObject = new ScriptObject('OldObject__c');
    oldObject.useFieldMapping = true;
    const objectMapping = new ScriptMappingItem();
    objectMapping.targetObject = 'NewObject__c';
    oldObject.fieldMapping = [objectMapping];

    const oldAccount = new ScriptObject('OldAccount__c');
    oldAccount.useFieldMapping = true;
    const accountMapping = new ScriptMappingItem();
    accountMapping.targetObject = 'NewAccount__c';
    oldAccount.fieldMapping = [accountMapping];

    const resolver = new MappingResolver();
    resolver.addScriptObjects([oldObject, oldAccount]);

    const sourceField = 'Polymorphic__c$OldAccount__c';
    const targetField = 'Polymorphic__c$NewAccount__c';

    assert.equal(resolver.mapFieldNameToTarget('OldObject__c', sourceField), targetField);
    assert.equal(resolver.mapFieldNameToSource('NewObject__c', targetField), sourceField);

    const sourceRecord = { Polymorphic__c$OldAccount__c: 'a0B001' };
    const targetRecord = resolver.mapRecordToTarget('OldObject__c', sourceRecord);
    assert.deepEqual(targetRecord, { Polymorphic__c$NewAccount__c: 'a0B001' });
  });
});

describe('AddonMappingAdapter', () => {
  it('maps records to addon-visible names', () => {
    const account = new ScriptObject('Account');
    account.useFieldMapping = true;
    const objectMapping = new ScriptMappingItem();
    objectMapping.targetObject = 'Account__c';
    objectMapping.sourceField = 'Name';
    objectMapping.targetField = 'Title__c';
    account.fieldMapping = [objectMapping];

    const resolver = new MappingResolver();
    resolver.addScriptObjects([account]);
    const adapter = new AddonMappingAdapter(resolver);

    const internalRecord = { Id: '001', Title__c: 'Acme' };
    const addonRecord = adapter.mapRecordToAddon('Account__c', internalRecord);

    assert.deepEqual(addonRecord, { Id: '001', Name: 'Acme' });
    assert.equal(adapter.mapObjectNameToAddon('Account__c'), 'Account');
    assert.equal(adapter.mapObjectNameFromAddon('Account'), 'Account__c');
  });
});
