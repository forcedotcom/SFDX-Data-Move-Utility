/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '../../components/common_components/logger';
import { IOrgConnectionData, IFieldMapping } from '../common_models/helper_interfaces';
import { CsvChunks } from '..';
import { DATA_CACHE_TYPES, OPERATION } from '../../components/common_components/enumerations';
import { ApiEngineBase, ApiInfo } from '.';







/**
 * The Api process engine reference
 *
 * @export
 * @interface IApiProcess
 */
export interface IApiEngine {

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
     * Executes complete api operation in several threads in parallel
     * including api job create and api job execute 
     *
     * @param {Array<any>} allRecords
     * @param {(progress: ApiInfo) => void} progressCallback
     * @param {number} threadsCount The maximum threads count
     * @return {*}  {Promise<Array<any>>}
     * @memberof IApiEngine
     */
    executeCRUDMultithreaded(allRecords: Array<any>, progressCallback: (progress: ApiInfo) => void, threadsCount: number): Promise<Array<any>>;


    /**
     * Creates api job
     * @param {Array<any>} allRecords The all source records to process
     * @returns {Promise<IApiJobCreateResult>} 
     * @memberof IApiProcess
     */
    createCRUDApiJobAsync: (allrecords: Array<any>) => Promise<IApiJobCreateResult>;

    /**
    * Creates api job in simulation mode
    * @param {Array<any>} allRecords The all source records to process
    * @returns {Promise<IApiJobCreateResult>} 
    * @memberof IApiProcess
    */
    createCRUDSimulationJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult>;


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
     * Executes batch in a simulation mode
     * Returns the same records as the input. 
     * On Insert operation will create a new 
     * random Record Id value to each returned record.
     *
     * @param {Function} progressCallback The progress callback function
     * @returns {Promise<Array<any>>} Returns null when unresolvable error occured
     * @memberof IApiProcess
     */
    processCRUDSimulationBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>>;

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

    /**
     * Returns true if this is REST API  engine
     *
     * @return {*}  {boolean}
     * @memberof IApiEngine
     */
    getIsRestApiEngine(): boolean;

    /**
     * Returns the runtime type of the current engine
     *
     * @return {*}  {typeof ApiEngineBase}
     * @memberof IApiEngine
     */
    getEngineClassType(): typeof ApiEngineBase;

}

export interface IApiEngineInitParameters {
    logger: Logger,
    connectionData: IOrgConnectionData,
    sObjectName: string,
    operation: OPERATION,
    pollingIntervalMs: number,
    concurrencyMode: string,
    updateRecordId: boolean,
    targetCSVFullFilename: string,
    createTargetCSVFiles: boolean,
    bulkApiV1BatchSize?: number,
    restApiBatchSize?: number,
    allOrNone?: boolean,
    targetFieldMapping?: IFieldMapping,
    simulationMode?: boolean,
    binaryDataCache?: DATA_CACHE_TYPES;
    binaryCacheDirectory?: string;
    isChildJob?: boolean;
}

export interface ICsvChunk {
    records: Array<object>,
    csvString: string
}

export interface IApiJobCreateResult {
    chunks: CsvChunks,
    apiInfo: ApiInfo,
    connection?: any,
    allRecords?: Array<any>
}

/**
 * Holds the meta information about the blob record
 */
export interface IBlobField {

    objectName: string,
    fieldName: string,

    /**
     * Currently there is only base64 data type,
     * but optionally another type can be added.
     */
    dataType: 'base64' // | ....
}


export interface ICachedRecords {
    query: string;
    records: any[];
}
