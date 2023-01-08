/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Type } from 'class-transformer';

import ScriptObject from './scriptObject';

export default class ScriptObjectSet {

  constructor(objects?: ScriptObject[]) {
    this.objects = objects;
  }

  @Type(() => ScriptObject)
  objects: ScriptObject[] = new Array<ScriptObject>();

}
