# ![SFDMU](src/images/logo.png)SFDMU - the Salesforce Data Move Utility

This SFDX Plugin will assist you to populate your org (scratch / dev / sandbox / prod) with data imported from another org. It supports all important insert / update / upsert operations **also for multiple related sObjects**.





## Introduction

### Use case

Creating of a scratch org, dev org or even a sandbox today is a pretty fast and simple action. On the other hand the newly created organization has only metadata ready-to-use, has no real data that is always strongly required to develop and debug any Salesforce application. It makes no sense to manually create or load data traditional way(dataloader) for each new org because the data easily can be taken in whole or in part from  production or from the sandbox and imported into the new organization. 

In some cases we already have the data, but it's only required to modify particular records or even fields without touching others. When a date model is complex and contains a large number of dependencies, it becomes a very hard and annoying task. 

Also there is a situation when as client you would like to keep the data model clean without creating external ID fields in the SObject, therefore your goal is to find some workaround to update records in your developer org from the existing source without adding new fields. 

Population of the RecordtypeId field is another quite difficult task, when ids are not consistant between environment.

At current moment, there is no effective tool for both inserting and updating dependent objects based on any unique field used as External Id.  In most cases people use Excel spreadsheets to build source tables and try to mix between them to get proper values for the lookup or master-detail fields. So filling out even a small number of objects turns into a huge pain...

### The solution

**The SFDMU Plugin is suitable and convenient solution for the problem above.**

It provides easiest way to export data from multiple related sObjects between Salesforce orgs(even unlinked). Unlike other similar tools it can perform all important operations like <u>Insert</u> / <u>Update</u> / <u>Upsert</u> / Delete.

**<u>In addition this plugin has an amount  of very useful advantages,  for example:</u>**

- **It does not require a special ExternalId** **field for update / upsert** operations to bind related SObjects. Any field with unique values, such as a Name, can be used as External Id. The plugin internally compares the records from the source and target organizations based on the specified field and performs the necessary CRUD operations on the target.
- **Handles circular references between SObjects**, for example when Object1 has a child relationship to Object2, then the Object2 has a child relationship to Object3 and the Object3 has a parent relationship back to the Object1.
- **Supports data migration preserving Record Type** for each record.
- **Auto-number field, formula field and even multiple combined fields can be used as external ID.**
- **Handles** **self-referenced fields**, i.e Account.ParentId. 
- **Supports**  **record** **owner assignment**. If the source and the target orgs have the same list of users it can assign each record to the owner with the same Name Owner.Name (User.Name) External Id key.
- **Supports** **export / import records to / from CSV files.**
- **Supports data masking** (mocking feature) during record insert / update.
- **Secured and safe**. All operations are performed on the client's machine, there is no cloud interaction, so all is completely safe.
- **User-friendly configuration.**  Configurable using simple JSON file.
- **Fast perfomance.**
- And more...





## Getting Started

### Prerequisites

Before using this plugin you need to perform standard procedure of installing SFDX CLI on your local machine from  here:

```
https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm
```

### Installing

There are two ways to install the SFDMU

1. Install as SFDX Plugin:

```bash
sfdx plugins:install sfdmu
```

2. Install from the git repository:

```bash
If you already have previous version of the Plugin installed from the current git source, first you need to unlink (uninstall) it from the Salesforce CLI.

1. Go to the directory contains the Plugin files and type:
sfdx plugins:unlink

2. Update the files to the newest version.
git pull origin master

3. Link the Plugin back to the Salesforce CLI: 
sfdx plugins:link



If currently there is no Plugin installed on your machine, then skip previous steps and make as below.

1. Clone git repository: 
git clone https://github.com/forcedotcom/sf-data-move-utility

2. Make this directory current:
cd sf-data-move-utility

3. Install npm modules: 
npm install

4. Link the Plugin to the Salesforce CLI: 
sfdx plugins:link

```





## How to use

This Plugin is fully configurable with a json file called **export.json**.
By modifying it you can configure some export parameters and tell to the plugin which SObjects and which fields you want to process. 



#### Minimal JSON file configuration.

Assume you have following SObjects with complex circular dependencies:

![diagram](src/images/diagram.jpg)

Let's say, that each SObject from the diagram above has unique Name value and you want to use Name as External Id field for all SObjects.

So you can export all records with preserving relationships between the objects using following basic format of  ***export.json***:

