# ![SFDMU](src/images/logo-black.png)&nbsp;SFDX Data Move Utility (SFDMU)

[![Version](https://img.shields.io/npm/v/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![Downloads/week](https://img.shields.io/npm/dw/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![Downloads/total](https://img.shields.io/npm/dt/sfdmu.svg)](https://npmjs.org/package/sfdmu)
[![GitHub stars](https://img.shields.io/github/stars/forcedotcom/SFDX-Data-Move-Utility)](https://gitHub.com/forcedotcom/SFDX-Data-Move-Utility/stargazers/)
[![GitHub contributors](https://img.shields.io/github/contributors/forcedotcom/SFDX-Data-Move-Utility.svg)](https://github.com/forcedotcom/SFDX-Data-Move-Utility/graphs/contributors/)
[![License](https://img.shields.io/npm/l/sfdmu.svg)](https://github.com/forcedotcom/SFDX-Data-Move-Utility/blob/master/LICENSE.txt)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

The Salesforce Data Move Utility (SFDMU) is an advanced SFDX plugin crafted to streamline data migration within various Salesforce environments, including scratch, development, sandbox, and production orgs. It facilitates the migration from other orgs or from CSV files, efficiently managing various data operations and supporting the migration of multiple related sObjects in a single run.

**Useful Resources:**
- [**SFDMU GUI Application:**](https://github.com/forcedotcom/SFDX-Data-Move-Utility-Desktop-App) Download and easily configure migration jobs.
- [**SFDMU Help Center:**](https://help.sfdmu.com/) Access detailed documentation.
- [**User Support Policy:**](https://help.sfdmu.com/full-documentation/additional-information/support_policy) Understand support guidelines before opening cases.
- [**Contribution Policy:**](https://help.sfdmu.com/full-documentation/additional-information/code_contribution_policy) Guidelines for contributing to the SFDMU project.

## Key Features:
- **Comprehensive Migration Support:** Facilitates direct Org-to-Org data migration, avoiding the need for CSV intermediates, and fully supports CRUD operations: Insert, Upsert, Update, Delete.
- **Multiple Objects and Relationships:** Manages migrations involving multiple object sets and handles complex relationships, including [circular references](https://help.sfdmu.com/examples/basic-examples#example-1-handling-circular-references).
- **Ease of Use:** Simplifies the configuration process using a [single export.json file](https://help.sfdmu.com/full-configuration).
- **Secure and Local:** Ensures data security as all operations are performed locally without cloud interactions.
- **High Performance:** Optimizes processing by focusing on necessary data subsets.
- **Extended Functionality:** Offers advanced features such as [custom field mapping](https://help.sfdmu.com/full-documentation/advanced-features/fields-mapping), [data anonymization](https://help.sfdmu.com/full-documentation/advanced-features/data-anonymization), and supports [composite external ID keys](https://help.sfdmu.com/full-documentation/advanced-features/composite-external-id-keys).

## Installation Instructions:
1. **Prepare Environment:** Install the Salesforce CLI as per the [official instructions](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm).
2. **Plugin Installation:**
   ```bash
   # Uninstall old version, if any:
   $ sf plugins uninstall sfdmu
   
   # Install the latest version:
   $ sf plugins install sfdmu
   ```

## Detailed Setup for Developers:
For those needing customization or access to the source:
```bash
# Clone the repository:
$ git clone https://github.com/forcedotcom/SFDX-Data-Move-Utility

# Navigate to the directory and link it:
$ cd SFDX-Data-Move-Utility
$ npm install
$ sf plugins link
```

**Watch the Demo:**
- Experience the plugin in action [here](https://www.youtube.com/watch?v=KI_1vD93prA).

## Migration Configuration:
For setting up a migration job, create an `export.json` file with specific data models and operations as detailed in the [full export.json format guide](https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format).

## Running the Migration Job:
Execute migrations using commands tailored to your source and target, whether they are Salesforce orgs or CSV files:
```bash
$ sf sfdmu run --sourceusername source@name.com --targetusername target@name.com
```
For CSV data interactions, modify the usernames as required for your specific scenario.

**Documentation Links:**
- [**Getting Started**](https://help.sfdmu.com/get-started)
- [**Installation Guide**](https://help.sfdmu.com/installation)
- [**Configuration Tips**](https://help.sfdmu.com/configuration)
- [**How to Run Migrations**](https://help.sfdmu.com/running)
- [**Debugging Steps**](https://help.sfdmu.com/debugging)
- [**Detailed export.json Format**](https://help.sfdmu.com/full-configuration)

**Note:** If you encounter permission issues on MacOS, prepend your commands with `sudo`. Adjust CLI command syntax if using the older SFDX CLI platform.

