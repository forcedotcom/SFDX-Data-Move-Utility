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
     * Executes complete api operation including job create and execute
     *
     * @param {Array<any>} records The source records
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    executeCRUD(records: Array<any>, progressCallback: (progress : ApiResult) => void) : Promise<Array<any>>;
  
    /**
     * Creates job
     * @param {Array<any>} records The source records
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    createCRUDApiJobAsync: (records: Array<any>) => Promise<IApiJobCreateResult>;

    /**
     * Executes previously created job.
     * Returns the same record set as the input. 
     * On Insert adds a Record Id property.
     *
     * @param {IApiJobCreateResult} createJobResult The job create result
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<Array<any>>}
     * @memberof IApiProcess
     */
    processCRUDApiJobAsync: (createJobResult : IApiJobCreateResult, progressCallback: (progress : ApiResult) => void) => Promise<Array<any>>;

  
}

