## [5.6.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.5.0...5.6.0) (2026-02-22)

###### New features:

- Added `--file` CLI flag to run a migration from an explicit `export.json` path while keeping `--path` as the base folder for runtime resources.
- Added diagnostic lines that show the resolved `export.json` path and a dedicated note when this path differs from `--path`.
- Added anonymisation support for explicit `export.json` path values in diagnostic logs when `--anonymise` is enabled.

###### Improvements:

- Improved stack trace anonymisation to mask only the absolute machine-specific prefix while keeping plugin-root relative file paths visible.

###### Fixes:

- Updated non-zero exit guidance text to use consistent team wording in the final diagnostic instruction line.

**See the related articles:**

- [Running - --file](https://help.sfdmu.com/running#--file)
- [Run Command Flags - file](https://help.sfdmu.com/full-documentation/reports/run-command-flags#file)
- [Run Command Flags - path](https://help.sfdmu.com/full-documentation/reports/run-command-flags#path)
- [Run Command Flags - diagnostic](https://help.sfdmu.com/full-documentation/reports/run-command-flags#diagnostic)
- [Run Command Flags - anonymise](https://help.sfdmu.com/full-documentation/reports/run-command-flags#anonymise)
- [Log File Management - What is masked and what is not](https://help.sfdmu.com/full-documentation/reports/the-execution-log#what-is-masked-and-what-is-not)

## [5.5.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.4.0...5.5.0) (2026-02-22)

###### New features:

- Added skipped-update reason breakdown counters in warning output for update and upsert processing: `sameData`, `noMatchingTarget`, and `other`.
- Added detailed skipped-update summary data to make investigation of update/upsert behavior faster in large runs.

###### Fixes:

- Fixed missing diagnostic visibility for skipped-update split details by adding a dedicated diagnostic summary line in execution logs.

**See the related articles:**

- [Log File Management in Plugin Migrations - Skipped Records Reason Breakdown](https://help.sfdmu.com/full-documentation/reports/the-execution-log#skipped-records-reason-breakdown)
- [Run Command Flags - diagnostic](https://help.sfdmu.com/full-documentation/reports/run-command-flags#diagnostic)
- [ScriptObject Object - skipRecordsComparison](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#skiprecordscomparison-boolean)
- [Target Records Filter](https://help.sfdmu.com/full-documentation/advanced-features/target-records-filter) review skipped updates when target rows are filtered out.

## [5.4.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.3.1...5.4.0) (2026-02-21)

###### New features:

- Added object-level API mode controls: `alwaysUseRestApi`, `alwaysUseBulkApi`, and `alwaysUseBulkApiToUpdateRecords`.
- Added `respectOrderByOnDeleteRecords` to enforce ordered delete execution through REST one-by-one mode.
- Added SDK contract updates for add-on modules to expose new object-level API mode fields and related runtime metadata.

###### Improvements:

- Changed query and DML bulk-threshold behavior to threshold-inclusive evaluation (`>=`) for clearer switching at exact threshold values.

**See the related articles:**

- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check new object-level API mode properties and delete-order behavior.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan bulk/query threshold settings and runtime switching behavior.
- [Custom Add-On API Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - go through SDK contract fields available to add-on modules.
- [ScriptObject Object - alwaysUseRestApi](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#alwaysuserestapi-boolean)
- [ScriptObject Object - alwaysUseBulkApi](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#alwaysusebulkapi-boolean)
- [ScriptObject Object - alwaysUseBulkApiToUpdateRecords](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#alwaysusebulkapitoupdaterecords-boolean)
- [ScriptObject Object - respectOrderByOnDeleteRecords](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#respectorderbyondeleterecords-boolean)

## [5.3.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.3.0...5.3.1) (2026-02-20)

###### Fixes:

- Fixed composite `externalId` handling for mixed relationship and local fields (for example `Lookup__r.Name;LocalField__c`), so query expansion and externalId validation resolve correctly without false mandatory externalId warnings.

**See the related articles:**

- [ScriptObject Object - externalId](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#externalid-string)
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at where externalId is configured in migration scripts.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [5.3.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.2.0...5.3.0) (2026-02-20)

###### New features:

- Added automatic default `apiVersion` selection when `apiVersion` is not explicitly provided in `export.json` or via `--apiversion`.
- For `org -> org` migrations, SFDMU now uses the lower maximum API version supported by source and target orgs.
- For `org -> csvfile` and `csvfile -> org` migrations, SFDMU now uses the maximum API version supported by the connected org.
- Added support for the same auto-selection behavior when org credentials are provided manually with `instanceUrl` and `accessToken`.
- Kept explicit `apiVersion` in `export.json` and `--apiversion` as strict overrides over auto-selection.

**See the related articles:**

- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)
- [Running - --apiversion](https://help.sfdmu.com/running#--apiversion)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)

## [5.2.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.1.4...5.2.0) (2026-02-20)

###### New features:

- Added `--failonwarning` to stop migration on the first warning and return dedicated exit code `8`.
- Added `mockFields.locale` so mock data generation can use locale-specific values per field.
- Added `Old Id` in `_target.csv` reports, mapped from internal source id, for easier source-target traceability.

###### Fixes:

- Fixed warning escalation flow to always write an explicit diagnostic stop reason when `--failonwarning` aborts execution.
- Fixed diagnostic stack traces to mask absolute folder paths while preserving file names and line numbers.

###### Improvements:

- Improved diagnostic reporting for exclusion paths with detailed per-field reasons for operation-specific DML filtering.
- Improved Person Account diagnostics by logging exclusion reasons for invalid fields in business and person contexts.

**See the related articles:**

- [Run Command Flags - failonwarning](https://help.sfdmu.com/full-documentation/reports/run-command-flags#failonwarning)
- [Running - --failonwarning](https://help.sfdmu.com/running#--failonwarning)
- [MockField Object - locale](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/mock-field-object#locale-string)
- [Data Anonymization](https://help.sfdmu.com/full-documentation/advanced-features/data-anonymization) - look at patterns, examples, and usage guidance.
- [The Target CSV Files](https://help.sfdmu.com/full-documentation/reports/the-target-csv-files) - verify Old Id mapping output in target report files.
- [Script Object - createTargetCSVFiles](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#createtargetcsvfiles-boolean)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [5.1.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.1.3...5.1.4) (2026-02-19)

###### Fixes:

- Added post-run failure guidance after a non-zero exit code so troubleshooting starts with migration configuration checks.
- Changed completion behavior so this guidance is not shown for successful runs and is not shown when execution is aborted by user.
- Fixed console output normalization to preserve `https://` links in messages, so documentation links remain clickable.

###### Other changes:

- Added detailed guidance text for issue reporting with `--diagnostic --anonymise`, full `.log` attachment, and failed-row `_target.csv` reminder.
- Added and updated logging tests for guidance visibility, spacing, color, exclusion conditions, and URL output.

**See the related articles:**

- [The Target CSV Files](https://help.sfdmu.com/full-documentation/reports/the-target-csv-files) - scan Old Id mapping output in target report files.
- [Script Object - createTargetCSVFiles](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#createtargetcsvfiles-boolean)
- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Running - --diagnostic](https://help.sfdmu.com/running#--diagnostic)

## [5.1.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.1.2...5.1.3) (2026-02-19)

###### Fixes:

- Fixed large-source bulk retrieval crashes by handling Promise-returning bulk query streams before event subscription.
- Fixed runtime failure path where bulk query processing could terminate with `bulkQuery.on is not a function`.

###### Other changes:

- Added unit test coverage for Promise-based bulk query stream handling.
- Updated version notice wording in root README for consistent v5 messaging.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - look at property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - focus on object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [5.1.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.1.1...5.1.2) (2026-02-17)

###### Fixes:

- Fixed plugin installation failures in environments that omit dev dependencies by guarding husky postinstall execution.
- Fixed installation flow for non-git and controlled skip environments so plugin install does not fail on missing husky.

###### Other changes:

- Updated release metadata synchronization baseline between release bodies and release sections.
- Updated root README version notice wording for consistent v5 messaging.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [5.1.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/5.1.0...5.1.1) (2026-02-17)

###### Fixes:

- Fixed dependency resolution instability in Yarn lock graph to improve install consistency.
- Fixed lint toolchain completeness by restoring required eslint and TypeScript-related dev dependencies.

###### Other changes:

- Updated lockfile resolutions for stable dependency selection across environments.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - review object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [5.1.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.39.0...5.1.0) (2026-02-17)

##### New major version:

- Released new major version because the engine runtime model, CSV behavior, and file pipeline were redesigned.
- Breaking change: standalone Node.js/module execution was removed; migration runs now go through `sf sfdmu run`.
- Breaking change: legacy runtime effect of `--verbose`, `--concise`, and `--usesf` was removed; these flags are now compatibility no-op flags.
- Breaking behavior update in CSV references: relationship columns (`__r`) are now generated consistently, while `excludeIdsFromCSVFiles` controls removal of raw `Id` and lookup `...Id` columns.
- Breaking behavior update in file migration: file/attachment/note transfer was centralized in `core:ExportFiles` for all paths (`org -> org`, `org -> csvfile`, `csvfile -> org`), replacing fragmented legacy handling.
- Breaking runtime defaults: `--filelog` default changed to `0`, and `--diagnostic` became the recommended mode for full troubleshooting output.
- Major validation hardening: default `apiVersion` moved to `65.0`, and script/object/operation validation became stricter to fail fast on invalid configs.
- Major code refactoring: the engine was rebuilt into modular API/CSV/mapping/logging layers with dedicated Bulk v1/Bulk v2/REST engines.
- Major add-on platform update: custom add-on interfaces were extracted into `custom-addon-sdk` with template scaffolding and updated runtime adapters.

###### New features:

- Added full Data Loader-oriented CSV/file workflow support in the new engine, including unified handling for `ContentVersion`, `ContentDocumentLink`, `Attachment`, and `Note`.
- Added expanded `core:ExportFiles` behavior for all migration directions (`org -> org`, `org -> csvfile`, `csvfile -> org`) with improved binary-path handling.
- Added explicit CSV behavior controls (`csvFileDelimiter`, `csvFileEncoding`, `csvInsertNulls`, `csvUseEuropeanDateFormat`, `csvWriteUpperCaseHeaders`, `csvUseUtf8Bom`) so migration output/input format is predictable.
- Added `--anonymise` flag to hash sensitive values in `.log` files with deterministic per-run tokens, enabling safer diagnostics sharing without exposing raw secrets, domains, emails, and absolute paths.

###### Deprecations/Removed features:

- Deprecated `csvReadFileDelimiter` and `csvWriteFileDelimiter`; use `csvFileDelimiter` for current configurations.
- Removed standalone Node.js/module execution mode; migration runs through `sf sfdmu run`.
- Deprecated runtime effect of `--verbose`, `--concise`, and `--usesf`; these flags are now legacy no-op compatibility flags.

###### Fixes:

- Fixed multiple id/reference edge cases in CSV processing by tightening `Id`/lookup-id/`__r` handling, reducing broken parent/lookup resolution during migration.
- Fixed file pipeline consistency by centralizing binary and package processing in `core:ExportFiles`, reducing format drift between org and csvfile paths.

###### Improvements:

- Improved script/runtime validation behavior (`apiVersion=65.0`, stricter operation and object checks) so invalid configs fail earlier.
- Changed diagnostic defaults: `--filelog` default is `0` and `--diagnostic` is the recommended troubleshooting mode.
- Improved support workflow security: documentation now includes a complete `--anonymise` masking matrix that explicitly lists what is hashed and what remains unchanged.

**See the related articles:**

- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)
- [Running - --apiversion](https://help.sfdmu.com/running#--apiversion)
- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - scan SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - check runtime object model and API contracts.
- [Running - --verbose](https://help.sfdmu.com/running#--verbose)
- [Running - --concise](https://help.sfdmu.com/running#--concise)
- [Running - --usesf](https://help.sfdmu.com/running#--usesf)
- [Script Object - excludeIdsFromCSVFiles](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#excludeidsfromcsvfiles-boolean)
- [Running - --filelog](https://help.sfdmu.com/running#--filelog)
- [Running - --diagnostic](https://help.sfdmu.com/running#--diagnostic)

# [4.39.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.38.0...4.39.0) (2026-01-22)

###### New features:

- Added support for script-driven Group query detection (`groupQuery`) so User/Group preload can follow your actual migration query intent.

###### Fixes:

- Fixed User/Group lookup preload behavior by adding a Group-specific fallback filter (`Type = 'Queue'`) when no explicit Group query is provided.

###### Improvements:

- Improved User/Group preload flow by using dedicated User and Group queries with a consistent shared field set.

###### Other changes:

- Updated issue templates (ask-a-question.md, bug-report.md, critical-runtime--errors-report.md, request-a-new-feature.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated governance files (CODEOWNERS, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE.txt): updated ownership mappings, contribution process notes, and security reporting instructions.
- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - groupQuery](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#groupquery-boolean)

# [4.38.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.37.0...4.38.0) (2024-12-29)

###### New features:

- Added support for `Product2` in multiselect query mode, improving automatic field selection for that object.

###### Improvements:

- Improved multiselect query auto-selection for `Product2` by excluding unsupported technical fields from generated queries.

**See the related articles:**

- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Field Multiselect](https://help.sfdmu.com/full-documentation/advanced-features/field-multiselect)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.37.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.8...4.37.0) (2024-11-28)

###### New features:

- Added `sourceRecordsFilter` support in `ScriptObject`, allowing extra source-side filtering without rewriting the base object query.

###### Fixes:

- Fixed add-on script object typings so custom add-ons can access and use `sourceRecordsFilter` consistently.

###### Improvements:

- Improved query merge behavior for `sourceRecordsFilter` so original `WHERE` logic is preserved with explicit parentheses.
- Improved diagnostics by warning when `sourceRecordsFilter` is invalid instead of silently skipping.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - review SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - read runtime object model and API contracts.
- [ScriptObject Object - sourceRecordsFilter](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#sourcerecordsfilter-string)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.36.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.7...4.36.8) (2024-11-23)

###### Fixes:

- Fixed record comparison during update processing by ignoring temporary source-id helper fields, reducing false-positive update detections.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.36.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.3...4.36.7) (2024-10-29)

###### Fixes:

- Fixed mapped update/upsert behavior so source-target identity is preserved when custom external-id mapping is used.
- Fixed lookup relationship mapping propagation so reference fields are resolved consistently after mapping.

###### Improvements:

- Added stable source-record identity tracking so mapped update/upsert flows keep consistent source-target links.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - look at property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.36.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.2...4.36.3) (2024-09-19)

###### Fixes:

- Fixed plugin installation packaging issues to improve installation stability.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @oclif/errors, @oclif/core, @salesforce/core); updated devDependencies (@types/node).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - go through property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - see object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.36.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.1...4.36.2) (2024-09-19)

###### Other changes:

- Changed package.json: updated dependencies (madge).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.36.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.0...4.36.1) (2024-09-19)

###### Improvements:

- Improved execution log readability by standardizing separator/newline output formatting.

###### Other changes:

- Updated issue templates (ask-a-question.md, ask-question---gui-only-.md, bug-in-gui-app-only.md, bug-report.md, request-a-new-feature.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated dependencies (@oclif/core, @oclif/command, @oclif/config, @oclif/errors, @salesforce/core, alasql (+1 more)); updated devDependencies (@types/node, typescript).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - scan object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.36.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.35.1...4.36.0) (2024-09-07)

###### New features:

- Added support for `valueSource` in `core:RecordsTransform`, allowing transformation logic to explicitly use source or target-side values during record updates.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.35.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.35.0...4.35.1) (2024-08-18)

###### Fixes:

- Fixed null/clear behavior consistency across REST and Bulk API paths by normalizing `#N/A` conversion before API write operations.
- Fixed org-media transformation behavior so null values can be intentionally propagated as clear operations instead of being silently dropped.

###### Improvements:

- Added explicit runtime null-marker processing (`#N/A`) in write pipelines to support controlled target-field clearing in org migrations.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - look at property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.35.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.2...4.35.0) (2024-08-13)

###### New features:

- Added `ORDER BY` support for `core:ExportFiles` linked-document retrieval (`contentDocumentLinkOrderBy`) to make file export/import ordering predictable.
- Added add-on runtime support for `orderBy` in generated SOQL helper queries, enabling deterministic query ordering in add-on modules.

**See the related articles:**

- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)

## [4.34.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.1...4.34.2) (2024-08-13)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.34.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.0...4.34.1) (2024-08-13)

###### Fixes:

- Fixed CSV parser loading (`parse is not a function`) by switching to a compatible sync parser import path in Bulk API v2/common CSV processing.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - see property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.34.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.19...4.34.0) (2024-08-13)

###### New features:

- Added `RAW_VALUE` placeholder support for `c_set_value` mock expressions, enabling templates that combine generated values with the original field value.
- Added explicit mock constant wiring so anonymization patterns can safely reference the original value in a controlled format.

###### Fixes:

- Fixed mock expression execution flow so current field value is correctly passed into `c_set_value`, preventing incorrect substitutions in anonymization pipelines.

**See the related articles:**

- [MockField Object - locale](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/mock-field-object#locale-string)
- [Data Anonymization](https://help.sfdmu.com/full-documentation/advanced-features/data-anonymization) - check patterns, examples, and usage guidance.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.19](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.18...4.33.19) (2024-08-09)

###### Fixes:

- Fixed lookup search behavior in `core:RecordsTransform`, improving relation resolution reliability during transformed migrations.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.18](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.17...4.33.18) (2024-08-04)

###### Fixes:

- Fixed CSV export behavior so value mapping is now applied before writing records to CSV files.
- Fixed an issue where transformed values could be missing in exported CSV output.

###### Other changes:

- Updated issue templates (ask-question---gui-only-.md, ask-question---plugin-only-.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.

**See the related articles:**

- [Values Mapping](https://help.sfdmu.com/full-documentation/advanced-features/values-mapping) - focus on value mapping rules and examples.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - focus on property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.17](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.16...4.33.17) (2024-05-02)

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, issue-response-handler.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.
- Changed package.json: updated dependencies (csv-writer, glob, tslib).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.16](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.15...4.33.16) (2024-05-01)

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, issue-response-handler.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated issue templates (ask-question.md, bug-in-gui-app-only.md, bug-in-the-plugin-only.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.
- Changed package.json: updated dependencies (@salesforce/core, class-transformer, fastest-levenshtein, jsforce, promise-parallel-throttle); updated devDependencies (ts-node, tslint).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.15](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.14...4.33.15) (2024-04-28)

###### Fixes:

- Fixed `eval(...)` field-mapping expression parsing, improving reliability for evaluated mapping rules.

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - focus on property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - scan object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.14](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.13...4.33.14) (2024-04-28)

###### Other changes:

- Updated issue templates (bug-report-in-sfdmu-gui-app.md, bug-report-in-the-sfdmu-plugin.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Changed package.json: updated dependencies (@babel/traverse); updated package metadata fields (author).

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.13](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.12...4.33.13) (2024-04-23)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.12](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.11...4.33.12) (2024-04-22)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.10...4.33.11) (2024-04-22)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.9...4.33.10) (2024-04-22)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.8...4.33.9) (2024-04-20)

###### Other changes:

- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.7...4.33.8) (2024-04-20)

###### Other changes:

- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.6...4.33.7) (2024-04-15)

###### Fixes:

- Fixed CSV source-file repair diagnostics to use clearer, user-oriented column names.
- Fixed noisy CSV issue reporting in lookup-repair paths to reduce misleading warning rows.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.5...4.33.6) (2024-04-15)

###### Fixes:

- Fixed CSV target file generation when `excludeIdsFromCSVFiles=true` and operation is `Insert`.
- Fixed engine behavior for file-target runs by using a safe operation mode that avoids invalid CSV generation.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [Script Object - excludeIdsFromCSVFiles](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#excludeidsfromcsvfiles-boolean)

## [4.33.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.4...4.33.5) (2024-04-11)

###### Improvements:

- Updated the default Salesforce API version from `53.0` to `60.0` for newly created runs.

**See the related articles:**

- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)
- [Running - --apiversion](https://help.sfdmu.com/running#--apiversion)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)

## [4.33.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.3...4.33.4) (2024-03-15)

###### Fixes:

- Fixed add-on event wiring so record filter add-ons are invoked consistently through the new event name.

###### Improvements:

- Added an explicit add-on event name `filterRecordsAddons` for record filtering handlers.
- Changed custom add-on event contracts to use `filterRecordsAddons` instead of `onTargetDataFiltering`.

**See the related articles:**

- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - verify SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - review runtime object model and API contracts.
- [ScriptObject Object - filterRecordsAddons](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#filterrecordsaddons-array-of-addonmanifestdefinition)
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.2...4.33.3) (2024-03-13)

###### Improvements:

- Improved custom add-on TypeScript interfaces by making script and object members optional.
- Improved add-on compatibility by allowing modules to consume only required fields without strict full-model requirements.

**See the related articles:**

- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - see SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - focus on runtime object model and API contracts.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - focus on object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.1...4.33.2) (2024-03-12)

###### Fixes:

- Fixed script object filtering so excluded objects are reliably removed during script initialization.

###### Improvements:

- Changed User-related reference preload behavior to run a dedicated Queue `Group` query for stable User/Queue resolution.
- Improved object handling so `Group` is managed through preload logic instead of direct migration flow.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.33.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.0...4.33.1) (2024-03-12)

###### Fixes:

- Fixed User/Group auto-query expansion so it runs only for non-filtered queries.
- Fixed unexpected query broadening when your original SOQL already has a `WHERE` clause.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.33.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.8...4.33.0) (2024-03-12)

###### New features:

- Added `skipRecordsComparison` to `ScriptObject` so matched records can still be force-updated when needed.
- Added `skipRecordsComparison`, `useSourceCSVFile`, and `filterRecordsAddons` support to custom add-on script object contracts.

###### Fixes:

- Fixed update/upsert selection logic so `skipRecordsComparison=true` reliably moves matched records into the update pipeline.

**See the related articles:**

- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - see SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - focus on runtime object model and API contracts.
- [ScriptObject Object - skipRecordsComparison](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#skiprecordscomparison-boolean)
- [ScriptObject Object - filterRecordsAddons](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#filterrecordsaddons-array-of-addonmanifestdefinition)
- [ScriptObject Object - useSourceCSVFile](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#usesourcecsvfile-boolean)

## [4.32.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.7...4.32.8) (2024-03-11)

###### Fixes:

- Fixed custom lookup/relationship field-name normalization to prevent malformed reference field names in queries and mappings.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - go through property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.32.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.6...4.32.7) (2024-03-10)

###### Fixes:

- Fixed `core:RecordsTransform` lookup logic for `lookupSource='target'` so formulas evaluate against target records correctly.
- Fixed source-record resolution for transformed lookups when records are resolved from target-side maps.

###### Improvements:

- Improved reference type detection for commonly used ownership/lookup fields.
- Changed add-on `onBeforeUpdate` timing so it runs before insert/update split and can inspect all prepared records.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - read object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.32.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.5...4.32.6) (2024-03-03)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.32.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.4...4.32.5) (2024-03-03)

###### Fixes:

- Fixed `--logfullquery` CLI help binding so the long description text is resolved correctly.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Running - --logfullquery](https://help.sfdmu.com/running#--logfullquery)

## [4.32.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.3...4.32.4) (2024-03-03)

###### Fixes:

- Fixed run-command flag parsing so the selected `--usesf` value is applied correctly.

###### Improvements:

- Changed `--usesf` to accept explicit values (`true` / `false`) and set default to `true`.
- Improved CLI mode control so you can explicitly force `sf` or legacy `sfdx` command execution.

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Running - --usesf](https://help.sfdmu.com/running#--usesf)

## [4.32.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.2...4.32.3) (2024-03-03)

###### Improvements:

- Changed default command mode to `--usesf=true`, so modern `sf` CLI commands are used unless explicitly overridden.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Running - --usesf](https://help.sfdmu.com/running#--usesf)

## [4.32.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.1...4.32.2) (2023-11-30)

###### Fixes:

- Fixed update detection when Id mapping is active, so mapped records are no longer skipped as unchanged.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.32.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.0...4.32.1) (2023-11-22)

###### Fixes:

- Improved org connection initialization for expired-auth scenarios and org metadata loading.
- Improved org metadata validation by reading access, org type, and sandbox attributes in one guarded flow.

###### Other changes:

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - see object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.32.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.31.0...4.32.0) (2023-11-14)

###### New features:

- Added automatic alphabetical sorting of CSV columns, so exported files are deterministic and easier to compare.

###### Improvements:

- Improved CSV determinism by sorting generated CSV columns alphabetically for easier diff/review.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.31.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.30.0...4.31.0) (2023-11-13)

###### New features:

- Added `queryBulkApiThreshold` script support to control when query execution switches to Bulk Query API.
- Added runtime diagnostics that show whether each object query runs via REST API or Bulk Query API.
- Updated query API selection logic to use the configured threshold value for source and target reads.

###### Fixes:

- Fixed query API mode selection consistency across retrieval paths.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object - queryBulkApiThreshold](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#querybulkapithreshold-integer)

# [4.30.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.8...4.30.0) (2023-08-14)

###### New features:

- Added `pollingQueryTimeoutMs` script support to control Bulk Query polling timeout.
- Applied the timeout consistently across source/target queries, filtered retrieval, delete reads, and add-on runtime queries.
- Replaced fixed query-poll timeout constants with script-configurable timeout behavior.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [Script Object - pollingQueryTimeoutMs](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#pollingquerytimeoutms-integer)

## [4.29.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.7...4.29.8) (2023-08-11)

###### Fixes:

- Fixed value-mapping handling for `null`, `undefined`, and boolean `false` source values.
- Fixed false-empty conversion during mapping to keep expected field values in migration output.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.6...4.29.7) (2023-08-03)

###### Fixes:

- Fixed large CSV write stability by using stream-based CSV output and waiting for file completion before finishing the step.
- Reduced incomplete-file risk in heavy CSV export runs.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.5...4.29.6) (2023-07-31)

###### Fixes:

- Reverted the previous CSV writer change to restore stable CSV generation behavior.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - look at property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - focus on object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.4...4.29.5) (2023-07-29)

###### Improvements:

- Added stream-based CSV writer processing to reduce memory pressure during very large CSV exports.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - focus on property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - see object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.3...4.29.4) (2023-07-26)

###### Fixes:

- Fixed `excludedFromUpdateFields` property naming (`excudedFromUpdateFields` typo removed).
- Fixed update filtering behavior and add-on typings to use the corrected property consistently.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - review object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.2...4.29.3) (2023-07-20)

###### Fixes:

- Fixed `core:ExportFiles` upload error marking so only versions in the failed chunk are flagged.
- Fixed chunk-level error scoping so unrelated files are not incorrectly marked as failed.

**See the related articles:**

- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - review object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.1...4.29.2) (2023-06-25)

###### Fixes:

- Fixed composed WHERE-clause generation by wrapping incoming filter expressions in parentheses.
- Improved query correctness when combining existing filters with additional conditions.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.29.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.0...4.29.1) (2023-06-25)

###### Fixes:

- Fixed custom add-on module loading when an add-on does not implement `onInit`.
- Improved add-on initialization to handle missing optional `onInit` safely.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Custom SFDMU Add-On API](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-api) - review SDK and custom add-on implementation flow.
- [Custom SFDMU Add-On Object Reference](https://help.sfdmu.com/full-documentation/add-on-api/custom-sfdmu-add-on-object-reference) - see runtime object model and API contracts.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - review object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.29.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.28.1...4.29.0) (2023-06-25)

###### New features:

- Added `--logfullquery` flag to print full SOQL statements in logs when needed.
- Added script/runtime propagation for `logfullquery` so query log behavior is controlled per run.

###### Fixes:

- Fixed query-log shortening logic to follow the new `logfullquery` behavior.
- Fixed command-executor wiring so the new logging flag is passed correctly into run execution.

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Running - --logfullquery](https://help.sfdmu.com/running#--logfullquery)

## [4.28.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.28.0...4.28.1) (2023-06-25)

###### Fixes:

- Fixed query logging so full SOQL is printed when log level is `TRACE`.

###### Improvements:

- Improved TRACE diagnostics so full SOQL text is available when deep troubleshooting is needed.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - read object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.28.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.27.0...4.28.0) (2023-06-05)

###### New features:

- Added warning output when a `targetRecordsFilter` expression cannot be applied.

###### Fixes:

- Fixed target-filter fallback behavior so migration continues with explicit diagnostics instead of silent filter failure.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - targetRecordsFilter](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#targetrecordsfilter-string)

# [4.27.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.13...4.27.0) (2023-05-17)

###### New features:

- Added support for `sf org display` output handling, improving org connection detection in CLI workflows.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.13](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.12...4.26.13) (2023-05-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.12](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.11...4.26.12) (2023-05-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.10...4.26.11) (2023-05-01)

###### Other changes:

- Updated CI/release workflows (manualRelease.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.8...4.26.10) (2023-03-20)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.7...4.26.8) (2023-02-19)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.6...4.26.7) (2023-02-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.5...4.26.6) (2023-02-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.4...4.26.5) (2023-02-08)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.3...4.26.4) (2023-02-08)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.2...4.26.3) (2023-02-08)

