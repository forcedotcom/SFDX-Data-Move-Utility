# [5.0.0-beta](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.39.0...5.0.0-beta) (2026-02-16)

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

# [4.38.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.37.0...4.38.0) (2024-12-29)

###### New features:

- Added support for `Product2` in multiselect query mode, improving automatic field selection for that object.

###### Improvements:

- Improved multiselect query auto-selection for `Product2` by excluding unsupported technical fields from generated queries.

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

## [4.36.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.7...4.36.8) (2024-11-23)

###### Fixes:

- Fixed record comparison during update processing by ignoring temporary source-id helper fields, reducing false-positive update detections.

## [4.36.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.3...4.36.7) (2024-10-29)

###### Fixes:

- Fixed mapped update/upsert behavior so source-target identity is preserved when custom external-id mapping is used.
- Fixed lookup relationship mapping propagation so reference fields are resolved consistently after mapping.

###### Improvements:

- Added stable source-record identity tracking so mapped update/upsert flows keep consistent source-target links.

## [4.36.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.2...4.36.3) (2024-09-19)

###### Fixes:

- Fixed plugin installation packaging issues to improve installation stability.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @oclif/errors, @oclif/core, @salesforce/core); updated devDependencies (@types/node).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.36.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.1...4.36.2) (2024-09-19)

###### Other changes:

- Changed package.json: updated dependencies (madge).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.36.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.36.0...4.36.1) (2024-09-19)

###### Improvements:

- Improved execution log readability by standardizing separator/newline output formatting.

###### Other changes:

- Updated issue templates (ask-a-question.md, ask-question---gui-only-.md, bug-in-gui-app-only.md, bug-report.md, request-a-new-feature.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated dependencies (@oclif/core, @oclif/command, @oclif/config, @oclif/errors, @salesforce/core, alasql (+1 more)); updated devDependencies (@types/node, typescript).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

# [4.36.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.35.1...4.36.0) (2024-09-07)

###### New features:

- Added support for `valueSource` in `core:RecordsTransform`, allowing transformation logic to explicitly use source or target-side values during record updates.

## [4.35.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.35.0...4.35.1) (2024-08-18)

###### Fixes:

- Fixed null/clear behavior consistency across REST and Bulk API paths by normalizing `#N/A` conversion before API write operations.
- Fixed org-media transformation behavior so null values can be intentionally propagated as clear operations instead of being silently dropped.

###### Improvements:

- Added explicit runtime null-marker processing (`#N/A`) in write pipelines to support controlled target-field clearing in org migrations.

# [4.35.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.2...4.35.0) (2024-08-13)

###### New features:

- Added `ORDER BY` support for `core:ExportFiles` linked-document retrieval (`contentDocumentLinkOrderBy`) to make file export/import ordering predictable.
- Added add-on runtime support for `orderBy` in generated SOQL helper queries, enabling deterministic query ordering in add-on modules.

## [4.34.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.1...4.34.2) (2024-08-13)

Code improvements and bug fixes

## [4.34.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.34.0...4.34.1) (2024-08-13)

###### Fixes:

- Fixed CSV parser loading (`parse is not a function`) by switching to a compatible sync parser import path in Bulk API v2/common CSV processing.

# [4.34.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.19...4.34.0) (2024-08-13)

###### New features:

- Added `RAW_VALUE` placeholder support for `c_set_value` mock expressions, enabling templates that combine generated values with the original field value.
- Added explicit mock constant wiring so anonymization patterns can safely reference the original value in a controlled format.

###### Fixes:

- Fixed mock expression execution flow so current field value is correctly passed into `c_set_value`, preventing incorrect substitutions in anonymization pipelines.

## [4.33.19](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.18...4.33.19) (2024-08-09)

###### Fixes:

- Fixed lookup search behavior in `core:RecordsTransform`, improving relation resolution reliability during transformed migrations.

## [4.33.18](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.17...4.33.18) (2024-08-04)

###### Fixes:

- Fixed CSV export behavior so value mapping is now applied before writing records to CSV files.
- Fixed an issue where transformed values could be missing in exported CSV output.

###### Other changes:

- Updated issue templates (ask-question---gui-only-.md, ask-question---plugin-only-.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.

## [4.33.17](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.16...4.33.17) (2024-05-02)

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, issue-response-handler.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.
- Changed package.json: updated dependencies (csv-writer, glob, tslib).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.33.16](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.15...4.33.16) (2024-05-01)

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, issue-response-handler.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated issue templates (ask-question.md, bug-in-gui-app-only.md, bug-in-the-plugin-only.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .github/dependabot.yml: changed update cadence, package-ecosystem scope, and repository directory targets.
- Changed package.json: updated dependencies (@salesforce/core, class-transformer, fastest-levenshtein, jsforce, promise-parallel-throttle); updated devDependencies (ts-node, tslint).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.33.15](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.14...4.33.15) (2024-04-28)

###### Fixes:

- Fixed `eval(...)` field-mapping expression parsing, improving reliability for evaluated mapping rules.

###### Other changes:

- Updated CI/release workflows (codeql-analysis.yml, stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

## [4.33.14](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.13...4.33.14) (2024-04-28)

###### Other changes:

- Updated issue templates (bug-report-in-sfdmu-gui-app.md, bug-report-in-the-sfdmu-plugin.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Changed package.json: updated dependencies (@babel/traverse); updated package metadata fields (author).

## [4.33.13](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.12...4.33.13) (2024-04-23)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.33.12](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.11...4.33.12) (2024-04-22)

Code improvements and bug fixes

## [4.33.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.10...4.33.11) (2024-04-22)

Code improvements and bug fixes

## [4.33.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.9...4.33.10) (2024-04-22)

Code improvements and bug fixes

## [4.33.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.8...4.33.9) (2024-04-20)

###### Other changes:

- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.33.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.7...4.33.8) (2024-04-20)

###### Other changes:

- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @salesforce/command, @salesforce/core, @salesforce/dev-config, @types/bunyan); updated devDependencies (@oclif/dev-cli, @oclif/plugin-help, @oclif/test, @types/chai, @types/mocha, @types/node (+4 more)).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.33.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.6...4.33.7) (2024-04-15)

