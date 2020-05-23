import * as SfdmModels from './models/index';
import { CommonUtils } from './common';
var zlib = require('zlib'); 


export const ALL_SUPPORTED_METADATA_TYPES = [
    "ApexTrigger",
    "WorkflowRule", 
    "FlowDefinition",
    "ValidationRule",
    "LookupFilter"
];

export interface IPropertyChange {
    old: any;
    new: any;
    propertyName: string;
}

export class MetadataItem {

    constructor(init?: Partial<MetadataItem>) {
        Object.assign(this, init);
    }

    isActive: boolean = false;

    fullName: string;
    objectName: string;

    type: string;
    metadataApiType: string;

    id: string;

    listMetadataResult: any;
    readMetadataResult: any;
    toolingApiResult: any;

    changedProps: Array<IPropertyChange> = new Array<IPropertyChange>();

    get statusUpdated(): boolean {
        return this.changedProps.length > 0;
    }
}


export class MetadataApiSf {

    sOrg: SfdmModels.SOrg;

    /**
     * The map between metadata type and all the metadata related to this type
     *
     * @type {Map<String, Array<MetadataItem>>}
     * @memberof MetadataApiSf
     */
    metaTypeToMetadataItemsMap: Map<string, Array<MetadataItem>> = new Map<string, Array<MetadataItem>>();

    constructor(sOrg: SfdmModels.SOrg) {
        this.sOrg = sOrg;
    }


    /**
     * Retrieves metadata list of the given types.
     * The method retrieves only unmanaged metadata.
     *
     * @param {Array<string>} objectNames The name of the objects to retireve metadata related to those objects.
     * @returns {Promise<any>} 
     * @memberof MetadataApiSf
     */
    async listMetadataAsync(objectNames: Array<string>): Promise<any> {

        let _this = this;

        return new Promise<any>(async resolve => {

            let promises = [];

            ALL_SUPPORTED_METADATA_TYPES.forEach(metadataType => {

                this.metaTypeToMetadataItemsMap.set(metadataType, new Array<MetadataItem>());

                switch (metadataType) {

                    case "ApexTrigger":
                        promises = promises.concat(_this._triggersAsync(objectNames));
                        break;

                    case "WorkflowRule":
                        promises = promises.concat(_this._workflowRulesAsync(objectNames));
                        break;

                    case "ValidationRule":
                        promises = promises.concat(_this._validationRulesAsync(objectNames));
                        break;


                    case "FlowDefinition":
                        promises = promises.concat(_this._flowsDefinitionsAsync());
                        break;


                    case "LookupFilter":
                        promises = promises.concat(_this._lookupFiltersAsync(objectNames));
                        break;

                }

            });

            await Promise.all(promises);

            resolve();

        });
    }

    /**
     * Method to activate / deactivate given metadata items
     *
     * @param {Array<MetadataItem>} metdataItems Items to activate/ deactivate
     * @param {any} activeValue true - to activate metadata, false - to deactivate it, 
     *                                  you also can pass explicit value to activate the item
     * @returns {Promise<any>} 
     * @memberof MetadataApiSf
     */
    async activateOrDeactivateMetadataAsync(metdataItems: Array<MetadataItem>, activeValue: any): Promise<any> {

        return new Promise<any>(async resolve => {

            for (let index = 0; index < metdataItems.length; index++) {

                const itemToUpdate = metdataItems[index];

                switch (itemToUpdate.type) {

                    case "ApexTrigger":
                        // await this._metadataApi_UpdateOrgMetadataAsync(itemToUpdate, new Map([
                        //     ["status", activate ? "Active" : "Inactive"]
                        // ]));
                        break;

                    case "WorkflowRule":

                        break;

                    case "ValidationRule":

                        break;

                    case "FlowDefinition":
                        // await this._updateMetadataSync(itemToUpdate, new Map([
                        //     ["activeVersionNumber", activeValue]
                        // ]));
                        break;


                    case "LookupFilter":
                        await this._updateMetadataSync(itemToUpdate, new Map());

                        break;

                }
            }

            resolve();

        });
    }


    // ----------------------- Private members -------------------------------------------
    private async _queryToolingAsync(
        metadataType: string,
        query: object,
        fields: Array<string>,
        fn: (metadata: any) => MetadataItem): Promise<Array<MetadataItem>> {

        let conn = this.sOrg.getConnection();
        let metadataItems = new Array<MetadataItem>();

        return new Promise<Array<MetadataItem>>(resolve => {
            conn.tooling.sobject(metadataType)
                .find(query, fields)
                .execute(function (err: any, metadata: any) {
                    if (err) {
                        resolve(metadataItems);
                        return;
                    }
                    metadata.forEach(meta => {
                        metadataItems.push(fn(meta));
                    });
                    resolve(metadataItems);
                });
        });
    }

