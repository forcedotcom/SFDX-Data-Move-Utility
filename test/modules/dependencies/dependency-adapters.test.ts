/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import CjsDependencyAdapters from '../../../src/modules/dependencies/CjsDependencyAdapters.js';
import {
  deepCloneAsync,
  deepCloneSync,
  glob,
  parseCsv,
  throttleAll,
} from '../../../src/modules/dependencies/EsmDependencies.js';

describe('dependency adapters', () => {
  it('loads CommonJS dependencies via adapters', () => {
    const alasql = CjsDependencyAdapters.getAlasql();
    assert.equal(typeof alasql, 'function');

    const casual = CjsDependencyAdapters.getCasual() as Record<string, unknown>;
    assert.ok(casual);

    const csvWriter = CjsDependencyAdapters.getCsvWriter();
    assert.equal(typeof csvWriter.createObjectCsvWriter, 'function');

    const classTransformer = CjsDependencyAdapters.getClassTransformer();
    assert.equal(typeof classTransformer.instanceToPlain, 'function');

    const soqlParser = CjsDependencyAdapters.getSoqlParser();
    assert.equal(typeof soqlParser.parseQuery, 'function');

    CjsDependencyAdapters.loadEs6Shim();
    CjsDependencyAdapters.loadReflectMetadata();
  });

  it('exposes native ESM dependencies', () => {
    assert.equal(typeof parseCsv, 'function');
    assert.equal(typeof glob, 'function');
    assert.equal(typeof deepCloneAsync, 'function');
    assert.equal(typeof deepCloneSync, 'function');
    assert.equal(typeof throttleAll, 'function');
  });
});