###### Fixes:

- Fixed CSV source-file repair diagnostics to use clearer, user-oriented column names.
- Fixed noisy CSV issue reporting in lookup-repair paths to reduce misleading warning rows.

## [4.33.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.5...4.33.6) (2024-04-15)

###### Fixes:

- Fixed CSV target file generation when `excludeIdsFromCSVFiles=true` and operation is `Insert`.
- Fixed engine behavior for file-target runs by using a safe operation mode that avoids invalid CSV generation.

## [4.33.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.4...4.33.5) (2024-04-11)

###### Improvements:

- Updated the default Salesforce API version from `53.0` to `60.0` for newly created runs.

## [4.33.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.3...4.33.4) (2024-03-15)

###### Fixes:

- Fixed add-on event wiring so record filter add-ons are invoked consistently through the new event name.

###### Improvements:

- Added an explicit add-on event name `filterRecordsAddons` for record filtering handlers.
- Changed custom add-on event contracts to use `filterRecordsAddons` instead of `onTargetDataFiltering`.

## [4.33.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.2...4.33.3) (2024-03-13)

###### Improvements:

- Improved custom add-on TypeScript interfaces by making script and object members optional.
- Improved add-on compatibility by allowing modules to consume only required fields without strict full-model requirements.

## [4.33.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.1...4.33.2) (2024-03-12)

###### Fixes:

- Fixed script object filtering so excluded objects are reliably removed during script initialization.

###### Improvements:

- Changed User-related reference preload behavior to run a dedicated Queue `Group` query for stable User/Queue resolution.
- Improved object handling so `Group` is managed through preload logic instead of direct migration flow.

## [4.33.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.33.0...4.33.1) (2024-03-12)

###### Fixes:

- Fixed User/Group auto-query expansion so it runs only for non-filtered queries.
- Fixed unexpected query broadening when your original SOQL already has a `WHERE` clause.

# [4.33.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.8...4.33.0) (2024-03-12)

