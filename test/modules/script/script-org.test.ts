/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as os from 'node:os';
import { DATA_MEDIA_TYPE, OPERATION } from '../../../src/modules/common/Enumerations.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import { CommandAbortedByUserError } from '../../../src/modules/models/common/CommandAbortedByUserError.js';
import { CommandInitializationError } from '../../../src/modules/models/common/CommandInitializationError.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';

type ConnectionStubType = {
  accessToken?: string;
  instanceUrl?: string;
  baseUrl?: () => string;
  getAuthInfoFields?: () => { username?: string; instanceUrl?: string };
  singleRecordQuery?: <T>(query: string) => Promise<T>;
  query?: <T>(query: string) => Promise<{ records: T[] }>;
};

const createLogger = (
  promptWriter?: (message: string) => Promise<boolean>,
  textPromptWriter?: (message: string) => Promise<string>
): LoggingService =>
  new LoggingService(
    new LoggingContext({
      commandName: 'run',
      rootPath: os.tmpdir(),
      fileLogEnabled: false,
      promptWriter,
      textPromptWriter,
    })
  );

describe('ScriptOrg', () => {
  it('sets connection details and validates org info', async () => {
    const script = new Script();
    script.logger = createLogger();

    const org = new ScriptOrg();
    org.name = 'source';
    org.script = script;
    org.media = DATA_MEDIA_TYPE.Org;

    const connection: ConnectionStubType = {
      accessToken: 'token',
      instanceUrl: 'https://example.my.salesforce.com',
      baseUrl: () => 'https://example.my.salesforce.com',
      getAuthInfoFields: () => ({ username: 'user@example.com', instanceUrl: 'https://example.my.salesforce.com' }),
      singleRecordQuery: async <T>() =>
        ({
          OrganizationType: 'Enterprise Edition',
          IsSandbox: false,
        } as T),
      query: async <T>() => ({ records: [{ IsPersonAccount: true }] as T[] }),
    };

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      await org.setupAsync(true);

      assert.equal(org.isSource, true);
      assert.equal(org.orgUserName, 'user@example.com');
      assert.equal(org.instanceUrl, 'https://example.my.salesforce.com');
      assert.equal(org.accessToken, 'token');
      assert.equal(org.organizationType, 'Enterprise Edition');
      assert.equal(org.isSandbox, false);
      assert.equal(org.isPersonAccountEnabled, true);
      assert.equal(org.isConnected, true);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('throws access token expired when org validation fails', async () => {
    const script = new Script();
    script.logger = createLogger();

    const org = new ScriptOrg();
    org.name = 'source';
    org.script = script;
    org.media = DATA_MEDIA_TYPE.Org;

    const connection: ConnectionStubType = {
      accessToken: 'token',
      instanceUrl: 'https://example.my.salesforce.com',
      getAuthInfoFields: () => ({ username: 'user@example.com', instanceUrl: 'https://example.my.salesforce.com' }),
      singleRecordQuery: async <T>() => {
        const unused = null as unknown as T;
        void unused;
        throw new Error('invalid');
      },
    };

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      await assert.rejects(
        org.setupAsync(true),
        (error: unknown) =>
          error instanceof CommandInitializationError &&
          error.message.includes('Access token to the source has been expired')
      );
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('prompts before production modifications', async () => {
    const logger = createLogger(undefined, async () => '');
    const script = new Script();
    script.logger = logger;

    const org = new ScriptOrg();
    org.script = script;
    org.media = DATA_MEDIA_TYPE.Org;
    org.instanceUrl = 'https://demo.my.salesforce.com';
    org.organizationType = 'Enterprise Edition';
    org.isSandbox = false;
    org.isSource = false;

    await assert.rejects(
      org.promptUserForProductionModificationAsync(),
      (error: unknown) => error instanceof CommandAbortedByUserError
    );
  });

  it('prompts for delete-from-source operations in production', async () => {
    const logger = createLogger(undefined, async () => '');
    const script = new Script();
    script.logger = logger;
    script.objectSets = [new ScriptObjectSet([new ScriptObject('Account')])];
    script.objectSets[0].objects[0].operation = OPERATION.DeleteSource;

    const org = new ScriptOrg();
    org.script = script;
    org.media = DATA_MEDIA_TYPE.Org;
    org.instanceUrl = 'https://demo.my.salesforce.com';
    org.organizationType = 'Enterprise Edition';
    org.isSandbox = false;
    org.isSource = true;

    await assert.rejects(
      org.promptUserForProductionModificationAsync(),
      (error: unknown) => error instanceof CommandAbortedByUserError
    );
  });
});
