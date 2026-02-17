/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';

describe('Script object sets', () => {
  it('adds User and Group for polymorphic lookups', () => {
    const account = new ScriptObject('Account');
    account.polymorphicLookups = [
      { fieldName: 'OwnerId', referencedObjectType: 'User' },
      { fieldName: 'OwnerId', referencedObjectType: 'Group' },
    ];
    const objectSet = new ScriptObjectSet([account]);

    objectSet.expandPolymorphicLookups();

    const names = objectSet.objects.map((obj) => obj.name);
    assert.ok(names.includes('User'));
    assert.ok(names.includes('Group'));
    const group = objectSet.objects.find((obj) => obj.name === 'Group');
    assert.equal(group?.externalId, '');
    assert.ok(group?.query.startsWith('SELECT Id FROM Group'));
    assert.ok(group?.query.includes("Type = 'Queue'"));
  });

  it('adds Group from explicit query targets', () => {
    const task = new ScriptObject('Task');
    task.query = 'SELECT OwnerId$Group, Subject FROM Task';
    const objectSet = new ScriptObjectSet([task]);

    objectSet.expandPolymorphicLookups();

    assert.ok(objectSet.objects.some((obj) => obj.name === 'Group'));
    assert.ok(!objectSet.objects.some((obj) => obj.name === 'User'));
  });

  it('adds only Group when an explicit target is specified', () => {
    const task = new ScriptObject('Task');
    task.polymorphicLookups = [{ fieldName: 'OwnerId', referencedObjectType: 'Group' }];
    const objectSet = new ScriptObjectSet([task]);

    objectSet.expandPolymorphicLookups();

    assert.ok(objectSet.objects.some((obj) => obj.name === 'Group'));
    assert.ok(!objectSet.objects.some((obj) => obj.name === 'User'));
  });

  it('adds User and Group when no explicit polymorphic target is specified', () => {
    const task = new ScriptObject('Task');
    task.polymorphicLookups = [{ fieldName: 'OwnerId' }];
    const objectSet = new ScriptObjectSet([task]);

    objectSet.expandPolymorphicLookups();

    assert.ok(objectSet.objects.some((obj) => obj.name === 'Group'));
    assert.ok(objectSet.objects.some((obj) => obj.name === 'User'));
  });

  it('preserves user-defined User query and adds Group', () => {
    const user = new ScriptObject('User');
    user.query = 'SELECT Id, Name FROM User WHERE IsActive = true';
    const opportunity = new ScriptObject('Opportunity');
    opportunity.polymorphicLookups = [{ fieldName: 'OwnerId', referencedObjectType: 'Group' }];
    const objectSet = new ScriptObjectSet([user, opportunity]);

    objectSet.expandPolymorphicLookups();

    const userAfter = objectSet.objects.find((obj) => obj.name === 'User');
    assert.equal(userAfter?.query, 'SELECT Id, Name FROM User WHERE IsActive = true');
    assert.ok(objectSet.objects.some((obj) => obj.name === 'Group'));
  });

  it('does not add Group when User exists without polymorphic lookups', () => {
    const user = new ScriptObject('User');
    user.query = 'SELECT Id, Name FROM User WHERE IsActive = true';
    const objectSet = new ScriptObjectSet([user]);

    objectSet.expandPolymorphicLookups();

    const names = objectSet.objects.map((obj) => obj.name);
    assert.ok(names.includes('User'));
    assert.ok(!names.includes('Group'));
  });

  it('does not add Group when User query is provided without name', () => {
    const user = new ScriptObject();
    user.query = 'SELECT Id, Name FROM User WHERE IsActive = true';
    const objectSet = new ScriptObjectSet([user]);

    objectSet.expandPolymorphicLookups();

    const names = objectSet.objects.map((obj) => obj.name);
    assert.ok(names.includes('User'));
    assert.ok(!names.includes('Group'));
  });

  it('does not add User when Group exists without polymorphic lookups', () => {
    const group = new ScriptObject('Group');
    group.query = "SELECT Id FROM Group WHERE Type = 'Queue'";
    const objectSet = new ScriptObjectSet([group]);

    objectSet.expandPolymorphicLookups();

    const names = objectSet.objects.map((obj) => obj.name);
    assert.ok(names.includes('Group'));
    assert.ok(!names.includes('User'));
  });

  it('merges User and Group lookup maps without overriding', () => {
    const userMap = new Map<string, string>([
      ['userKey', 'userId'],
      ['sharedKey', 'userShared'],
    ]);
    const groupMap = new Map<string, string>([
      ['sharedKey', 'groupShared'],
      ['groupKey', 'groupId'],
    ]);

    const script = new Script();
    const merged = script.mergeLookupMaps(userMap, groupMap);

    assert.equal(merged.get('userKey'), 'userId');
    assert.equal(merged.get('sharedKey'), 'userShared');
    assert.equal(merged.get('groupKey'), 'groupId');
  });
});