    private async _readMetadataAsync(
        metadataType: string,
        metaItems: Array<MetadataItem>,
        fn: (metaItem: MetadataItem, metadata: any) => void,
        apiNameProp: string = "fullName"): Promise<Array<any>> {

        let _this = this;

        return new Promise<Array<any>>(async resolve => {

            let conn = this.sOrg.getConnection();
            let metaMap = new Map<string, MetadataItem>();

            async function read(chunk: Array<string>) {
                return new Promise<Array<any>>(resolve => {
                    conn.metadata.read(metadataType, chunk, function (err: any, metadata: any) {
                        //TEST:
                        let mm = metadataType;
                        if (err) {
                            resolve(new Array<any>());
                            return;

                        }
                        if (Array.isArray(metadata)) {
                            metadata.forEach(meta => {
                                let fullName = metaMap.get(meta.fullName);
                                fullName && fn(metaMap.get(meta.fullName), meta);
                            });
                        } else {
                            let fullName = metaMap.get(metadata.fullName);
                            fullName && fn(metaMap.get(metadata.fullName), metadata);
                        }
                        resolve([].concat(metadata));
                    });
                });
            }

            metaItems.forEach(x => metaMap.set(x[apiNameProp], x));
            let metaKeys = [...metaMap.keys()];

            let chunks = CommonUtils.chunkArray(metaKeys, 10);
            let ret = new Array<string>();

            for (let index = 0; index < chunks.length; index++) {
                let chunk = chunks[index];
                ret = ret.concat(await read(chunk));
            }

            resolve(ret);

        });
    }

    private async _listMetadataAsync(metadataType: string,
        fn: (metadata: any) => MetadataItem): Promise<Array<MetadataItem>> {

        return new Promise<Array<MetadataItem>>(resolve => {

            let conn = this.sOrg.getConnection();
            let metadataItems = new Array<MetadataItem>();

            conn.metadata.list({
                type: metadataType
            }, this.sOrg.version, function (err: any, listMetadataResults: any) {
                if (err || !listMetadataResults || listMetadataResults.length == 0) {
                    resolve(metadataItems);
                    return;
                }
                listMetadataResults.forEach((listMetadataResult: any) => {
                    if (listMetadataResult.manageableState == 'unmanaged') {
                        metadataItems.push(fn(listMetadataResult));
                    }
                });
                resolve(metadataItems);
            });
        });
    }


    private async _updateMetadataSync(itemToUpdate: MetadataItem, propMapToUpdate: Map<string, any>): Promise<any> {

        return new Promise<any>(async resolve => {

            itemToUpdate.changedProps = new Array<IPropertyChange>();

            if (!itemToUpdate.readMetadataResult) {
                resolve();
                return;
            }

            let keys = [...propMapToUpdate.keys()];
            let oldMetadata = Object.assign({}, itemToUpdate.readMetadataResult);
            keys.forEach(key => {
                if (propMapToUpdate.get(key) != null) {
                    itemToUpdate.readMetadataResult[key] = propMapToUpdate.get(key);
                } else {
                    delete itemToUpdate.readMetadataResult;
                }
            });

            let conn = this.sOrg.getConnection();
            try {
                conn.metadata.update(itemToUpdate.metadataApiType, [itemToUpdate.readMetadataResult], function (err: any, results: any) {

                    if (err || !results.success) {
                        resolve();
                        return;
                    }

                    itemToUpdate.changedProps = keys.map(key => {
                        let ret = {
                            old: oldMetadata[key],
                            new: itemToUpdate.readMetadataResult[key],
                            propertyName: key
                        };
                        return ret;
                    });

                    resolve();

                });
            } catch (ex) {
                resolve();
            }
        });
    }


    private async _updateToolingSync(itemToUpdate: MetadataItem, propMapToUpdate: Map<string, any>): Promise<any> {

    }


    // *********** Metadata Entities ***************
    private async _triggersAsync(objectNames: Array<string>): Promise<any> {

        return new Promise<any>(async resolve => {

            let metaItems = await this._queryToolingAsync("ApexTrigger", {
                ManageableState: 'unmanaged'
            }, [
                "TableEnumOrId",
                "Id",
                "Name",
                "Body",
                "Status"
            ], (toolingApiResult: any) => new MetadataItem({
                type: "ApexTrigger",
                objectName: toolingApiResult.TableEnumOrId,
                id: toolingApiResult.Id,
                fullName: toolingApiResult.Name,
                isActive: toolingApiResult.Status == "Active",
                toolingApiResult
            }));

            // ????
            await this._readMetadataAsync("ApexTrigger", metaItems,
                (metaItem: MetadataItem, readMetadataResult: any) => {
                    metaItem.readMetadataResult = readMetadataResult;
                    metaItem.metadataApiType = "ApexTrigger";
                });

            metaItems.forEach(metaItem => {
                if (objectNames.indexOf(metaItem.objectName) >= 0) {
                    this.metaTypeToMetadataItemsMap.get(metaItem.type).push(metaItem);
                }
            });
            resolve();
        });
    }

