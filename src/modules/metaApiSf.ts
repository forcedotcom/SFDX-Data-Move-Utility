import * as SfdmModels from './models/index';

export const METADATA_TYPES = [
    "ApexTrigger",
    "WorkflowRule",
    "Flow",
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

    fullName: string;
    metadataType: string;
    sourceMetadataType: string;
    id: string;

    listMetatadaResult: any;

    get objectName(): string {

        switch (this.sourceMetadataType) {

            case "ApexTrigger":
                return this.fullName;

            case "WorkflowRule":
                return this.fullName.split('.')[0];

            case "ValidationRule":
                return this.fullName.split('.')[0];

            case "Flow":
                return "General";

            case "LookupFilter":
                return this.fullName;
        }
    }

}


export class MetaApiSf {

    sOrg: SfdmModels.SOrg;

    /**
     * The map between sobject name and all the metadata related to this sobject
     *
     * @type {Map<String, Array<MetadataItem>>}
     * @memberof MetadataApiSf
     */
    objectNameToMetadataItemsMap: Map<String, Array<MetadataItem>> = new Map<String, Array<MetadataItem>>();

    constructor(sOrg: SfdmModels.SOrg) {
        this.sOrg = sOrg;
    }


    /**
       * List metadata of the given types.
       * The method retrieves only unmanaged metadata.
       *
       * @param {Array<string>} objectNames The name of the objects to retireve metadata related to those objects.
       * @returns {Promise<any>} 
       * @memberof MetadataApiSf
       */
    async readMetadataAsync(objectNames: Array<string>): Promise<any> {

        objectNames.forEach(objectName => {
            this.objectNameToMetadataItemsMap.set(objectName, new Array<MetadataItem>());
        });
        this.objectNameToMetadataItemsMap.set('Global', new Array<MetadataItem>());

        return new Promise<any>(async resolve => {

            let metadataList: Array<MetadataItem> = new Array<MetadataItem>();
            let promises = [];

            // List available metadata
            METADATA_TYPES.forEach(metadataType => {

                if (metadataType != "LookupFilter") {
                    promises.push(this._listMetadata(metadataType, metadataType, metadataList));
                }
                else {
                    objectNames.forEach(objectName => {
                        promises.push(this._listMetadata("CustomObject", metadataType, metadataList, [objectName]));
                    });
                }
            });

            await Promise.all(promises);

            let keys = [...this.objectNameToMetadataItemsMap.keys()];

            metadataList.forEach(metadata =>{
                if (keys.indexOf(metadata.objectName) >= 0){
                    this.objectNameToMetadataItemsMap.get(metadata.objectName).push(metadata);
                }
            });

            resolve();


            // Promise.all(promises).then(function () {
            //     // TEST:
            //     let ee = _this.objectNameToMetadataItemsMap;
            //     resolve();
            // });

        });
    }


    // ------------------------- Private members --------------------------
    private async _listMetadata(
        metadataType: string,
        sourceMetadataType: string,
        metadataItems: Array<MetadataItem>,
        fullNames: Array<string> = null): Promise<Array<any>> {

        return new Promise<Array<MetadataItem>>(resolve => {

            function callback(err: any, metadata: any) {

                if (err) {
                    resolve();
                    return;
                }

                if (Array.isArray(metadata)) {
                    metadata.forEach(meta => {
                        if (meta.manageableState == 'unmanaged') {
                            metadataItems.push(new MetadataItem({
                                fullName: meta.fullName,
                                id: meta.id,
                                sourceMetadataType,
                                listMetatadaResult: meta,
                                metadataType: metadataType
                            }));
                        }
                    });
                } else {
                    metadataItems.push(new MetadataItem({
                        fullName: metadata.fullName,
                        listMetatadaResult: metadata,
                        sourceMetadataType,
                        metadataType: metadataType
                    }));
                }
                resolve();
            }

            let conn = this.sOrg.getConnection();

            if (!fullNames) {
                conn.metadata.list({
                    type: metadataType
                }, this.sOrg.version, callback);
            } else {
                conn.metadata.read(metadataType, fullNames, callback);
            }
        });
    }




}