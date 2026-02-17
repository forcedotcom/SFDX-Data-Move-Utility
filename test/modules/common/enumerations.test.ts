/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import { DATA_MEDIA_TYPE, OPERATION } from '../../../src/modules/common/Enumerations.js';

describe('Enumerations', () => {
  it('exposes enum values', () => {
    assert.equal(DATA_MEDIA_TYPE.Org, 0);
    assert.equal(OPERATION.Insert, 0);
  });
});
