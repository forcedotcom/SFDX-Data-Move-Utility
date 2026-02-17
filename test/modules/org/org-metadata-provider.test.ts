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
});