###### Other changes:

- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.1...4.26.2) (2023-01-28)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.26.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.0...4.26.1) (2023-01-28)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.26.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.25.0...4.26.0) (2023-01-27)

###### New features:

- Added separate target output directories for each `objectSet`, so each set can store generated files independently.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.25.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.24.0...4.25.0) (2023-01-27)

###### New features:

- Added separate CSV delimiter settings for input and output (`csvReadFileDelimiter`, `csvWriteFileDelimiter`).

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.24.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.11...4.24.0) (2023-01-27)

###### New features:

- Added `useSourceCSVFile`, allowing jobs to read source CSV files directly when configured.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - useSourceCSVFile](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#usesourcecsvfile-boolean)

## [4.23.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.9...4.23.11) (2023-01-26)

###### Other changes:

- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.8...4.23.9) (2023-01-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.7...4.23.8) (2023-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.6...4.23.7) (2023-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.5...4.23.6) (2023-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.4...4.23.5) (2023-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.3...4.23.4) (2023-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.2...4.23.3) (2023-01-16)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.1...4.23.2) (2023-01-09)

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @oclif/errors, @salesforce/command, @salesforce/core, @salesforce/dev-config); updated oclif plugin metadata; updated package metadata fields (description).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.23.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.0...4.23.1) (2023-01-04)

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.23.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.22.0...4.23.0) (2022-12-30)

