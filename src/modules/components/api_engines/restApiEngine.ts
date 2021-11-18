/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from '../../models/api_models';
import { IApiEngine, IApiJobCreateResult, ICsvChunk } from '../../models/api_models/helper_interfaces';
import { CONSTANTS } from '../common_components/statics';
import { RESOURCES } from '../common_components/logger';
import { Sfdx } from '../common_components/sfdx';
import { CsvChunks } from '../../models';
import { OPERATION } from '../common_components/enumerations';
import { Common } from '../common_components/common';







/**
 * Implementation of the Salesforce REST Api
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class RestApiEngine extends ApiEngineBase implements IApiEngine {

    constructor(init: IApiEngineInitParameters) {
        super(init);
    }



    // ----------------------- Interface IApiProcess ----------------------------------
    getEngineName(): string {
        return "REST API";
    }

    async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
        let connection = Sfdx.createOrgConnection(this.connectionData);
        let chunks: CsvChunks;
        if (!this.restApiBatchSize){
            chunks = new CsvChunks().fromArray(this.getSourceRecordsArray(allRecords));
        } else {
            let recordChunks = Common.chunkArray(this.getSourceRecordsArray(allRecords), this.restApiBatchSize);
            chunks = new CsvChunks().fromArrayChunks(recordChunks);
        }
        this.apiJobCreateResult = {
            chunks,
            apiInfo: new ApiInfo({
                jobState: "Undefined",
                strOperation: this.strOperation,
                sObjectName: this.sObjectName,
                jobId: "REST",
                batchId: "REST"
            }),
            allRecords,
            connection
        };
        return this.apiJobCreateResult;
    }

    async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {

        let self = this;

        return new Promise<Array<any>>((resolve, reject) => {

            self.loadBinaryDataFromCache(csvChunk.records);
           
            if (progressCallback) {
                // Progress message: operation started
                progressCallback(new ApiInfo({
                    jobState: "OperationStarted"
                }));
            }

            let connection = this.apiJobCreateResult.connection;
            let apiInfo = this.apiJobCreateResult.apiInfo;
            let records = csvChunk.records;
            let apiFunctionName: string;
            switch (this.operation) {
                case OPERATION.Insert: apiFunctionName = "create"; break;
                case OPERATION.Update: apiFunctionName = "update"; break;
                case OPERATION.Delete: apiFunctionName = "del"; break;
                default:
                    // ERROR RESULT
                    if (progressCallback) {
                        progressCallback(new ApiInfo({
                            jobState: "Failed",
                            errorMessage: this.logger.getResourceString(RESOURCES.invalidApiOperation),
                            jobId: apiInfo.jobId,
                            batchId: apiInfo.batchId
                        }));
                    }
                    // ERROR RESULT
                    resolve(null);
                    return;
            }
            // Progress message: job was created
            progressCallback(new ApiInfo({
                jobState: "Open",
                jobId: apiInfo.jobId
            }));
            connection.sobject(this.sObjectName)[apiFunctionName](records, {
                allOrNone: this.allOrNone,
                allowRecursive: true
            }, async function (error: any, resultRecords: any) {
                if (error) {
                    if (progressCallback) {
                        progressCallback(new ApiInfo({
                            jobState: "Failed",
                            errorMessage: error.message,
                            jobId: apiInfo.jobId,
                            batchId: apiInfo.batchId
                        }));
                    }
                    // ERROR RESULT
                    resolve(null);
                }
                records = self.getResultRecordsArray(records);
                records.forEach((record, index) => {
                    if (resultRecords[index].success) {
                        record[CONSTANTS.ERRORS_FIELD_NAME] = null;
                        if (self.operation == OPERATION.Insert && self.updateRecordId) {
                            record["Id"] = resultRecords[index].id;
                        }
                        self.numberJobRecordProcessed++;
                    } else {
                        record[CONSTANTS.ERRORS_FIELD_NAME] = resultRecords[index].errors[0].message;
                        self.numberJobRecordsFailed++;
                        self.numberJobRecordProcessed++;
                    }
                });
                if (progressCallback) {
                    if (self.numberJobRecordsFailed > 0)  {
                        // Some records are failed
                        progressCallback(new ApiInfo({
                            jobState: "JobComplete",
                            numberRecordsProcessed: self.numberJobRecordProcessed,
                            numberRecordsFailed: self.numberJobRecordsFailed,
                            jobId: apiInfo.jobId,
                            batchId: apiInfo.batchId
                        }));
                    }
                    // Progress message: operation finished
                    if (self.numberJobRecordProcessed == self.numberJobTotalRecordsToProcess){
                        progressCallback(new ApiInfo({
                            jobState: "OperationFinished",
                            numberRecordsProcessed: self.numberJobRecordProcessed,
                            numberRecordsFailed: self.numberJobRecordsFailed,
                            jobId: apiInfo.jobId,
                            batchId: apiInfo.batchId
                        }));
                    } else {
                        progressCallback (new ApiInfo({
                            jobState: "InProgress",
                            numberRecordsProcessed: self.numberJobRecordProcessed,
                            numberRecordsFailed: self.numberJobRecordsFailed,
                            jobId: apiInfo.jobId,
                            batchId: apiInfo.batchId
                        }));
                    }
                }
                //SUCCESS RESULT
                resolve(records);
            });
        });
    }

    getEngineClassType(): typeof ApiEngineBase {
        return RestApiEngine;
    }
    // ----------------------- ---------------- -------------------------------------------    



   

}
