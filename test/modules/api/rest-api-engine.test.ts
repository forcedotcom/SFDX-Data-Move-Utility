/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import type { Connection } from '@jsforce/jsforce-node';
import { OPERATION } from '../../../src/modules/common/Enumerations.js';
import RestApiEngine from '../../../src/modules/api/engines/RestApiEngine.js';

describe('RestApiEngine', () => {
  it('purges recycle bin after hard delete when supported', async () => {
    let destroyCalls = 0;
    let recycleBinCalls = 0;

    const connection = {
      destroy: async (_sObjectName: string, ids: string[] | string) => {
        destroyCalls += 1;
        const list = Array.isArray(ids) ? ids : [ids];
        return list.map((id) => ({ id, success: true, errors: [] }));
      },
      emptyRecycleBin: async (ids: string[] | string) => {
        recycleBinCalls += 1;
        const list = Array.isArray(ids) ? ids : [ids];
        return list.map((id) => ({ id, success: true, errors: [] }));
      },
    } as unknown as Connection;

    const engine = new RestApiEngine({
      connection,
      sObjectName: 'Account',
    });

    const results = await (
      engine as unknown as {
        _executeRestBatchAsync: (
          options: { operation: OPERATION; script: { allOrNone: boolean } },
          connection: Connection,
          sobject: Record<string, unknown>,
          records: Array<Record<string, unknown>>
        ) => Promise<Array<{ id?: string }>>;
      }
    )._executeRestBatchAsync(
      {
        operation: OPERATION.HardDelete,
        script: { allOrNone: false },
      },
      connection,
      {},
      [{ Id: '001000000000001AAA' }]
    );

    assert.equal(destroyCalls, 1);
    assert.equal(recycleBinCalls, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, '001000000000001AAA');
  });

  it('does not purge recycle bin for regular delete', async () => {
    let recycleBinCalls = 0;

    const connection = {
      destroy: async (_sObjectName: string, ids: string[] | string) => {
        const list = Array.isArray(ids) ? ids : [ids];
        return list.map((id) => ({ id, success: true, errors: [] }));
      },
      emptyRecycleBin: async (ids: string[] | string) => {
        void ids;
        recycleBinCalls += 1;
        return [];
      },
    } as unknown as Connection;

    const engine = new RestApiEngine({
      connection,
      sObjectName: 'Account',
    });

    await (
      engine as unknown as {
        _executeRestBatchAsync: (
          options: { operation: OPERATION; script: { allOrNone: boolean } },
          connection: Connection,
          sobject: Record<string, unknown>,
          records: Array<Record<string, unknown>>
        ) => Promise<Array<{ id?: string }>>;
      }
    )._executeRestBatchAsync(
      {
        operation: OPERATION.Delete,
        script: { allOrNone: false },
      },
      connection,
      {},
      [{ Id: '001000000000001AAA' }]
    );

    assert.equal(recycleBinCalls, 0);
  });
});
