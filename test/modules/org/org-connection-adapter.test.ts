/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import type { Connection } from '@jsforce/jsforce-node';
import { ORG_TEST_SOURCE_ENV, ORG_TEST_TARGET_ENV } from '../../../src/modules/constants/Constants.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';

describe('OrgConnectionAdapter', () => {
  it('resolves org info when a test org is configured', async function () {
    const aliasOrUsername = process.env[ORG_TEST_SOURCE_ENV];
    if (!aliasOrUsername) {
      this.skip();
    }

    const info = await OrgConnectionAdapter.testConnectionAsync(aliasOrUsername);

    assert.equal(info.aliasOrUsername, aliasOrUsername);
    assert.ok(info.username);
    assert.ok(info.orgId);
    assert.ok(info.instanceUrl);
    assert.ok(info.apiVersion);
  });

  it('resolves source and target orgs when env vars are configured', async function () {
    const sourceAliasOrUsername = process.env[ORG_TEST_SOURCE_ENV];
    const targetAliasOrUsername = process.env[ORG_TEST_TARGET_ENV];
    if (!sourceAliasOrUsername || !targetAliasOrUsername) {
      this.skip();
    }

    const pair = await OrgConnectionAdapter.resolveOrgPairAsync(sourceAliasOrUsername, targetAliasOrUsername);

    assert.ok(pair.sourceOrg);
    assert.ok(pair.targetOrg);
  });

  it('resolves max API version from org versions endpoint', async () => {
    const originalResolve = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    const originalConnection = OrgConnectionAdapter.getConnectionAsync.bind(OrgConnectionAdapter);

    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    OrgConnectionAdapter.getConnectionAsync = async () =>
      ({
        request: async () => [{ version: '61.0' }, { version: '64.0' }, { version: '63.0' }],
        getApiVersion: () => '59.0',
      } as unknown as Connection);

    try {
      const version = await OrgConnectionAdapter.resolveMaxApiVersionAsync('source');
      assert.equal(version, '64.0');
    } finally {
      OrgConnectionAdapter.resolveOrgAsync = originalResolve;
      OrgConnectionAdapter.getConnectionAsync = originalConnection;
    }
  });

  it('falls back to connection apiVersion when org versions endpoint is unavailable', async () => {
    const originalResolve = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    const originalConnection = OrgConnectionAdapter.getConnectionAsync.bind(OrgConnectionAdapter);

    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    OrgConnectionAdapter.getConnectionAsync = async () =>
      ({
        request: async () => ({ invalid: true }),
        getApiVersion: () => '62.0',
      } as unknown as Connection);

    try {
      const version = await OrgConnectionAdapter.resolveMaxApiVersionAsync('source');
      assert.equal(version, '62.0');
    } finally {
      OrgConnectionAdapter.resolveOrgAsync = originalResolve;
      OrgConnectionAdapter.getConnectionAsync = originalConnection;
    }
  });
});
