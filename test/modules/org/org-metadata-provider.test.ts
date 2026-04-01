/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import { DATA_MEDIA_TYPE } from '../../../src/modules/common/Enumerations.js';
import type LoggingService from '../../../src/modules/logging/LoggingService.js';
import OrgMetadataProvider from '../../../src/modules/org/OrgMetadataProvider.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';

type DescribeFieldStubType = {
  name: string;
  label?: string;
  type?: string;
  nameField?: boolean;
  unique?: boolean;
  custom?: boolean;
  updateable?: boolean;
  createable?: boolean;
  calculated?: boolean;
  cascadeDelete?: boolean;
  referenceTo?: string[];
  length?: number;
  autoNumber?: boolean;
};

type DescribeObjectStubType = {
  name: string;
  label?: string;
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
  custom?: boolean;
  fields: DescribeFieldStubType[];
};

type ConnectionStubType = {
  sobject: (name: string) => {
    describe: () => Promise<DescribeObjectStubType>;
  };
  query: <T>(query: string) => Promise<{ records: T[]; done: boolean }>;
};

const createDescribeStub = (): DescribeObjectStubType => ({
  name: 'Account',
  label: 'Account',
  createable: true,
  updateable: true,
  deletable: true,
  custom: false,
  fields: [
    { name: 'Id', type: 'id', label: 'Id', createable: false, updateable: false },
    { name: 'Name', type: 'string', label: 'Name', createable: true, updateable: true, nameField: true },
    { name: 'OwnerId', type: 'reference', label: 'Owner', createable: true, updateable: true, referenceTo: ['User'] },
  ],
});

const createConnectionStub = (
  describe: DescribeObjectStubType,
  records: Array<Record<string, unknown>>
): ConnectionStubType => ({
  sobject: () => ({
    describe: async () => describe,
  }),
  query: async <T>(_query: string) => {
    void _query;
    return { records: records as T[], done: true };
  },
});