    private async _workflowRulesAsync(objectNames: Array<string>): Promise<any> {

        return new Promise<any>(async resolve => {
            let metaItems = await this._queryToolingAsync("WorkflowRule", {
                ManageableState: 'unmanaged'
            }, [
                "TableEnumOrId",
                "Id",
                "Name"
            ], (toolingApiResult: any) => new MetadataItem({
                type: "WorkflowRule",
                objectName: toolingApiResult.TableEnumOrId,
                id: toolingApiResult.Id,
                fullName: toolingApiResult.TableEnumOrId + "." + toolingApiResult.Name
            }));
            metaItems = metaItems.filter(metaItem => objectNames.indexOf(metaItem.objectName) >= 0);

            await this._readMetadataAsync("WorkflowRule", metaItems,
                (metaItem: MetadataItem, readMetadataResult: any) => {
                    metaItem.isActive = readMetadataResult.active == "true";
                    metaItem.readMetadataResult = readMetadataResult;
                    metaItem.metadataApiType = "WorkflowRule";
                });
            metaItems.forEach(metaItem => {
                this.metaTypeToMetadataItemsMap.get(metaItem.type).push(metaItem);
            });
            resolve();
        });
    }

    private async _flowsDefinitionsAsync(): Promise<any> {

        return new Promise<any>(async resolve => {
            let metaItems = await this._listMetadataAsync("FlowDefinition", listMetadataResult => {
                return new MetadataItem({
                    type: "FlowDefinition",
                    objectName: "Global",
                    id: listMetadataResult.id,
                    fullName: listMetadataResult.fullName,
                    listMetadataResult,
                })
            });
            await this._readMetadataAsync("FlowDefinition", metaItems,
                (metaItem: MetadataItem, readMetadataResult: any) => {
                    metaItem.isActive = !!readMetadataResult.activeVersionNumber;
                    metaItem.readMetadataResult = readMetadataResult;
                    metaItem.metadataApiType = "FlowDefinition";
                    this.metaTypeToMetadataItemsMap.get(metaItem.type).push(metaItem);
                });
            resolve();
        });

    }

    private async _validationRulesAsync(objectNames: Array<string>): Promise<any> {

        return new Promise<any>(async resolve => {
            let metaItems = await this._queryToolingAsync("ValidationRule", {
                ManageableState: 'unmanaged'
            }, [
                "EntityDefinitionId",
                "Id",
                "ValidationName",
                "Active"
            ], (toolingApiResult: any) => new MetadataItem({
                type: "ValidationRule",
                objectName: toolingApiResult.EntityDefinitionId,
                id: toolingApiResult.Id,
                fullName: toolingApiResult.EntityDefinitionId + "." + toolingApiResult.ValidationName,
                isActive: toolingApiResult.Active,
                toolingApiResult
            }));

            await this._readMetadataAsync("ValidationRule", metaItems,
                (metaItem: MetadataItem, readMetadataResult: any) => {
                    metaItem.readMetadataResult = readMetadataResult;
                    metaItem.metadataApiType = "ValidationRule";
                });

            metaItems.forEach(metaItem => {
                if (objectNames.indexOf(metaItem.objectName) >= 0) {
                    this.metaTypeToMetadataItemsMap.get(metaItem.type).push(metaItem);
                }
            });
            resolve();
        });

    }

    private async _lookupFiltersAsync(objectNames: Array<string>): Promise<any> {

        return new Promise<any>(async resolve => {
            let metaItems = await this._queryToolingAsync("LookupFilter", {
                ManageableState: 'unmanaged'
            }, [
                "SourceFieldDefinitionId",
                "Id",
                "TargetEntityDefinitionId",
                "DeveloperName",
                "Active"
            ], (toolingApiResult: any) => new MetadataItem({
                type: "LookupFilter",
                objectName: toolingApiResult.SourceFieldDefinitionId.split('.')[0],
                id: toolingApiResult.Id,
                fullName: toolingApiResult.TargetEntityDefinitionId + "." + toolingApiResult.DeveloperName,
                isActive: toolingApiResult.Active,
                toolingApiResult
            }));

            // ???? => LookupFilter = CustomObject
            metaItems = metaItems.filter(metaItem => objectNames.indexOf(metaItem.objectName) >= 0);

            await this._readMetadataAsync("CustomObject", metaItems,
                (metaItem: MetadataItem, readMetadataResult: any) => {
                    metaItem.readMetadataResult = readMetadataResult;
                    metaItem.metadataApiType = "CustomObject";
                }, "objectName");

            metaItems.forEach(metaItem => {
                this.metaTypeToMetadataItemsMap.get(metaItem.type).push(metaItem);
            });

            resolve();
        });
    }




}