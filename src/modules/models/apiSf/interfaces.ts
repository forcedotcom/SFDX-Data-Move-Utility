/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { ICsvChunk, CsvChunks } from "../../components/commonUtils";
import { ApiInfo } from "./apiInfo";


export interface IApiJobCreateResult {
    chunks: CsvChunks,        
    jobCreateResult: ApiInfo,
    connection?: any,
    allRecords?: Array<any>
}

export interface IApiProcess {

    /**
     * Executes complete api operation 
     * including api job create and api job execute
     *
     * @param {Array<any>} allRecords The all source records to process
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<IApiJobCreateResult>} Returns null when unresolvable error occured
     * @memberof IApiProcess
     */
    executeCRUD(allRecords: Array<any>, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>>;

    /**
     * Creates api job
     * @param {Array<any>} allRecords The all source records to process
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    createCRUDApiJobAsync: (allrecords: Array<any>) => Promise<IApiJobCreateResult>;

    /**
     * Executes previously created api job.
     * Returns the same records as the input. 
     * On Insert operation will add a new Record Id value to each returned record.
     *
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<Array<any>>} Returns null when unresolvable error occured
     * @memberof IApiProcess
     */
    processCRUDApiJobAsync: (progressCallback: (progress: ApiInfo) => void) => Promise<Array<any>>;

    /**
     * Creates and executes api batch on the given chunk of the input records.
     * The function is a part of the api job execution.
     *
     * @param {ICsvChunk} csvChunk The part of the input 
     *                                  records to process with the batch
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<Array<any>>} Returns null when unresolvable error occured
     * @memberof IApiProcess
     */
    processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>>;

    /**
     * The name of the current api engine
     *
     * @returns {string}
     * @memberof IApiProcess
     */
    getEngineName(): string;

    /**
     * Return the name of the current api operation
     *
     * @returns {string}
     * @memberof IApiProcess
     */
    getStrOperation(): string;

}