###### New features:

- Added support for exporting Feed Attachments.

**See the related articles:**

- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - review object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.22.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.20.0...4.22.0) (2022-12-29)

###### New features:

- Added improved handling for dependent related objects, reducing parent/child ordering issues during migration.

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - scan property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.20.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.6...4.20.0) (2022-12-26)

###### New features:

- Added `skipExistingRecords` at object level to skip records that already exist in the target.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.5...4.19.6) (2022-12-25)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.4...4.19.5) (2022-12-25)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.3...4.19.4) (2022-12-25)

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.2...4.19.3) (2022-12-23)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.1...4.19.2) (2022-12-23)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.19.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.0...4.19.1) (2022-12-23)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.19.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.2...4.19.0) (2022-12-23)

###### New features:

- Added Lookup Expression support in `RecordsTransform`.

###### Deprecations/Removed features:

- Deprecated `includeLookupFields` in `RecordsTransform`; use `includeFields` in current configurations.

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated issue templates (ask-question.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.18.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.1...4.18.2) (2022-12-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.18.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.0...4.18.1) (2022-12-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.18.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.8...4.18.0) (2022-11-24)

###### New features:

- Added `maxChunkSize` for `ExportFiles` add-on to control batch size for large file-processing jobs.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object - maxChunkSize](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#maxchunksize-integer)

## [4.17.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.7...4.17.8) (2022-11-24)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.6...4.17.7) (2022-11-24)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.5...4.17.6) (2022-10-17)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.4...4.17.5) (2022-10-13)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.3...4.17.4) (2022-10-12)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.2...4.17.3) (2022-10-12)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.17.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.16.10...4.17.2) (2022-10-01)

###### New features:

- Added `excludedObjects` support to skip selected objects during migration execution.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - focus on object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.16.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.16.6...4.16.10) (2022-09-29)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.16.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.3...4.16.6) (2022-09-29)