###### New features:

- Added `skipRecordsComparison` to `ScriptObject` so matched records can still be force-updated when needed.
- Added `skipRecordsComparison`, `useSourceCSVFile`, and `filterRecordsAddons` support to custom add-on script object contracts.

###### Fixes:

- Fixed update/upsert selection logic so `skipRecordsComparison=true` reliably moves matched records into the update pipeline.

## [4.32.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.7...4.32.8) (2024-03-11)

###### Fixes:

- Fixed custom lookup/relationship field-name normalization to prevent malformed reference field names in queries and mappings.

## [4.32.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.6...4.32.7) (2024-03-10)

###### Fixes:

- Fixed `core:RecordsTransform` lookup logic for `lookupSource='target'` so formulas evaluate against target records correctly.
- Fixed source-record resolution for transformed lookups when records are resolved from target-side maps.

###### Improvements:

- Improved reference type detection for commonly used ownership/lookup fields.
- Changed add-on `onBeforeUpdate` timing so it runs before insert/update split and can inspect all prepared records.

## [4.32.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.5...4.32.6) (2024-03-03)

Code improvements and bug fixes

## [4.32.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.4...4.32.5) (2024-03-03)

###### Fixes:

- Fixed `--logfullquery` CLI help binding so the long description text is resolved correctly.

## [4.32.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.3...4.32.4) (2024-03-03)

###### Fixes:

- Fixed run-command flag parsing so the selected `--usesf` value is applied correctly.

###### Improvements:

- Changed `--usesf` to accept explicit values (`true` / `false`) and set default to `true`.
- Improved CLI mode control so you can explicitly force `sf` or legacy `sfdx` command execution.

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

## [4.32.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.2...4.32.3) (2024-03-03)

###### Improvements:

- Changed default command mode to `--usesf=true`, so modern `sf` CLI commands are used unless explicitly overridden.

## [4.32.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.1...4.32.2) (2023-11-30)

###### Fixes:

- Fixed update detection when Id mapping is active, so mapped records are no longer skipped as unchanged.

## [4.32.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.32.0...4.32.1) (2023-11-22)

###### Fixes:

- Improved org connection initialization for expired-auth scenarios and org metadata loading.
- Improved org metadata validation by reading access, org type, and sandbox attributes in one guarded flow.

###### Other changes:

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

# [4.32.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.31.0...4.32.0) (2023-11-14)

###### New features:

- Added automatic alphabetical sorting of CSV columns, so exported files are deterministic and easier to compare.

###### Improvements:

- Improved CSV determinism by sorting generated CSV columns alphabetically for easier diff/review.

# [4.31.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.30.0...4.31.0) (2023-11-13)

###### New features:

- Added `queryBulkApiThreshold` script support to control when query execution switches to Bulk Query API.
- Added runtime diagnostics that show whether each object query runs via REST API or Bulk Query API.
- Updated query API selection logic to use the configured threshold value for source and target reads.

###### Fixes:

- Fixed query API mode selection consistency across retrieval paths.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

# [4.30.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.8...4.30.0) (2023-08-14)

###### New features:

- Added `pollingQueryTimeoutMs` script support to control Bulk Query polling timeout.
- Applied the timeout consistently across source/target queries, filtered retrieval, delete reads, and add-on runtime queries.
- Replaced fixed query-poll timeout constants with script-configurable timeout behavior.

## [4.29.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.7...4.29.8) (2023-08-11)

###### Fixes:

- Fixed value-mapping handling for `null`, `undefined`, and boolean `false` source values.
- Fixed false-empty conversion during mapping to keep expected field values in migration output.

## [4.29.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.6...4.29.7) (2023-08-03)

###### Fixes:

- Fixed large CSV write stability by using stream-based CSV output and waiting for file completion before finishing the step.
- Reduced incomplete-file risk in heavy CSV export runs.

## [4.29.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.5...4.29.6) (2023-07-31)

###### Fixes:

- Reverted the previous CSV writer change to restore stable CSV generation behavior.

## [4.29.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.4...4.29.5) (2023-07-29)

