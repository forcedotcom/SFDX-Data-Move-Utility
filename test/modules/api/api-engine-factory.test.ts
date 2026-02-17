/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import type { Connection } from '@jsforce/jsforce-node';
import { API_ENGINE } from '../../../src/modules/common/Enumerations.js';
import { NOT_SUPPORTED_OBJECTS_IN_BULK_API } from '../../../src/modules/constants/Constants.js';
import ApiEngineFactory from '../../../src/modules/api/ApiEngineFactory.js';
import BulkApiV2Engine from '../../../src/modules/api/engines/BulkApiV2Engine.js';

describe('ApiEngineFactory', () => {
  it('uses REST API when below bulk threshold', () => {
    const connection = {} as Connection;
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: 'Account',
      amountToProcess: 10,
      bulkThreshold: 100,
      alwaysUseRest: false,
      bulkApiVersion: '2.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.REST_API);
  });

  it('uses Bulk API v1 when version is 1', () => {
    const connection = {} as Connection;
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: 'Account',
      amountToProcess: 200,
      bulkThreshold: 100,
      alwaysUseRest: false,
      bulkApiVersion: '1.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.BULK_API_V1);
  });

  it('uses Bulk API v2 when version is 2', () => {
    const connection = { bulk2: {} } as Connection;
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: 'Account',
      amountToProcess: 200,
      bulkThreshold: 100,
      alwaysUseRest: false,
      bulkApiVersion: '2.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.BULK_API_V2);
    assert.ok(engine instanceof BulkApiV2Engine);
    assert.equal(engine.getUseNativeBulkApi(), true);
  });

  it('falls back to REST API for unsupported objects', () => {
    const connection = {} as Connection;
    const unsupportedObject = NOT_SUPPORTED_OBJECTS_IN_BULK_API[0] ?? 'Attachment';
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: unsupportedObject,
      amountToProcess: 200,
      bulkThreshold: 100,
      alwaysUseRest: false,
      bulkApiVersion: '2.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.REST_API);
  });

  it('uses Bulk API when forceBulk is true even below threshold', () => {
    const connection = { bulk2: {} } as Connection;
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: 'Account',
      amountToProcess: 1,
      bulkThreshold: 100,
      alwaysUseRest: true,
      forceBulk: true,
      bulkApiVersion: '2.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.BULK_API_V2);
  });

  it('keeps REST API for unsupported objects even when forceBulk is true', () => {
    const connection = { bulk2: {} } as Connection;
    const unsupportedObject = NOT_SUPPORTED_OBJECTS_IN_BULK_API[0] ?? 'Attachment';
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName: unsupportedObject,
      amountToProcess: 1,
      bulkThreshold: 100,
      alwaysUseRest: false,
      forceBulk: true,
      bulkApiVersion: '2.0',
    });

    assert.equal(engine.getEngineType(), API_ENGINE.REST_API);
  });
});
