# ![SFDMU](src/images/logo-black.png)&nbsp;SFDX Data Move Utility (SFDMU)

[![Version](https://img.shields.io/npm/v/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![Downloads/week](https://img.shields.io/npm/dw/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![Downloads/total](https://img.shields.io/npm/dt/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![GitHub stars](https://img.shields.io/github/stars/forcedotcom/SFDX-Data-Move-Utility)](https://gitHub.com/forcedotcom/SFDX-Data-Move-Utility/stargazers/)
[![GitHub contributors](https://img.shields.io/github/contributors/forcedotcom/SFDX-Data-Move-Utility.svg)](https://github.com/forcedotcom/SFDX-Data-Move-Utility/graphs/contributors/)
[![License](https://img.shields.io/npm/l/sfdmu.svg)](https://github.com/forcedotcom/SFDX-Data-Move-Utility/blob/master/LICENSE.txt)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

The **SFDX Data Move Utility (SFDMU)** is an advanced SFDX plugin designed to streamline data migration within various Salesforce environments, including scratch, development, sandbox, and production orgs. 

This powerful tool supports migration from other Salesforce orgs or CSV files and efficiently manages various data operations, enabling the migration of **multiple related sObjects in a single run**.

**Useful Resources:**

- **[SFDMU GUI Application:](https://github.com/forcedotcom/SFDX-Data-Move-Utility-Desktop-App)** **Elevate your experience with the dedicated** **SFDMU GUI Application.** 
  Designed for ease of use, this intuitive graphical interface allows you to download, configure, and manage migration jobs effortlessly. 
  Perfect for users who prefer a visual setup, it complements the core functionality of the SFDMU Plugin seamlessly, enhancing your ability to handle data migrations with precision and ease. 
  Download and get started today to simplify your data migration processes.
- [**SFDMU Help Center:**](https://help.sfdmu.com/) Comprehensive documentation available.
- [**User Support Policy:**](https://help.sfdmu.com/full-documentation/additional-information/support_policy) Review guidelines before opening support cases.
- [**Contribution Policy:**](https://help.sfdmu.com/full-documentation/additional-information/code_contribution_policy) Learn how to contribute to our project.

## Key Features:
- **Comprehensive Migration Support:** Enables direct Org-to-Org data migration, eliminating the need for CSV intermediates, and supports CRUD operations: Insert, Upsert, Update, Delete.
- **Multiple Objects and Relationships:** Manages migrations involving multiple object sets and handles complex relationships, including [circular references](https://help.sfdmu.com/examples/basic-examples#example-1-handling-circular-references).
- **Ease of Use:** Simplifies the configuration process with a [single export.json file](https://help.sfdmu.com/full-configuration).
- **Secure and Local:** Ensures data security as all operations are performed locally without cloud interactions.
- **High Performance:** Optimizes processing by focusing on necessary data subsets.
- **Extended Functionality:** Provides advanced features such as [custom field mapping](https://help.sfdmu.com/full-documentation/advanced-features/fields-mapping), [data anonymization](https://help.sfdmu.com/full-documentation/advanced-features/data-anonymization), and supports [composite external ID keys](https://help.sfdmu.com/full-documentation/advanced-features/composite-external-id-keys) among others.

## Installation Instructions:
1. **Prepare Environment:** Install the Salesforce CLI following the [official instructions](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm).
2. **Plugin Installation:**
   
   ```bash
   # Uninstall old version, if any:
   $ sf plugins uninstall sfdmu
   
   # Install the latest version:
   $ sf plugins install sfdmu
   ```

## Detailed Setup for Developers:
For developers needing customization or access to the source:
```bash
# Clone the repository:
$ git clone https://github.com/forcedotcom/SFDX-Data-Move-Utility
# Navigate to the directory and link it:
$ cd SFDX-Data-Move-Utility
$ npm install
$ sf plugins link
```

## Migration Configuration:

Set up a migration job by creating an `export.json` file with specific data models and operations, as detailed in the [Full export.json Format Guide](https://help.sfdmu.com/full-configuration).

Here is a basic `export.json` example for upserting Accounts and their related Contacts, assuming a unique Name for Accounts and a unique LastName for Contacts across source and target orgs:

```json
{
    "objects": [
        {
            "operation": "Upsert",
            "externalId": "LastName",
            "query": "SELECT FirstName, LastName, AccountId FROM Contact",
            "master": false
        },
        {
            "operation": "Upsert",
            "externalId": "Name",
            "query": "SELECT Name, Phone FROM Account WHERE Name = 'John Smith'"
        }
    ]
}
```

### Description of JSON Content:

1. **First Object (Contact)**:
   - **Operation:** "Upsert" - Can be "Update", "Upsert", "Insert", "Delete", among others as specified in the documentation.
   - **External ID:** "LastName" - Used as the unique identifier for Contacts to support upsert operations.
   - **Query:** "SELECT FirstName, LastName, AccountId FROM Contact" - Defines the fields to be transferred from the source to the target during the migration. This ensures that only the specified fields are processed.
   - **Master:** `false` - This setting ensures that SFDMU only processes Contact records that are related to the specified Accounts.

2. **Second Object (Account)**:
   - **Operation:** "Upsert" - Specifies the type of operation for Accounts.
   - **External ID:** "Name" - The unique identifier for Accounts, used for upsert operations.
   - **Query:** "SELECT Name, Phone FROM Account WHERE Name = 'John Smith'" - Selects specific Accounts by Name for the operation. This ensures that only Accounts with the name "John Smith" are targeted for the upsert.

## Migration Execution:

Navigate to the directory where your `export.json` file is located and execute migrations using commands tailored to your source and target, whether they are Salesforce orgs or CSV files:

```bash
# Migrate data from one Salesforce org to another
$ sf sfdmu run --sourceusername source.org.username@name.com --targetusername target.org.username@name.com

# Export data from a Salesforce org to CSV files
$ sf sfdmu run --sourceusername source.org.username@name.com --targetusername csvfile

# Import data from CSV files to a Salesforce org
$ sf sfdmu run --sourceusername csvfile --targetusername target.org.username@name.com
```

Note: When importing or exporting from/to CSV files, ensure that the files are located in the directory containing the `export.json` file. The files should be named according to the API name of the respective sObject, such as `Account.csv`, `Contact.csv`. This naming convention helps in accurately mapping the data to the correct sObjects during the import or export process.

**Watch the Demo:**

- Experience the plugin in action [here](https://www.youtube.com/watch?v=KI_1vD93prA).

**Documentation Links:**
- [**Getting Started**](https://help.sfdmu.com/get-started)
- [**Installation Guide**](https://help.sfdmu.com/installation)
- [**Configuration Tips**](https://help.sfdmu.com/configuration)
- [**How to Run Migrations**](https://help.sfdmu.com/running)

- [**Debugging Steps**](https://help.sfdmu.com/debugging)
- [**Detailed export.json Format**](https://help.sfdmu.com/full-configuration)

**Notes:** 

- If you encounter permission issues on MacOS, prepend your commands with `sudo`. Adjust CLI command syntax if using the older SFDX CLI platform.
- To allow SFDMU to connect to your source and target orgs, ensure you have established a local connection to these orgs using the standard `sf org login web` commands, as detailed in the [Authorize an Org Using a Browser](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm) documentation.