describe('OrgMetadataProvider', () => {
  it('maps describe results into object and field describes', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({ script });
      const result = await provider.describeSObjectAsync('Account', true);

      assert.equal(result.name, 'Account');
      assert.ok(result.fieldsMap.has('OwnerId'));
      const ownerField = result.fieldsMap.get('OwnerId');
      assert.equal(ownerField?.referencedObjectType, 'User');
      assert.equal(ownerField?.lookup, true);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('returns polymorphic field names from FieldDefinition', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    const describe = createDescribeStub();
    const records = [{ QualifiedApiName: 'OwnerId' }, { QualifiedApiName: 'WhatId' }];
    const connection = createConnectionStub(describe, records);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({ script });
      const fields = await provider.getPolymorphicObjectFieldsAsync('Account');

      assert.deepEqual(fields, ['OwnerId', 'WhatId']);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('keeps updateable independent from createable', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    const describe = createDescribeStub();
    describe.createable = false;
    describe.updateable = true;
    describe.deletable = true;
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({ script });
      const result = await provider.describeSObjectAsync('Account', true);

      assert.equal(result.createable, false);
      assert.equal(result.updateable, true);
      assert.equal(result.deletable, true);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('logs metadata retrieval with SOURCE/TARGET labels instead of org alias values', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'very-sensitive-org-alias';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    const logCalls: Array<{ message: string; tokens: string[] }> = [];
    const loggerStub = {
      log(message: string, ...tokens: string[]) {
        logCalls.push({ message, tokens });
      },
      getResourceString(key: string) {
        return key.toUpperCase();
      },
    } as unknown as LoggingService;
    script.logger = loggerStub;

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({ script });
      await provider.describeSObjectAsync('Account', true);

      assert.ok(logCalls.length > 0);
      const describeLog = logCalls.find((entry) => entry.message === 'retrievingObjectMetadata');
      assert.ok(describeLog);
      assert.deepEqual(describeLog?.tokens, ['Account', 'SOURCE']);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('accepts target record cache in options for cross-object-set lookups', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    // Create a target record cache
    const targetCache = new Map<string, Map<string, string>>();
    const accountCache = new Map<string, string>();
    accountCache.set('Acme Corporation', '001000000000001AAA');
    accountCache.set('Beta Industries', '001000000000002AAA');
    targetCache.set('Account', accountCache);

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({
        script,
        caches: { targetRecordCache: targetCache },
      });

      // Verify the provider was created successfully
      const result = await provider.describeSObjectAsync('Account', true);
      assert.equal(result.name, 'Account');

      // Verify the cache is still accessible (passed by reference)
      assert.equal(targetCache.size, 1);
      assert.ok(targetCache.has('Account'));
      assert.equal(targetCache.get('Account')?.get('Acme Corporation'), '001000000000001AAA');
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('accepts multiple cache types together including target record cache', async () => {
    const script = new Script();
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

    // Create all cache types
    const sourceDescribeCache = new Map();
    const targetDescribeCache = new Map();
    const polymorphicCache = new Map();
    const targetRecordCache = new Map<string, Map<string, string>>();

    // Populate target record cache with sample data
    const accountCache = new Map<string, string>();
    accountCache.set('Account-001', '001000000000001AAA');
    targetRecordCache.set('Account', accountCache);

    const contactCache = new Map<string, string>();
    contactCache.set('Contact-001', '003000000000001AAA');
    targetRecordCache.set('Contact', contactCache);

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({
        script,
        caches: {
          sourceDescribeCache,
          targetDescribeCache,
          polymorphicCache,
          targetRecordCache,
        },
      });

      // Verify provider works with all caches
      const result = await provider.describeSObjectAsync('Account', true);
      assert.equal(result.name, 'Account');

      // Verify target record cache is accessible
      assert.equal(targetRecordCache.size, 2);
      assert.ok(targetRecordCache.has('Account'));
      assert.ok(targetRecordCache.has('Contact'));
      assert.equal(targetRecordCache.get('Account')?.get('Account-001'), '001000000000001AAA');
      assert.equal(targetRecordCache.get('Contact')?.get('Contact-001'), '003000000000001AAA');
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('creates provider without target record cache when not provided', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      // Create provider without cache options
      const provider = new OrgMetadataProvider({ script });

      // Verify provider works without caches
      const result = await provider.describeSObjectAsync('Account', true);
      assert.equal(result.name, 'Account');
      assert.ok(result.fieldsMap.has('Name'));
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('supports target record cache with nested external ID values', async () => {
    const script = new Script();
    const sourceOrg = new ScriptOrg();
    sourceOrg.name = 'source';
    sourceOrg.media = DATA_MEDIA_TYPE.Org;
    sourceOrg.script = script;
    script.sourceOrg = sourceOrg;

    // Create cache with nested lookup values (simulating multi-level external IDs)
    const targetCache = new Map<string, Map<string, string>>();

    // Account cache (first object set)
    const accountCache = new Map<string, string>();
    accountCache.set('Acme Corporation', '001000000000001AAA');
    targetCache.set('Account', accountCache);

    // Opportunity cache (second object set, using Account.Name as external ID)
    const opportunityCache = new Map<string, string>();
    opportunityCache.set('Acme Corporation', '006000000000001AAA'); // externalId = Account.Name
    targetCache.set('Opportunity', opportunityCache);

    /* eslint-disable camelcase */
    // Quote cache (third object set, using Opportunity.Account.Name as external ID)
    const quoteCache = new Map<string, string>();
    quoteCache.set('Acme Corporation', '0Q6000000000001AAA'); // externalId = SBQQ__Opportunity2__r.Account.Name
    targetCache.set('SBQQ__Quote__c', quoteCache);
    /* eslint-enable camelcase */

    const describe = createDescribeStub();
    const connection = createConnectionStub(describe, []);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const provider = new OrgMetadataProvider({
        script,
        caches: { targetRecordCache: targetCache },
      });

      // Verify provider created successfully
      const result = await provider.describeSObjectAsync('Account', true);
      assert.equal(result.name, 'Account');

      // Verify multi-level cache structure
      assert.equal(targetCache.size, 3);
      assert.ok(targetCache.has('Account'));
      assert.ok(targetCache.has('Opportunity'));
      assert.ok(targetCache.has('SBQQ__Quote__c'));

      // Verify nested external ID resolution
      const accountId = targetCache.get('Account')?.get('Acme Corporation');
      const oppId = targetCache.get('Opportunity')?.get('Acme Corporation');
      const quoteId = targetCache.get('SBQQ__Quote__c')?.get('Acme Corporation');

      assert.equal(accountId, '001000000000001AAA');
      assert.equal(oppId, '006000000000001AAA');
      assert.equal(quoteId, '0Q6000000000001AAA');
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });
});