```json
{
    "orgs": [
        {
            "name": "source@name.com",
            "instanceUrl": "https://um5.salesforce.com",
            "accessToken": "##ACCESSTOKEN1##"
        }, 
        {
            "name": "target@name.com",
            "instanceUrl": "https://cs10.salesforce.com",
            "accessToken": "##ACCESSTOKEN2##"
        }
    ],
    "objects": [
        {
            "query": "SELECT Id, Phone, TestObject3__c FROM Account WHERE Name LIKE 'TEST_ACC_%'",
            "operation": "Upsert",
            "externalId": "Name",
            "allRecords": true
        },
        {
            "query": "SELECT Id, Account__c, TestObject3__c, RecordTypeId FROM TestObject__c",
            "operation": "Upsert",
            "externalId": "Name"
        },
        {
            "query": "SELECT Id, Account__c, TestObject__c FROM TestObject2__c",
            "operation": "Upsert",
            "externalId": "Name"
        },
        {
            "query": "SELECT Id, TestObject2__c FROM TestObject3__c",
            "operation": "Upsert",
            "externalId": "Name"
        }
    ]
}
```



If you want to utilize the org credentials that were previously stored in your system using *sfdx force:auth:web:login*  or another authentication sfdx command you can simply omit the *orgs* section from the script, then the Plugin will try to retrieve access token from the SFDX local storage.



#### Full list of the JSON parameters.

Of course the Plugin has also a huge amount of advanced features which give you great flexibility in setting up the data migration process. 

| Field                               | Data Type                  | Optional/Default        | Description                                                  |
| ----------------------------------- | -------------------------- | ----------------------- | ------------------------------------------------------------ |
| orgs                                | **Array (ScriptOrg**[])    | Optional / No default   | Credentials data of the Salesforce orgs you want to process.<br />It's optional parameter if need to configure manual connection to any of the processed orgs. <br />Alternatively you can choose SFDX connection from the stored in the local system. |
| **ScriptOrg**.name                  | String                     | Mandatory               | Username to connect with.                                    |
| **ScriptOrg**.instanceUrl           | String                     | Mandatory               | Org instance url.                                            |
| **ScriptOrg**.accessToken           | String                     | Mandatory               | Access token to connect.                                     |
| pollingIntervalMs                   | Integer                    | Optional / Default 2000 | When used Bulk API this parameter defined the polling interval to check for the bulk job status. Decreasing this value may cause additional system load. |
| bulkThreshold                       | Integer                    | Optional / Default 200  | For better performance the plugin uses both Collection API for the small data and Bulk API for the large data processing. Collection API is a fast way to process, but it is always consuming a lot of the quota on API requests, so for large data sizes it's better to use Bulk API. This parameter defined the minimal size of data when need to switch from processing via Collection API to the Bulk API. |
| apiVersion                          | Float                      | Optional / Default 47.0 | API version number to use.                                   |
| objects                             | **Array (ScriptObject**[]) | Mandatory               | SObjects you want to process.                                |
| **ScriptObject**.query              | String                     | Mandatory               | SOQL query string. <br />Include in the query string all SObject's fields that you need to export, including referenced fields. It is enough only to list the fields and the plugin will automatically resolve and process all the references between  objects. Data from fields that are not listed in the query will not be exported.<br />Optionally you can filter the records by using WHERE, LIMIT, OFFSET etc. clauses. <br />*Nested queries and complex fields like Account__r.Name are not supported. But you still can use subquery in the WHERE clause for ex: .... WHERE Id IN (SELECT Id FROM .... )* |
| **ScriptObject**.deleteQuery        | String                     | Optional, Default none  | SOQL query string used to delete old records from the target org (see the "Delete" operator  and the "deleteOldData" parameter).<br />If this parameter is omitted - the same **ScriptObject.query** will be used to retrieve records both to delete and to update. |
| **ScriptObject**.operator           | String                     | Mandatory               | Operation that you want to perform with the current SObject.<br />**Available values are:**<br />**"Insert"** - creates new records on the target org even old versions of these records already exist.<br />**"Update"** - only updates existing records. The operator overrides all record fields.<br />**"Add"** -  creates a new record only if the old one does not exist.<br />**"Merge"** - like "Update", but does not override existing values, only fills empty record fields.<br />**"Upsert"** - Inserts new and updates old records, overriding all values.<br />**"Readonly"** - To say that you don't want to update this object, only to retrieve its records during the export. Useful in case that you need to include readonly SObject that is referenced from another SObject.<br />**"Delete"** - Only removes old target records from the given sObject. No update performed. |
| **ScriptObject**.externalId         | String                     | Mandatory               | External Id field for this SObject.<br />This is the unique identifier field, the field which can map any child records refering to this SObject. <br />Each field that has unique values across all records can be used as an External Id, even it's not marked as External Id within the SObject's metadata. You can also use standard External Id fields defined in the metadata.<br />This is used to compare source and target records as well as to process the relationships between objects during all operations, except of "Insert" and Readonly". |
| **ScriptObject**.deleteOldData      | Boolean                    | Optional, Default false | Forces deletion of old target records before performing update. <br />The difference from the "Delete" operator (see above) is that the operator makes only the deletion without uploading records from the source. |
| **ScriptObject**.updateWithMockData | Boolean                    | Optional, default false | Enables data mocking for this SObject                        |
| **ScriptObject**.mockFields         | **Array (MockField[])**    |                         | Defines SObject fields that need to update with a fake data (see mocking feature below) |
| **MockField**.name                  | String                     | Mandatory               | The name of the field to mock (see mocking feature below)    |
| **MockField**.pattern               | String                     | Mandatory               | The pattern to create mock data for this field (see mocking feature below) |
| promptOnMissingParentObjects        | Boolean                    | Optional, Default true  | If  parent lookup or master-detail record was not found for the some of the child records - it will propmt or will not prompt user to break or to continue the migration.<br />It allows user to monitor the job and abort it when some data is missing. |
| allOrNone                           | Boolean                    | Optional, Default false | Abort job execution on any failed record or continue working anyway.<br />If true the execution will stop or the user will be prompted to stop depend on promptOnUpdateError parameter. |
| promptOnUpdateError                 | Boolean                    | Optional, Default true  | When some records failed or when any other error occurred during data update prompt the user to stop the execution or to continue. |
| encryptDataFiles                    | Boolean                    | Optional, Default false | Enables encryption / decryption of the CSV files when passing *--password* argument to the Plugin call and using *file* as Source or as the Target. |





