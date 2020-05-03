/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OPERATION } from "../../components/statics";
import { MigrationJobTask, ScriptOrg, IApiJobCreateResult as IApiJobCreateResult, ApiResult } from "..";


export default interface IApiProcess {

    /**
     * Executes CRUD (creates and processes the CRUD job in single action)
     * Returns the same records as input. On Insert adds record id property.
     *
     * @param {OPERATION} operation The operation to perform
     * @param {Array<any>} records The source records
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    executeCRUD(operation: OPERATION, records: Array<any>, progressCallback: (progress : ApiResult) => void) : Promise<Array<any>>;
  
    /**
     * Creates CRUD job
     * @param {OPERATION} operation The operation to perform
     * @param {Array<any>} records The source records
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    createCRUDApiJobAsync: (operation: OPERATION, records: Array<any>) => Promise<IApiJobCreateResult>;

    /**
     * Processed previously created CRUD job
     * Returns the same records as input. On Insert adds record id property.
     *
     * @param {IApiJobCreateResult} createJobResult The CRUD job create result
     * @returns {Promise<Array<any>>}
     * @memberof IApiProcess
     */
    processCRUDApiJobAsync: (createJobResult : IApiJobCreateResult, progressCallback: (progress : ApiResult) => void) => Promise<Array<any>>;

  
}