###### Improvements:

- Added stream-based CSV writer processing to reduce memory pressure during very large CSV exports.

## [4.29.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.3...4.29.4) (2023-07-26)

###### Fixes:

- Fixed `excludedFromUpdateFields` property naming (`excudedFromUpdateFields` typo removed).
- Fixed update filtering behavior and add-on typings to use the corrected property consistently.

## [4.29.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.2...4.29.3) (2023-07-20)

###### Fixes:

- Fixed `core:ExportFiles` upload error marking so only versions in the failed chunk are flagged.
- Fixed chunk-level error scoping so unrelated files are not incorrectly marked as failed.

## [4.29.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.1...4.29.2) (2023-06-25)

###### Fixes:

- Fixed composed WHERE-clause generation by wrapping incoming filter expressions in parentheses.
- Improved query correctness when combining existing filters with additional conditions.

## [4.29.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.29.0...4.29.1) (2023-06-25)

###### Fixes:

- Fixed custom add-on module loading when an add-on does not implement `onInit`.
- Improved add-on initialization to handle missing optional `onInit` safely.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

# [4.29.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.28.1...4.29.0) (2023-06-25)

###### New features:

- Added `--logfullquery` flag to print full SOQL statements in logs when needed.
- Added script/runtime propagation for `logfullquery` so query log behavior is controlled per run.

###### Fixes:

- Fixed query-log shortening logic to follow the new `logfullquery` behavior.
- Fixed command-executor wiring so the new logging flag is passed correctly into run execution.

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

## [4.28.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.28.0...4.28.1) (2023-06-25)

###### Fixes:

- Fixed query logging so full SOQL is printed when log level is `TRACE`.

###### Improvements:

- Improved TRACE diagnostics so full SOQL text is available when deep troubleshooting is needed.

# [4.28.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.27.0...4.28.0) (2023-06-05)

###### New features:

- Added warning output when a `targetRecordsFilter` expression cannot be applied.

###### Fixes:

- Fixed target-filter fallback behavior so migration continues with explicit diagnostics instead of silent filter failure.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

# [4.27.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.13...4.27.0) (2023-05-17)

###### New features:

- Added support for `sf org display` output handling, improving org connection detection in CLI workflows.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

## [4.26.13](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.12...4.26.13) (2023-05-02)

Code improvements and bug fixes

## [4.26.12](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.11...4.26.12) (2023-05-02)

Code improvements and bug fixes

## [4.26.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.10...4.26.11) (2023-05-01)

###### Other changes:

- Updated CI/release workflows (manualRelease.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

## [4.26.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.8...4.26.10) (2023-03-20)

Code improvements and bug fixes

## [4.26.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.7...4.26.8) (2023-02-19)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.26.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.6...4.26.7) (2023-02-19)

Code improvements and bug fixes

## [4.26.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.5...4.26.6) (2023-02-19)

Code improvements and bug fixes

## [4.26.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.4...4.26.5) (2023-02-08)

Code improvements and bug fixes

## [4.26.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.3...4.26.4) (2023-02-08)

Code improvements and bug fixes

## [4.26.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.2...4.26.3) (2023-02-08)

###### Other changes:

- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

## [4.26.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.1...4.26.2) (2023-01-28)

Code improvements and bug fixes

## [4.26.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.26.0...4.26.1) (2023-01-28)

Code improvements and bug fixes

# [4.26.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.25.0...4.26.0) (2023-01-27)

###### New features:

- Added separate target output directories for each `objectSet`, so each set can store generated files independently.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

# [4.25.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.24.0...4.25.0) (2023-01-27)

###### New features:

- Added separate CSV delimiter settings for input and output (`csvReadFileDelimiter`, `csvWriteFileDelimiter`).

# [4.24.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.11...4.24.0) (2023-01-27)

###### New features:

- Added `useSourceCSVFile`, allowing jobs to read source CSV files directly when configured.

## [4.23.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.9...4.23.11) (2023-01-26)

###### Other changes:

- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

## [4.23.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.8...4.23.9) (2023-01-18)

Code improvements and bug fixes

## [4.23.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.7...4.23.8) (2023-01-16)

Code improvements and bug fixes

## [4.23.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.6...4.23.7) (2023-01-16)

Code improvements and bug fixes

## [4.23.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.5...4.23.6) (2023-01-16)

Code improvements and bug fixes

## [4.23.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.4...4.23.5) (2023-01-16)

Code improvements and bug fixes

## [4.23.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.3...4.23.4) (2023-01-16)

Code improvements and bug fixes

## [4.23.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.2...4.23.3) (2023-01-16)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.23.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.1...4.23.2) (2023-01-09)

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.
- Changed package.json: updated dependencies (@oclif/command, @oclif/config, @oclif/errors, @salesforce/command, @salesforce/core, @salesforce/dev-config); updated oclif plugin metadata; updated package metadata fields (description).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.23.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.23.0...4.23.1) (2023-01-04)

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