#### Running the export job. Examples of CLI commands.

Use following console command to start the export from one Org to another:

```bash
sfdx sfdmu:move --sourceusername source@name.com --targetusername target@name.com
```


To import from the CSV files use the format as below:

```bash
sfdx sfdmu:move --sourceusername file --targetusername target@name.com
```


To export records into CSV files use the format as below:

```bash
sfdx sfdmu:move --sourceusername source@name.com --targetusername file
```


To export records into CSV files with encryption use the format as below:

```bash
sfdx sfdmu:move --sourceusername source@name.com --targetusername file --password mypass
```



| Parameter        | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| --sourceusername | The username of the source salesforce org to take the data from it.<br />As mentioned above the credentials can be explicitly set in the [orgs] section of the export.json, or you can specify the username of the organization, that is previously connected using  standard sfdx force:auth:web:login command.<br /><br />**"--sourceusername file"** will import records from previously created CSV files into the target Org.<br />The CSV files must exist in the same directory as the export.json file.<br />Use --targetusername file parameter (see below) to create these files from the source records. |
| --targetusername | The username of the target salesforce org where to put the data.<br /><br />**--targetusername file** will export records from the source org into CSV files. Each SObject will be stored in separated file. |
| path             | (Optional) The path (absolute or relative) to the directory with your package.json file. |
| --password       | (Optional) The password for the org credentials. When specified the Plugin will attempt to decrypt the  **org.name**, **org.accessToken** and **org.instanceUrl** parameters using AEC-CBC algorithm before making the connection. If the decryption failed original unencrypted strings will be used to connect.<br /><br />If you are set encryptDataFiles=true then the CSV data will be encrypted and decrypted using the same password. |



#### Combined External Id keys.

This is useful feature that allows you to bind source and target records by creating "virtual" external Id field which is a combination of multiple field values. For example, there is Description object that has two parent objects called Article and Language and there is no unique field defined in Description object.
Each Article has several Descriptions with different Languages. Each Language and Article have unique Names. 
Assume you want to execute Upsert operation on the Description object.  In this case you cannot bind Description records directly, you only can bind them via their both parents objects. So you can define the Description object in the script like this:


```json
  objects: [
      { ... },
      { ... },
      {
          "query": "SELECT Id, Name, Article__c, Language__c FROM Description__c",
          "operation": "Upsert",
          "externalId": "Article__r.Name;Language__r.Name"
      }
  ]
```

During the data migration process the Plugin will internally generate a "virtual formula field" (since there is not such a real field in the Description object metadata) value that is combination of Article.Name and Language.Name values and will use it for binding the records.

You can use here unlimited number of fields separated by semicolon.




#### Data mocking feature.

If you're developing an application, you'll want to make sure you're testing it under conditions that closely simulate a production environment. In production, you'll probably have a sensitive data that usually you do not want to expose in the testing environment. To help with this use case I have added the option to mask real record value with a fake one before uploading it to the target.

You can define the list of fields that their values need to be replaced with the fake data and the pattern for each field under **mockFields** section of SObject.

Below is the example of script that will generate a sequence of random fake names instead of the original Name values  before the records will be inserted into the target org.
```json
  objects: [
      { ... },
      { ... },
      {
          "query": "SELECT Id, Name FROM Account",
          "operation": "Insert",
          "externalId": "Name",
          
          "mockFields": [
                {
                    "name": "Name",
                    "pattern": "name"
                }
          ]    
      }
  ]
```


This will skip the original account names and produce Accounts records like this:

```json
  [
      {
          "Id" : "[RECORD ID1]",
          "Name" : "Miss Perry Larson",
      },
      {
          "Id" : "[RECORD ID2]",
          "Name" : "Ms. Alec Romaguera",
      },
      
      {
          "Id" : "[RECORD ID3]",
          "Name" : "Ms. Alec Romaguera",
      },
      
      {
          "Id" : "[RECORD ID4]",
          "Name" : "Ms. Drake Gerlach"          
      },
      ...
  ]
```



You can find complete list of available patterns [here](https://www.npmjs.com/package/casual#embedded-generators )

For the "pattern", omit the "casual." prefix leaving only the name of the function, for example, you can write:   *"name", city", "street", "address"* etc.

Also you can use additional patterns that are not in the list above:

1) **ids** - updates given field with the original source Record Id value.

2) **c_seq_number(prefix, from, step)**  - produces sequence of strings terminated by number starting from the number defined by the "from" parameter incremented by the "step".

For example,    ***c_seq_number('TheRecord  ', 1, 2)***    will produce strings 
*"TheRecord 1", "TheRecord 3", "TheRecord 5", .....*

3) **c_seq_date**(from, step) - produces sequence of dates from the "from" date with defined "step".

For example:  ***c_seq_date('2019-01-01', 'd')***   will generate dates 
*"2019-01-01", "2019-01-02", "2019-01-03"*

Available values for the step parameter are:

**"d" :**      + one day

**"-d" :**      - one day

**"d0" :**      the same date as "from" without increment / decrement

**"m" :**      + one month

**"-m" :**      - one month

**"y" :**      + one year

**"-y"** :      - one year

**"s" :**      + one second

**"-s" :**      - one second

**"ms" :**      + one millisecond

**"-ms" :**      - one millisecond






## Notes

* You can use record Id field and autonumber fields as external Id key for Insert operation.
  You can still have external Id field of formula type for all operations including Upsert.


* By default the owner of new record is the user under which you are running the data migration.
  In order to make different record owner assignment you simply need to add **OwnerId** field to the SObject's query.  This will tell to the plugin to assign the target record to the user with the same Name as in the source. To get this feature work you must ensure that you have users with the same Names in the both Orgs.
  
* If you want to export record by preserving RecordType just include RecordTypeId field in the query and the plugin will do the rest. 
  
* If you have previously exported source data into CSV files and then want to import it from the files into another Org you need to use export.json file that has the same configuration like when you have created the CSVs.

* The file Import / Export feature supports standard Salesforce data loader file format.

* Migration of User object currently is NOT supported.

  



## Demo Video

Running the Plugin from the command console / terminal:

![SFDMU DEMO](https://img.youtube.com/vi/KI_1vD93prA/hqdefault.jpg)
( https://www.youtube.com/watch?v=KI_1vD93prA )





## License

This product is licensed under the BSD-3-Clause - see the [LICENSE.txt](LICENSE.txt) file for details.

