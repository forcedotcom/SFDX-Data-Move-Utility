/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OPERATION } from "../../components/statics";
import { MigrationJobTask, ScriptOrg } from "..";


export default interface ICRUDApiProcess {

    /**
     * Creates CRUD job
     * @param {MigrationJobTask} task The task to create CRUD job for it
     * @param {ScriptOrg} org The target org
     * @param {OPERATION} operation The operation to perform
     * @param {Array<any>} records The source records
     * @returns {Promise<ICRUDJobCreateResult>} 
     * @memberof ICRUDApiProcess
     */
    createCRUDApiJobAsync: (task: MigrationJobTask, org: ScriptOrg, operation: OPERATION, records: Array<any>) => Promise<ICRUDJobCreateResult>;

    /**
     * Processed previously created CRUD job
     *
     * @param {ICRUDJobCreateResult} createJobResult The CRUD job create result
     * @returns {Promise<Array<any>>}
     * @memberof ICRUDApiProcess
     */
    processCRUDApiJobAsync: (createJobResult: ICRUDJobCreateResult) => Promise<Array<any>>;
}

export interface ICRUDJobCreateResult {
    job: any,
    cn: any,
    chunks: Array<Array<any>>,
    task: MigrationJobTask,
    org: ScriptOrg,
    operation: OPERATION
}