# [4.23.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.22.0...4.23.0) (2022-12-30)

###### New features:

- Added support for exporting Feed Attachments.

# [4.22.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.20.0...4.22.0) (2022-12-29)

###### New features:

- Added improved handling for dependent related objects, reducing parent/child ordering issues during migration.

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

# [4.20.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.6...4.20.0) (2022-12-26)

###### New features:

- Added `skipExistingRecords` at object level to skip records that already exist in the target.

## [4.19.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.5...4.19.6) (2022-12-25)

Code improvements and bug fixes

## [4.19.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.4...4.19.5) (2022-12-25)

Code improvements and bug fixes

## [4.19.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.3...4.19.4) (2022-12-25)

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.

## [4.19.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.2...4.19.3) (2022-12-23)

Code improvements and bug fixes

## [4.19.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.1...4.19.2) (2022-12-23)

Code improvements and bug fixes

## [4.19.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.19.0...4.19.1) (2022-12-23)

Code improvements and bug fixes

# [4.19.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.2...4.19.0) (2022-12-23)

###### New features:

- Added Lookup Expression support in `RecordsTransform`.

###### Deprecations/Removed features:

- Deprecated `includeLookupFields` in `RecordsTransform`; use `includeFields` in current configurations.

###### Other changes:

- Updated CI/release workflows (stale.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated issue templates (ask-question.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.18.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.1...4.18.2) (2022-12-02)

Code improvements and bug fixes

## [4.18.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.18.0...4.18.1) (2022-12-02)

Code improvements and bug fixes

# [4.18.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.8...4.18.0) (2022-11-24)

###### New features:

- Added `maxChunkSize` for `ExportFiles` add-on to control batch size for large file-processing jobs.

## [4.17.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.7...4.17.8) (2022-11-24)

Code improvements and bug fixes

## [4.17.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.6...4.17.7) (2022-11-24)

Code improvements and bug fixes

## [4.17.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.5...4.17.6) (2022-10-17)

Code improvements and bug fixes

## [4.17.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.4...4.17.5) (2022-10-13)

Code improvements and bug fixes

## [4.17.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.3...4.17.4) (2022-10-12)

Code improvements and bug fixes

## [4.17.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.17.2...4.17.3) (2022-10-12)

Code improvements and bug fixes

## [4.17.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.16.10...4.17.2) (2022-10-01)

###### New features:

- Added `excludedObjects` support to skip selected objects during migration execution.

## [4.16.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/4.16.6...4.16.10) (2022-09-29)

Code improvements and bug fixes

## [4.16.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.3...4.16.6) (2022-09-29)

###### Other changes:

- Updated CI/release workflows (failureNotifications.yml, manualRelease.yml, onPushToMain.yml, onRelease.yml): changed workflow triggers, schedules, and automation rules for issue/pr/release maintenance.
- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

## [4.16.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.1...v4.16.3) (2022-09-19)

Code improvements and bug fixes

## [4.16.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.16.0...v4.16.1) (2022-09-19)

Code improvements and bug fixes

# [4.16.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.5...v4.16.0) (2022-09-17)

###### New features:

- Added `hardDelete` and source-side delete operation support for more flexible delete scenarios.

## [4.15.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.4...v4.15.5) (2022-09-14)

Code improvements and bug fixes

## [4.15.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.3...v4.15.4) (2022-09-14)

Code improvements and bug fixes

## [4.15.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.2...v4.15.3) (2022-09-13)

Code improvements and bug fixes

## [4.15.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.1...v4.15.2) (2022-09-13)

Code improvements and bug fixes

## [4.15.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.15.0...v4.15.1) (2022-08-03)

Code improvements and bug fixes

# [4.15.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.6...v4.15.0) (2022-07-07)

###### New features:

- Added advanced mock-field capabilities (`all` pattern, `excludeNames`, `c_set_value`) for flexible data masking.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

## [4.14.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.5...v4.14.6) (2022-07-06)

Code improvements and bug fixes

## [4.14.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.4...v4.14.5) (2022-07-06)

Code improvements and bug fixes

## [4.14.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.3...v4.14.4) (2022-05-21)

Code improvements and bug fixes

## [4.14.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.2...v4.14.3) (2022-05-12)

Code improvements and bug fixes

## [4.14.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.1...v4.14.2) (2022-05-10)

Code improvements and bug fixes

## [4.14.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.14.0...v4.14.1) (2022-05-09)

Code improvements and bug fixes

# [4.14.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.5...v4.14.0) (2022-05-09)

###### New features:

- Added `objectSets` to split one migration configuration into reusable object-set groups.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.13.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.4...v4.13.5) (2022-05-07)