###### Other changes:

- Updated CI/release workflows (failureNotifications.yml, manualRelease.yml, onPushToMain.yml, onRelease.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.16.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.1...v4.16.3) (2022-09-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.16.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.0...v4.16.1) (2022-09-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.16.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.5...v4.16.0) (2022-09-17)

###### New features:

- Added `hardDelete` and source-side delete operation support for more flexible delete scenarios.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.15.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.4...v4.15.5) (2022-09-14)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.15.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.3...v4.15.4) (2022-09-14)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.15.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.2...v4.15.3) (2022-09-13)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.15.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.1...v4.15.2) (2022-09-13)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.15.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.0...v4.15.1) (2022-08-03)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.15.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.6...v4.15.0) (2022-07-07)

###### New features:

- Added advanced mock-field capabilities (`all` pattern, `excludeNames`, `c_set_value`) for flexible data masking.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - go through property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - verify object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.5...v4.14.6) (2022-07-06)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.4...v4.14.5) (2022-07-06)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.3...v4.14.4) (2022-05-21)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.2...v4.14.3) (2022-05-12)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.1...v4.14.2) (2022-05-10)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.14.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.0...v4.14.1) (2022-05-09)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.14.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.5...v4.14.0) (2022-05-09)

###### New features:

- Added `objectSets` to split one migration configuration into reusable object-set groups.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - go through object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.13.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.4...v4.13.5) (2022-05-07)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.13.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.3...v4.13.4) (2022-04-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.13.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.2...v4.13.3) (2022-04-18)

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.13.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.1...v4.13.2) (2022-04-18)

