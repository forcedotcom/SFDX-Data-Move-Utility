# ![SFDMU](src/images/logo.png)Salesforce Data Loader SFDX Plugin (SFDMU)

```bash
### ------------------------------------------------------------------------------- ###
### ------ Latest stable version: 2.8.4 ------------------------------------------- ###
### ------ !! Highly recommended always keeping your local copy up-to-date !! ----- ###
### -------!! All older versions may not functioning properly !! ------------------ ###
### ------------------------------------------------------------------------------- ###
```
#### For the detailed documentation visit the project WIKI: [https://github.com/forcedotcom/SFDX-Data-Move-Utility/wiki](https://github.com/forcedotcom/SFDX-Data-Move-Utility/wiki)

#### Download also the SFDMU Desktop GUI Application:  [https://github.com/forcedotcom/SFDX-Data-Move-Utility-Desktop-App](https://github.com/forcedotcom/SFDX-Data-Move-Utility-Desktop-App)

----



## Introduction:

**The SFDMU (SFDX Data Move Utility)** **is advanced and very handy alternative to the traditional Salesforce Data Loader application**. 

This SFDX Plugin will assist you to populate your org (scratch / dev / sandbox / prod) with data imported from another org or CSV files. It supports all important CRUD operations **Insert** / **Update** / **Upsert** / **Delete** operations **also for multiple related sObjects**.



### Use case.

Creating of a scratch org, dev org or even a sandbox today is a pretty fast and simple action. On the other hand the newly created organization has only metadata ready-to-use, has no real data that is always strongly required to develop and debug any Salesforce application. It makes no sense to manually create or load data traditional way (with the Salesforce Data Loader) for each new org because the data easily can be taken in whole or in part from  production or from the sandbox and imported into the new organization. 

In some cases we already have the data, but it's only required to modify particular records or even fields without touching others. When a date model is complex and contains a large number of dependencies, it becomes a very hard and annoying task. 

Also there is a situation when as client you would like to keep the data model clean without creating external ID fields in the SObject, therefore your goal is to find some workaround to update records in your developer org from the existing source without adding new fields. 

Population of the RecordtypeId field is another quite difficult task, when ids are not consistent between environment.

At current moment, there is no effective tool for both inserting and updating dependent objects based on any unique field used as External Id.  In most cases people use Excel spreadsheets to build source tables and try to mix between them to get proper values for the lookup or master-detail fields. So filling out even a small number of objects turns into a huge pain...



###  Why the SFDMU Plugin is the best solution?

It provides the most convenient way to export data from **multiple related** sObjects between Salesforce orgs (even unlinked).  Unlike other similar tools it can easily and quickly perform all important operations like: INSERT / UPDATE / UPSERT / DELETE.



### The Highlights of the Plugin:

- Supports **direct data migration** from Salesforce org to another Salesforce org without intermediate CSV files.
- Allow to migrate **multiple objects at once**.
- Supports data **Export/Import  to/from  CSV files.**
- **Does not require a special External Id** **field for Update/Upsert** operations to bind related SObjects. **Any type of field with unique values, such as a Name, even formula or auto-number can be used as External Id.** The Plugin internally compares the records from the Source and Target based on the specified field and performs the necessary CRUD operations on the Target.
- Handles **circular references between SObjects**, for example when Object1 has a child relationship to Object2, then the Object2 has a child relationship to Object3 and the Object3 has a parent relationship back to the Object1.
- Supports data migration **preserving Record Type** for each record.
- Handles **self-referenced fields**, i.e  Account.ParentId. 
- Supports **Person Accounts**.
- Supports **record owner assignment**. If the source and the target orgs have the same list of users it can assign each record to the owner with the same Name Owner.Name (User.Name) External Id key.
- Has built-in  **data anonymization feature**  to replace real source data (for example from  the Production env)  with random values during updating the Target.
- **Secured and safe**. All operations are performed on the client's machine, there is no cloud interaction, so all is completely safe.
- **User-friendly configuration.**  Fully configurable using simple JSON file.
- **Fast performance.** Processes only a selected subset of records that need to be inserted or updated and does not touch others.
- And much more (see the details in other Wiki articles)...




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
# If you already have previous version of the Plugin installed on your local machine and want to update it, first uninstall the previous version:
$ sfdx plugins:uninstall sfdmu

# Install the latest version of the Plugin:
$ sfdx plugins:install sfdmu
```

### Installation with the source code:

```bash
# If you have any old Plugin installation, take some preliminary steps before installing from the current git source.
# Uninstall all previously installed SFDMU instances from the SFDX CLI.
$ sfdx plugins:uninstall sfdmu
# If once you have linked any old source code of the Plugin, make sure that it is already unlinked from the Salesforce CLI. Go to your local directory which contains the old Plugin sources and type:
$ sfdx plugins:unlink


# Now you are ready to install the new version of the Plugin from the current repository.
#1. Clone the git locally: 
$ git clone https://github.com/forcedotcom/SFDX-Data-Move-Utility

#2. Make the installation directory current:
$ cd SFDX-Data-Move-Utility

#3. Install npm modules: 
$ npm install

#4. Link the Plugin to the Salesforce CLI: 
$ sfdx plugins:link
```

### Debugging.

```bash
# Follow the instructions how to debug the Plugin using VSCode:

# 1. Clone the source code from the git repo (see above).

# 2. In the VSCode find "File" => "Preferences" => "Settings" => "Node Debug" and put "Auto Attach" property to "On"

# 3. Set necessary break points in the .ts files of the project. 

# 4. To start debugging the source code just add --dev-suspend flag to each CLI command that runs the SFDMU Plugin. 

```