Code improvements and bug fixes

## [4.13.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.3...v4.13.4) (2022-04-18)

Code improvements and bug fixes

## [4.13.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.2...v4.13.3) (2022-04-18)

###### Other changes:

- Updated messages/run.json: refined CLI flag descriptions and examples.

## [4.13.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.1...v4.13.2) (2022-04-18)

###### Other changes:

- Updated issue templates (feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

## [4.13.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.13.0...v4.13.1) (2022-04-16)

Code improvements and bug fixes

# [4.13.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.11...v4.13.0) (2022-03-24)

###### New features:

- Added per-object parallelism controls (`parallelBulkJobs`, `parallelRestJobs`) to tune migration throughput.

## [4.12.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.10...v4.12.11) (2022-03-22)

Code improvements and bug fixes

## [4.12.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.9...v4.12.10) (2022-03-21)

Code improvements and bug fixes

## [4.12.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.8...v4.12.9) (2022-02-27)

Code improvements and bug fixes

## [4.12.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.6...v4.12.8) (2022-02-27)

###### Other changes:

- Updated issue templates (bug-report-in-the-sfdmu-gui-app.md, feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.
- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

## [4.12.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.5...v4.12.6) (2022-01-19)

Code improvements and bug fixes

## [4.12.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.4...v4.12.5) (2022-01-16)

Code improvements and bug fixes

## [4.12.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.3...v4.12.4) (2022-01-15)

Code improvements and bug fixes

## [4.12.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.2...v4.12.3) (2022-01-09)

Code improvements and bug fixes

## [4.12.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.1...v4.12.2) (2022-01-02)

Code improvements and bug fixes

## [4.12.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.12.0...v4.12.1) (2022-01-01)

Code improvements and bug fixes

# [4.12.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.11...v4.12.0) (2022-01-01)

###### New features:

- Added `RecordsFilter` core add-on for configurable record filtering during migration runs.

## [4.11.11](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.10...v4.11.11) (2021-12-30)

Code improvements and bug fixes

## [4.11.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.9...v4.11.10) (2021-12-29)

Code improvements and bug fixes

## [4.11.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.7...v4.11.9) (2021-12-21)

Code improvements and bug fixes

## [4.11.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.6...v4.11.7) (2021-12-19)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.

## [4.11.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.4...v4.11.6) (2021-12-17)

Code improvements and bug fixes

## [4.11.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.3...v4.11.4) (2021-12-17)

Code improvements and bug fixes

## [4.11.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.2...v4.11.3) (2021-12-16)

Code improvements and bug fixes

## [4.11.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.1...v4.11.2) (2021-12-15)

Code improvements and bug fixes

## [4.11.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.11.0...v4.11.1) (2021-12-14)

Code improvements and bug fixes

# [4.11.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.3...v4.11.0) (2021-12-14)

###### New features:

- Added standalone execution options and `queryAllTarget` support for extended target-query scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.10.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.2...v4.10.3) (2021-11-27)

Code improvements and bug fixes

## [4.10.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.1...v4.10.2) (2021-11-18)

Code improvements and bug fixes

## [4.10.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.10.0...v4.10.1) (2021-11-18)

Code improvements and bug fixes

# [4.10.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.5...v4.10.0) (2021-11-18)

###### New features:

- Added `useQueryAll` support to include archived/deleted records where Salesforce query-all is available.

## [4.9.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.4...v4.9.5) (2021-11-02)

Code improvements and bug fixes

## [4.9.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.3...v4.9.4) (2021-11-02)

Code improvements and bug fixes

## [4.9.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.2...v4.9.3) (2021-11-02)

Code improvements and bug fixes

## [4.9.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.1...v4.9.2) (2021-11-02)

Code improvements and bug fixes

## [4.9.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.9.0...v4.9.1) (2021-11-02)

Code improvements and bug fixes

# [4.9.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.3...v4.9.0) (2021-11-01)

###### New features:

- Added `excludedFromUpdateFields` to keep selected fields unchanged during update operations.

## [4.8.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.2...v4.8.3) (2021-10-31)

Code improvements and bug fixes

## [4.8.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.1...v4.8.2) (2021-10-31)

Code improvements and bug fixes

## [4.8.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.8.0...v4.8.1) (2021-10-31)

Code improvements and bug fixes

# [4.8.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.7.0...v4.8.0) (2021-10-31)

###### New features:

- Added new `RecordsTransform` add-on capabilities for richer field and lookup transformation scenarios.

# [4.7.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.4...v4.7.0) (2021-10-28)

###### New features:

- Added multithreaded API execution and query caching to improve migration performance on large datasets.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.6.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.3...v4.6.4) (2021-10-26)