###### Other changes:

- Updated issue templates (feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.13.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.0...v4.13.1) (2022-04-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.13.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.11...v4.13.0) (2022-03-24)

###### New features:

- Added per-object parallelism controls (`parallelBulkJobs`, `parallelRestJobs`) to tune migration throughput.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [Script Object - parallelBulkJobs](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#parallelbulkjobs-integer)
- [Script Object - parallelRestJobs](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#parallelrestjobs-integer)

## [4.12.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.10...v4.12.11) (2022-03-22)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.9...v4.12.10) (2022-03-21)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.8...v4.12.9) (2022-02-27)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.6...v4.12.8) (2022-02-27)

###### Other changes:

- Updated issue templates (bug-report-in-the-sfdmu-gui-app.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.5...v4.12.6) (2022-01-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.4...v4.12.5) (2022-01-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.3...v4.12.4) (2022-01-15)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.2...v4.12.3) (2022-01-09)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.1...v4.12.2) (2022-01-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.12.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.0...v4.12.1) (2022-01-01)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.12.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.11...v4.12.0) (2022-01-01)

###### New features:

- Added `RecordsFilter` core add-on for configurable record filtering during migration runs.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - read object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.10...v4.11.11) (2021-12-30)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.9...v4.11.10) (2021-12-29)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.7...v4.11.9) (2021-12-21)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.6...v4.11.7) (2021-12-19)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.4...v4.11.6) (2021-12-17)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.3...v4.11.4) (2021-12-17)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.2...v4.11.3) (2021-12-16)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.1...v4.11.2) (2021-12-15)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.11.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.0...v4.11.1) (2021-12-14)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.11.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.3...v4.11.0) (2021-12-14)

