/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from '../../models/api_models';
import { CsvChunks, ICsvChunk } from '../common_components/commonUtils';
import { IApiEngine, IApiJobCreateResult } from '../../models/api_models/interfaces';
import { OPERATION } from '../common_components/statics';
import { RESOURCES } from '../common_components/messages';
import { Sfdx } from '../common_components/sfdx';




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
        let chunks = new CsvChunks().fromArray(this._getSourceRecordsArray(allRecords));
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
                records = self._getResultRecordsArray(records);
                records.forEach((record, index) => {
                    if (resultRecords[index].success) {
                        record["Errors"] = null;
                        if (self.operation == OPERATION.Insert && self.updateRecordId) {
                            record["Id"] = resultRecords[index].id;
                        }
                        self.numberJobRecordsSucceeded++;
                    } else {
                        record["Errors"] = resultRecords[index].errors[0].message;
                        self.numberJobRecordsFailed++;
                    }
                });
                if (progressCallback) {
                    // Progress message: operation finished
                    progressCallback(new ApiInfo({
                        jobState: "OperationFinished",
                        jobId: apiInfo.jobId,
                        batchId: apiInfo.batchId
                    }));
                }
                //SUCCESS RESULT
                resolve(records);
            });
        });
    }
    // ----------------------- ---------------- -------------------------------------------    



    // ----------------------- Private members -------------------------------------------        
    private _getSourceRecordsArray(records: Array<any>): Array<any> {
        if (this.operation == OPERATION.Delete) {
            return records.map(x => x["Id"]);
        } else {
            return records;
        }
    }

    private _getResultRecordsArray(records: Array<any>): Array<any> {
        if (this.operation == OPERATION.Delete) {
            return records.map(Id => {
                return {
                    Id
                };
            });
        } else {
            return records;
        }
    }

}