###### Other changes:

- Updated governance files (CODEOWNERS): updated ownership mappings, contribution process notes, and security reporting instructions.

## [4.6.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.2...v4.6.3) (2021-10-25)

Code improvements and bug fixes

## [4.6.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.1...v4.6.2) (2021-10-25)

Code improvements and bug fixes

## [4.6.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.6.0...v4.6.1) (2021-10-24)

Code improvements and bug fixes

# [4.6.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.10...v4.6.0) (2021-10-24)

###### New features:

- Added improved REST API and Attachment handling for more reliable file-related migrations.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.5.10](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.9...v4.5.10) (2021-10-21)

Code improvements and bug fixes

## [4.5.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.8...v4.5.9) (2021-10-21)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.5.8](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.7...v4.5.8) (2021-10-20)

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.5.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.6...v4.5.7) (2021-10-19)

Code improvements and bug fixes

## [4.5.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.5...v4.5.6) (2021-10-19)

Code improvements and bug fixes

## [4.5.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.4...v4.5.5) (2021-10-19)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.5.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.3...v4.5.4) (2021-10-18)

Code improvements and bug fixes

## [4.5.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.2...v4.5.3) (2021-10-18)

Code improvements and bug fixes

## [4.5.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.1...v4.5.2) (2021-10-18)

Code improvements and bug fixes

## [4.5.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.5.0...v4.5.1) (2021-10-13)

Code improvements and bug fixes

# [4.5.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.7...v4.5.0) (2021-10-13)

###### New features:

- Added SFDMU add-on runtime updates that expand custom module integration capabilities.

###### Other changes:

- Updated .gitignore: updated ignore patterns for local artifacts, logs, and development-generated files.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated scripts (typedoc-sfdmu-run-addons); updated devDependencies (typescript).
- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [4.4.7](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.6...v4.4.7) (2021-10-05)

Code improvements and bug fixes

## [4.4.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.5...v4.4.6) (2021-09-30)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.4.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.4...v4.4.5) (2021-08-18)