###### New features:

- Added standalone execution options and `queryAllTarget` support for extended target-query scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [Script Object - queryAllTarget](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#queryalltarget-boolean)

## [4.10.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.2...v4.10.3) (2021-11-27)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.10.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.1...v4.10.2) (2021-11-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.10.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.0...v4.10.1) (2021-11-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.10.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.5...v4.10.0) (2021-11-18)

###### New features:

- Added `useQueryAll` support to include archived/deleted records where Salesforce query-all is available.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object - useQueryAll](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#usequeryall-boolean)

## [4.9.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.4...v4.9.5) (2021-11-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.9.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.3...v4.9.4) (2021-11-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.9.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.2...v4.9.3) (2021-11-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.9.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.1...v4.9.2) (2021-11-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - look at overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.9.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.0...v4.9.1) (2021-11-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.9.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.3...v4.9.0) (2021-11-01)

###### New features:

- Added `excludedFromUpdateFields` to keep selected fields unchanged during update operations.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.8.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.2...v4.8.3) (2021-10-31)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.8.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.1...v4.8.2) (2021-10-31)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.8.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.0...v4.8.1) (2021-10-31)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.8.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.7.0...v4.8.0) (2021-10-31)

###### New features:

- Added new `RecordsTransform` add-on capabilities for richer field and lookup transformation scenarios.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - see property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - focus on object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.7.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.4...v4.7.0) (2021-10-28)

