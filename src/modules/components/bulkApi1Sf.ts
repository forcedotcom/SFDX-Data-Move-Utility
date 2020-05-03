/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { CommonUtils } from "./commonUtils";
import parse = require('csv-parse/lib/sync');
import { MessageUtils, RESOURCES } from "./messages";
import { RESULT_STATUSES, OPERATION } from "./statics";
import { BulkAPIResult, BulkApiResultRecord, ICRUDApiProcess, MigrationJobTask, ScriptOrg, ICRUDJobCreateResult } from "../models";
const request = require('request');
const endpoint = '/services/data/[v]/jobs/ingest';
const requestTimeout = 10 * 60 * 1000;// 10 minutes of timeout for long-time operations and for large csv files and slow internet connection


/**
 * Implementation of the Salesforce Bulk API v2.0
 *
 * @export
 * @class BulkApi2sf
 */
export class BulkApi1sf implements ICRUDApiProcess {


    constructor(logger: MessageUtils){
        
    }    


    // ----------------------- Interface ICRUDApiProcess ----------------------------------
    async createCRUDApiJobAsync(task: MigrationJobTask, org: ScriptOrg, operation: OPERATION, records: Array<any>) : Promise<ICRUDJobCreateResult>{
        // TODO: Implement this

    }

    async processCRUDApiJobAsync(createJobResult : ICRUDJobCreateResult) : Promise<Array<any>> {
        // TODO: Implement this
    }
    // ----------------------- ---------------- -------------------------------------------    

}