Code improvements and bug fixes

## [4.4.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.3...v4.4.4) (2021-08-15)

Code improvements and bug fixes

## [4.4.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.2...v4.4.3) (2021-07-11)

Code improvements and bug fixes

## [4.4.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.1...v4.4.2) (2021-05-30)

Code improvements and bug fixes

## [4.4.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.4.0...v4.4.1) (2021-05-23)

Code improvements and bug fixes

# [4.4.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.3.1...v4.4.0) (2021-05-22)

###### New features:

- Added stability improvements in org-script configuration handling for CLI connection setup.

###### Other changes:

- Updated messages/resources.json and messages/run.json: refined runtime messages and CLI help text.

## [4.3.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.3.0...v4.3.1) (2021-05-15)

Code improvements and bug fixes

# [4.3.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.6...v4.3.0) (2021-05-12)

###### New features:

- Added `simulationMode`, allowing dry-run execution without writing changes to the target org.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.2.6](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.4...v4.2.6) (2021-05-03)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.2.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.3...v4.2.4) (2021-05-03)

Code improvements and bug fixes

## [4.2.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.2...v4.2.3) (2021-05-03)

###### Other changes:

- Updated issue templates (feature-request.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

## [4.2.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.1...v4.2.2) (2021-05-02)

Code improvements and bug fixes

## [4.2.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.2.0...v4.2.1) (2021-05-02)

###### Other changes:

- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.

# [4.2.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.4...v4.2.0) (2021-05-01)

###### New features:

- Added `deleteByHierarchy` to delete related records in hierarchy-aware order.

###### Other changes:

- Updated .circleci/config.yml: updated CI jobs, branch/tag filters, and release execution steps.
- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.1.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.3...v4.1.4) (2021-04-29)

Code improvements and bug fixes

## [4.1.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.2...v4.1.3) (2021-04-29)

Code improvements and bug fixes

## [4.1.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.1...v4.1.2) (2021-04-29)

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.1.1](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.1.0...v4.1.1) (2021-04-27)

Code improvements and bug fixes

# [4.1.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.3...v4.1.0) (2021-04-27)

###### New features:

- Added `deleteFromSource` support and flexible source/target defaults when one username is omitted.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [4.0.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.2...v4.0.3) (2021-04-20)

Code improvements and bug fixes

## [4.0.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v4.0.0...v4.0.2) (2021-04-19)

Code improvements and bug fixes

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

## [3.10.5](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.10.4...v3.10.5) (2021-02-28)

###### Other changes:

- Updated yarn.lock: regenerated lockfile to match package.json dependency changes.

## [3.10.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.10.3...v3.10.4) (2021-02-25)

Code improvements and bug fixes

## [3.10.3](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.9.3...v3.10.3) (2021-02-25)

###### New features:

- Added `core:ExportFiles` add-on capabilities and improved add-on runtime messaging.

###### Deprecations/Removed features:

- Deprecated direct `ContentVersion` migration in the core flow; use `core:ExportFiles` for file migration scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.

## [3.7.21](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.20...v3.7.21) (2020-11-23)

Code improvements and bug fixes

## [3.7.17](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.14...v3.7.17) (2020-10-20)

Code improvements and bug fixes

## [3.7.4](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.7.3...v3.7.4) (2020-09-21)

###### Other changes:

- Updated issue templates (question-or-help.md): updated issue form fields, required reproduction steps, and mandatory diagnostic/log sections.

## [3.5.9](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.5.5...v3.5.9) (2020-07-21)

Code improvements and bug fixes

# [3.4.0](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.3.5...v3.4.0) (2020-06-13)

###### New features:

- Added field/value mapping enhancements, including compound field mapping scenarios.

###### Other changes:

- Updated messages/resources.json: updated runtime message keys and wording for command output, warnings, and errors.
- Changed package.json: updated oclif plugin metadata; updated package metadata fields (description).

## [3.1.2](https://github.com/forcedotcom/SFDX-Data-Move-Utility/compare/v3.1.0...v3.1.2) (2020-06-01)

Code improvements and bug fixes