###### New features:

- Added multithreaded API execution and query caching to improve migration performance on large datasets.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - look at property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - inspect object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.6.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.3...v4.6.4) (2021-10-26)

###### Other changes:

- Updated governance files (CODEOWNERS): updated ownership mappings, contribution process notes, and security reporting instructions.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.6.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.2...v4.6.3) (2021-10-25)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.6.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.1...v4.6.2) (2021-10-25)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.6.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.0...v4.6.1) (2021-10-24)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.6.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.10...v4.6.0) (2021-10-24)

###### New features:

- Added improved REST API and Attachment handling for more reliable file-related migrations.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - verify property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.9...v4.5.10) (2021-10-21)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.8...v4.5.9) (2021-10-21)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.7...v4.5.8) (2021-10-20)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.6...v4.5.7) (2021-10-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.5...v4.5.6) (2021-10-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.4...v4.5.5) (2021-10-19)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.3...v4.5.4) (2021-10-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.2...v4.5.3) (2021-10-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.1...v4.5.2) (2021-10-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.5.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.0...v4.5.1) (2021-10-13)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.5.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.7...v4.5.0) (2021-10-13)

###### New features:

- Added SFDMU add-on runtime updates that expand custom module integration capabilities.

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated scripts (typedoc-sfdmu-run-addons); updated devDependencies (typescript).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - scan object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.6...v4.4.7) (2021-10-05)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.5...v4.4.6) (2021-09-30)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.4...v4.4.5) (2021-08-18)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.3...v4.4.4) (2021-08-15)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.2...v4.4.3) (2021-07-11)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - inspect command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.1...v4.4.2) (2021-05-30)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - see command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.4.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.0...v4.4.1) (2021-05-23)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.4.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.3.1...v4.4.0) (2021-05-22)

