# ![SFDMU](src/images/logo.png)Salesforce Data Loader SFDX Plugin (SFDMU)

- **For the detailed documentation, visit the [SFDMU Help Center](https://help.sfdmu.com/)**
- **The changelog (including only important updates) can be found [here](https://help.sfdmu.com/full-documentation/additional-information/changelog)**

```bash
> ** THIS TOOL HAS LIMITED SUPPORT AND NO SLA ENFORCED AS SUPPORT TO ISSUES RAISED. **
> ** HOWEVER, WE GIVE OUR BEST EFFORT TO RETURN AND ADDRESS EACH ISSUE AS POSSIBLE. **
```

> **PLEASE NOTE! DUE TO LACK OF TIME AT THIS MOMENT WE CAN'T OFFER SUPPORT FOR CONFIGURATION/MIGRATION QUESTIONS, ONLY FOR BREAKING RUNTIME BUGS.**
> **FOR CONFIG/MIGRATION TROUBLESHOOTING USE OUR [DOCUMENTATION WEBSITE](https://help.sfdmu.com/)**

> **FOLLOW THE BELOW GUIDELINES WHEN OPENING ISSUES:**
> - **Use one of our issue tracker templates.**
> - **For Plugin runtime bugs always attach:**
>  - **The FULL latest [.log](https://help.sfdmu.com/full-documentation/reports/the-execution-log) file.**
>  - **The FULL [export.json](https://help.sfdmu.com/plugin-basics/basic-usage/minimal-configuration) file.**
>  - **When you have an issue with failed rows, provide also the dump of the [\_target.csv](https://help.sfdmu.com/full-documentation/reports/the-target-csv-files) file containing the error messages (at least 1-2 relevant full rows).**

> **WHO WANTS TO CONTRIBUTE TO THIS PROJECT, PLEASE, CAREFULLY READ OUR [Contribution Policy](https://help.sfdmu.com/full-documentation/additional-information/code_contribution_policy)** 



## Introduction:

**The SFDMU Plugin (SFDX Data Move Utility) is the powerful salesforce data migration tool and it is the innovative and very handy alternative to the traditional Salesforce Data Loader application as well as to the set of the force:data:tree commands.** 

This SFDX Plugin will help you to populate your org **(scratch / dev / sandbox / production)** with data imported from another org or CSV files. It supports all important CRUD operations (**Insert** / **Update** / **Upsert** / **Delete**)  **also for multiple related sObjects**.



### The Advantages of the Tool:

- Supports **direct data migration** from Salesforce org to another Salesforce org without intermediate CSV files.
- Allow to migrate **multiple objects at once**.
- Supports data **Export/Import  to/from  CSV files.**
- **Does not require a special External Id** **field for Update/Upsert** operations to bind related SObjects. **Any type of field with unique values, such as a Name, even formula or auto-number can be used as External Id.** The Plugin internally compares the records from the Source and Target based on the specified field and performs the necessary CRUD operations on the Target.
- Handles **circular references between SObjects**, for example when Object1 has a child relationship to Object2, then the Object2 has a child relationship to Object3 and the Object3 has a parent relationship back to the Object1.
- Supports customized **Fields and Object Mapping**, when the name of the objects and fields in the Source and the Target are different.
- Supports data migration **preserving Record Type** for each record.
- Handles **self-referenced fields**, for instance  Account.ParentId. 
- Supports **composite external Id keys**. 
- Full **Person Account** support. Can process record sets contain mixed Business & Person Accounts.
- Supports migration of related **Notes** , **Attachments**  and **Files**  including the binary data.
- Supports **record owner assignment**. If the source and the target orgs have the same list of users it can assign each record to the owner with the same Name Owner.Name (User.Name) External Id key.
- Has built-in  **data anonymization feature**  to replace real source data (for example from  the Production environment)  with random values during updating the Target.
- Automatic **CSV source file transformation** option. 
- Customized binding of **polymorphic lookup fields**, for instance FeedItem.ParentId.
- **Secured and safe**. All operations are performed on the client's machine, there is no cloud interaction, so all is completely safe.
- **User-friendly configuration.**  Fully configurable using simple JSON file.
- **Fast performance.** Processes only a selected subset of records and fields that need to be inserted or updated and does not touch others.
-  You can also **extend the basic SFDMU functionality** by **coding and running your own** [**Custom Add-On modules**](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) 
-  **Advanced transformation of the source records** before uploading them to the Target using [the **RecordsTransform Core Add-On Module**](https://help.sfdmu.com/full-documentation/add-on-api/records-transform-core-add-on-module)


### Use case.

Creating of a scratch org, dev org or even a sandbox today is a pretty fast and simple action. On the other hand the newly created organization has only metadata ready-to-use, has no real data that is always strongly required to develop and debug any Salesforce application. It makes no sense to manually create or load data traditional way (with the Salesforce Data Loader) for each new org because the data easily can be taken in whole or in part from  production or from the sandbox and imported into the new organization. 

In some cases we already have the data, but it's only required to modify particular records or even fields without touching others. When a date model is complex and contains a large number of dependencies, it becomes a very hard and annoying task. 

Also there is a situation when as client you would like to keep the data model clean without creating external ID fields in the SObject, therefore your goal is to find some workaround to update records in your developer org from the existing source without adding new fields. 

Population of the RecordtypeId field is another quite difficult task, when ids are not consistent between environment.

At current moment, there is no effective tool for both inserting and updating dependent objects based on any unique field used as External Id.  In most cases people use Excel spreadsheets to build source tables and try to mix between them to get proper values for the lookup or master-detail fields. So filling out even a small number of objects turns into a huge pain...



###  Why the SFDMU Plugin is the best solution?

It provides the most convenient way to export data from **multiple related** sObjects between Salesforce orgs (even unlinked).  Unlike other similar tools it can easily and quickly perform all important operations like: INSERT / UPDATE / UPSERT / DELETE.

Implemented a huge amount of advanced features never were before in any of the existing tools, which make your data migration very quick and easy.




### Watch the demo. The Plugin in action:

Running the Plugin from the command console / terminal:

![SFDMU DEMO](https://img.youtube.com/vi/KI_1vD93prA/hqdefault.jpg)

( https://www.youtube.com/watch?v=KI_1vD93prA )





## Installation:


### Prerequisites:

Before using this plugin you need to perform standard procedure of installing SFDX CLI on your local machine from  here:

```
https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm
```



### Installation as SFDX plugin:

```bash
# If you already have outdated version of the Plugin installed on your local machine
# and want to update it, first uninstall the existing version:
$ sfdx plugins:uninstall sfdmu

# Install the latest version of the Plugin:
$ sfdx plugins:install sfdmu
```



### Installation with the source code:

```bash
# If you have any old Plugin installation, take some preliminary steps 
# before installing from the current git source.
# Uninstall all previously installed SFDMU instances from the SFDX CLI.
$ sfdx plugins:uninstall sfdmu
# If once you have linked any old source code of the Plugin, make sure that it is already
# unlinked from the Salesforce CLI. 
# Go to your local directory which contains the old Plugin sources and type:
$ sfdx plugins:unlink


# Now you are ready to install the new version of the Plugin from the current repository.
# 1. Clone the git locally: 
$ git clone https://github.com/forcedotcom/SFDX-Data-Move-Utility

# 2. Make the installation directory current:
$ cd SFDX-Data-Move-Utility

# 3. Install npm modules: 
$ npm install

# 4. Link the Plugin to the Salesforce CLI: 
$ sfdx plugins:link
```






----

See also the following help articles:


- [Quick Start with the SFDMU](https://help.sfdmu.com/quick-start)

- [Installation](https://help.sfdmu.com/plugin-basics/basic-usage/installation)

- [Minimal Configuration](https://help.sfdmu.com/plugin-basics/basic-usage/minimal-configuration)

- [Full Configuration](https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format)

- [Running](https://help.sfdmu.com/plugin-basics/basic-usage/running)

- [Debugging](https://help.sfdmu.com/plugin-basics/basic-usage/debugging)