###### New features:

- Added stability improvements in org-script configuration handling for CLI connection setup.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - see property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.3.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.3.0...v4.3.1) (2021-05-15)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - see navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.3.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.6...v4.3.0) (2021-05-12)

###### New features:

- Added `simulationMode`, allowing dry-run execution without writing changes to the target org.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - read property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - check object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.2.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.4...v4.2.6) (2021-05-03)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.2.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.3...v4.2.4) (2021-05-03)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.2.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.2...v4.2.3) (2021-05-03)

###### Other changes:

- Updated issue templates (feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - verify navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.2.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.1...v4.2.2) (2021-05-02)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - scan overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.2.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.0...v4.2.1) (2021-05-02)

###### Other changes:

- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - scan command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.2.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.4...v4.2.0) (2021-05-01)

###### New features:

- Added `deleteByHierarchy` to delete related records in hierarchy-aware order.

###### Other changes:

- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - go through command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - scan object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.1.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.3...v4.1.4) (2021-04-29)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.1.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.2...v4.1.3) (2021-04-29)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - focus on overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.1.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.1...v4.1.2) (2021-04-29)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.1.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.0...v4.1.1) (2021-04-27)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - check overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - scan navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.1.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.3...v4.1.0) (2021-04-27)

###### New features:

- Added `deleteFromSource` support and flexible source/target defaults when one username is omitted.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - check command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - read object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.0.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.2...v4.0.3) (2021-04-20)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - inspect overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - review command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - check navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [4.0.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.0...v4.0.2) (2021-04-19)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - verify command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [4.0.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.10.5...v4.0.0) (2021-03-18)

##### New major version:

- Released new major version focused on distribution/runtime baseline and packaging reliability.
- Major release delivery change: moved to Salesforce-signed package distribution and updated release automation flow.
- Major runtime compatibility change: normalized add-on runtime import paths for case-sensitive environments, reducing Linux/macOS runtime failures.
- Major packaging change: updated build/pack scripts to cross-platform command variants to reduce non-Windows packaging/install issues.
- Major baseline update: promoted the plugin/package stream to the v4 line with aligned release metadata and documentation for the new distribution model.
- No `export.json` schema breaking changes were introduced in this release; the major bump reflects runtime and distribution baseline changes.

###### New features:

- Added Salesforce-signed v4 release distribution and migration runtime baseline updates.

###### Improvements:

- Improved package/runtime baseline for the Salesforce-signed v4 delivery stream.

###### Other changes:

- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.
- Changed package.json: updated scripts (build, postpack, prepack).

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - verify overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - inspect navigation map for script and object configuration.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - inspect property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - read object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.10.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.10.4...v3.10.5) (2021-02-28)

###### Other changes:

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - review navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.10.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.10.3...v3.10.4) (2021-02-25)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - go through overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.10.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.9.3...v3.10.3) (2021-02-25)

###### New features:

- Added `core:ExportFiles` add-on capabilities and improved add-on runtime messaging.

###### Deprecations/Removed features:

- Deprecated direct `ContentVersion` migration in the core flow; use `core:ExportFiles` for file migration scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

**See the related articles:**

- [Export File Core Add-On Module](https://help.sfdmu.com/full-documentation/add-on-api/export-file-core-add-on-module)
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - check property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - scan object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.7.21](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.20...v3.7.21) (2020-11-23)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.7.17](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.14...v3.7.17) (2020-10-20)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - see overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - go through navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.7.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.3...v3.7.4) (2020-09-21)

###### Other changes:

- Updated issue templates (question-or-help.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - read overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - focus on command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - focus on navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.5.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.5.5...v3.5.9) (2020-07-21)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - look at command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - look at navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

# [3.4.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.3.5...v3.4.0) (2020-06-13)

###### New features:

- Added field/value mapping enhancements, including compound field mapping scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

**See the related articles:**

- [Values Mapping](https://help.sfdmu.com/full-documentation/advanced-features/values-mapping) - scan value mapping rules and examples.
- [Script Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object) - review property sections mentioned in this release, especially script-level migration controls.
- [ScriptObject Object](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object) - look at object-level property sections mentioned in this release and their operation impact.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)

## [3.1.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.1.0...v3.1.2) (2020-06-01)

Code improvements and bug fixes

**See the related articles:**

- [Get Started](https://help.sfdmu.com/get-started) - review overview of current plugin behavior and migration basics.
- [Running](https://help.sfdmu.com/running) - read command execution patterns and common flags.
- [Export.json File Overview](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/export-json-file-overview) - read navigation map for script and object configuration.
- [ScriptObject Object - query](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object-object#query-string)
- [Script Object - apiVersion](https://help.sfdmu.com/full-documentation/export-json-file-objects-specification/script-object#apiversion-string-in-float-format)
