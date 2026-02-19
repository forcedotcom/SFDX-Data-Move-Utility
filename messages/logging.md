# newLine

\n

# separator

=============

# source

SOURCE

# target

TARGET

# step1

STAGE 1

# step2

STAGE 2

# pass1

PASS 1

# pass2

PASS 2

# pass3

PASS 3

# pass4

PASS 4

# deletePass

DELETE

# objectSetStarted

===== OBJECT SET #%s STARTED =====

# csvFile

CSV file

# org

Org

# sourceOrg

%s.

# targetOrg

%s.

# noRecords

No records

# insert

Insert

# update

Update

# personContact

Person Contact

# cantLoad

%s is not found or could not be loaded.

# orgAliasNotFound

Invalid %s org '%s': not found in the environment.

# global

Global

# cantLoadModule

Cannot load module '%s'. Please ensure that the module exists in the desired location, it is properly configured, and it has an 'onExecute' entry point function.

# actionNotPermitted

The action is not permitted.

# defaultPromptOptions

y/n

# defaultNopromptOption

y

# defaultPromptNoOption

n

# userConfirmTemplate

%s (%s) ?

# userTextInputTemplate

%s ?

# formattedDateLogTemplate

[%s]

# infoLogTemplate

%s %s

# warnLogTemplate

%s [WARNING] %s

# errorLogTemplate

%s [ERROR] %s

# traceLogTemplate

[STACK TRACE] %s

# timeElapsedLogTemplate

Total time elapsed: %s.

# commandStartTemplate

Execution of the command %s has been started.

# commandFinishTemplate

Execution of the command %s has been completed. Exit code %s (%s).

# commandFailedConfigurationGuidance

To localize the root cause of the issue, first check your migration configuration, because most failures are caused by setup mistakes.

If you decide to open an issue in the GitHub issue tracker, please run SFDMU with --diagnostic --anonymise and attach to your issue the full generated .log file from that run.

Example:
sf sfdmu run --sourceusername source@name.com --targetusername target@name.com --diagnostic --anonymise

Sensitive data in this log is masked when --anonymise is used.
For exact details, see https://help.sfdmu.com/full-documentation/reports/the-execution-log#what-is-masked-and-what-is-not.

If there are failed rows, please also attach the relevant \_target.csv (with 1-2 full affected rows).

Without the full diagnostic log, I cannot investigate and help with this issue.

# jobCompletedHeader

===== MIGRATION JOB ENDED =====

# jobStartedHeader

===== MIGRATION JOB STARTED =====

# infoFileLogTemplate

\n%s %s

# warnFileLogTemplate

\n%s [WARN] %s

# errorFileLogTemplate

\n%s [ERROR] %s

# commandSucceededResult

Command succeeded.

# commandInitializationErrorResult

Command initialization error: %s.

# commandOrgMetadataErrorResult

Error during analysing of the org metadata: %s.

# commandExecutionErrorResult

Error during execution of the command: %s.

# commandAbortedDueWarningErrorResult

Execution of the command has aborted due to warning: %s.

# commandAbortedByUserErrorResult

Execution of the command has aborted by the user.

# commandAbortedByAddOnErrorResult

Execution of the command has aborted due to error

# commandAbortedDueUnexpectedErrorResult

Execution of the command has aborted due to unexpected error: %s.

# loadingCoreAddonManifestFile

Loading Core Add-On Module declarations ...

# loadingAddonModule

Loading Add-On module %s ...

# workingPathDoesNotExist

The specified working directory does not exist.

# packageFileDoesNotExist

Missing export.json file in the working directory.

# loadingExportJson

Loading and validating the export.json script (%s)...

# objectIsExcluded

{%s} Object will be excluded from the process.

# objectExcludedOnlyId

[WARNING] {%s} Only Id remains in the query, so the object will be excluded from the migration.

# objectOperationChangedToReadonly

[WARNING] {%s} All remaining fields are readonly, so the operation was changed to Readonly.

# objectOperationForcedReadonly

[WARNING] {%s} Operation was changed to Readonly because %s.

# objectOperationChangedByMetadata

[WARNING] {%s} Operation was changed from %s to %s because %s.

# objectDeleteFlagsDisabled

[WARNING] {%s} Delete flags were disabled (%s) because the target object is not deletable in the org metadata.

# objectExcludedAutoAddedUnreferenced

[WARNING] {%s} Auto-added and unreferenced by any lookup fields, so it was excluded from the migration.

# noObjectsToProcess

There are no objects to process.

# incorrectExportJsonFormat

Incorrect format of the export.json file. Error message: %s.

# exportJsonFileLoadError

Failed to read the export.json file. Error message: %s.

# connectingToOrgSf

Connecting to the %s

# successfullyConnected

Successfully connected to the %s.

# connectingFailed

Attempt to connect to the %s has been failed. Try to refresh the local sfdx CLI connection.

# cannotMigrateFile2File

You cannot migrate data between CSV files. Either a data Source or a data Target must be a salesforce org.

# errorMissingRequiredFlag

Missing required flag(s): %s

# accessTokenExpired

Access token to the %s has been expired or the user has no access permissions.

# malformedQuery

{%s} Malformed query string: %s. Error message: %s.

# malformedDeleteQuery

{%s} Malformed delete query string: %s. Error message: %s.

# retrievingObjectMetadata

{%s} Fetching metadata (%s) ...

# noExternalKey

{%s} has no mandatory external Id field definition.

# missingObjectInSource

{%s} is missing in the Source.

# missingObjectInTarget

{%s} is missing in the Target.

# processingObject

{%s} Processing the object ...

# missingFieldInSource

{%s.%s} Missing in the Source.

# missingFieldInTarget

{%s.%s} Missing in the Target.

# missingFieldInSourceExcluded

[WARNING] {%s.%s} Missing in the Source and will be excluded from the migration.

# missingFieldInTargetExcluded

[WARNING] {%s.%s} Missing in the Target and will be excluded from the migration%s.

# missingFieldInBothExcluded

[WARNING] {%s.%s} Missing in both Source and Target and will be excluded from the migration.

# missingFieldsToProcess

{%s} has no fields to process.

# lookupFieldExcludedBecauseParentExcluded

[WARNING] {%s.%s} Lookup removed because referenced object %s is excluded.

# referencedFieldExcludedFromQuery

[WARNING] {%s.%s} Referenced field removed from the script query. It will be added automatically if required.

# fieldIsNotOfPolymorphicType

[WARNING] {%s.%s} Incorrectly defined as a polymorphic field, so the normal lookup field type was used instead.

# fieldMissingPolymorphicDeclaration

[WARNING] {%s.%s} Missing declaration of the referenced object type (e.g. %s$Account), so this field was excluded from the process.

# theExternalIdNotFoundInTheQuery

{%s.%s} External Id field %s for the parent object %s was not found in the query string of %s, so it was added. External Id remains %s.

# soqlParseFailed

[WARNING] Failed to parse SOQL query. Query: %s. Error: %s

# dataMigrationProcessStarted

Preparing data migration job ...

# buildingMigrationStaregy

Building the migration strategy ...

# readingCsvFileError

Error occurred while reading from the CSV file %s: %s.

# writingCsvFileError

Error occurred while writing to the CSV file %s: %s.

# readingValuesMappingFile

Reading the values mapping definition file (%s) ...

# mappingValues

{%s} Applying the value mapping ...

# mappingValuesFields

{%s} Applying the value mapping ... Fields: %s.

# mappingValueRules

{%s.%s} Value mapping rules: %s.

# mappingValueRuleApplied

{%s.%s} Value mapping rule "%s" applied to %s records.

# exportJsonDiagnosticHeader

Export.json contents:

# applyingMocking

{%s} Applying the data mocking... Fields: %s.

# mockingFieldPattern

{%s.%s} Mock pattern: %s.

# mockingFieldApplied

{%s.%s} Mock formula "%s" applied to %s records.

# csvIssuesDiagnosticHeader

Issues in the CSV Files:

# processingCsvFiles

Validation of the source CSV files ...

# processingCsvFilesSkipped

Validation of the source CSV files was skipped.

# writingCsvFile

Writing to %s ...

# incorrectCsvFiles

%s issues were found in source CSV file. See %s file for the details.

# continueTheJob

Continue the job

# missingCsvFile

MISSING CSV FILE

# missingColumnsInCsvFile

MISSING COLUMN IN THE CSV FILE

# csvValidateOnlyNoIssues

No issues were found in CSV files.

# csvValidateOnlyIssuesFound

CSV issues were found and written to %s in the 'reports/' folder.

# csvValidateOnlyNormalizedWritten

Normalized csv source files were written to the 'source/' folder

# missingParentLookupRecords

MISSING PARENT LOOKUP RECORD

# csvFilesWereUpdated

Amount of updated source CSV files: %s.

# validationCsvFileCompleted

Processing the source CSV files has been completed.

# unableToDeleteTargetDirectory

Unable to clean-up the target directory: '%s'. It's probably locked by another application.

# unableToDeleteReportsDirectory

Unable to clean-up the reports directory: '%s'. It's probably locked by another application.

# unableToDeleteSourceDirectory

Unable to clean-up the source directory: '%s'. It's probably locked by another application.

# canModifyPrompt

NOTE! The Plugin has detected that you are about to modify the Production org.\nTo confirm that you really want to modify this org, please type: %s

# instanceUrlMismatch

Entered instance URL '%s' does not match '%s'.

# preparingJob

Preparing of the data migration job has been completed.

# executingJob

Ready to process the data.

# executionOrder

Order of objects to update

# queryingOrder

Order of objects to query

# deletingOrder

Order of objects to delete

# unprocessedRecord

This record was not processed yet.

# invalidRecordHashcode

Could not locate this record in the API response.

# apiOperationFailed

{%s} The %s API operation has been failed.

# apiOperationFailedWithMessage

{%s} The %s API operation has been failed. Error message: %s.

# apiOperationJobCreated

[Job# %s:%s] {%s} The job has been created. Uploading data ...

# apiOperationBatchCreated

[Batch# %s:%s] {%s} The batch has been created. Uploading data ...

# apiOperationDataUploaded

[Batch# %s:%s] {%s} The data has been uploaded. Processing ...

# apiOperationInProgress

[Batch# %s:%s] {%s} Processing ... %s records processed, %s records failed.

# apiOperationCompleted

[Batch# %s:%s] {%s} Completed. %s records processed, %s records failed.

# apiOperationWarnCompleted

[Batch# %s:%s] {%s} Completed with issues. %s records processed, %s records failed.

# apiOperationStarted

{%s} The %s API operation has been started using %s%s.

# apiOperationFinished

{%s} The %s API operation has been completed.

# simulationMode

(SIMULATION MODE)

# analysingData

ANALYSING DATA...

# totalRecordsAmountByQueryString

{%s} The original query string of this object is returning %s records from the %s org.

# deletingTargetData

Deleting old data from the Target ...

# deletingTargetSObjectRecords

{%s} Deleting old records from the Target ...

# deletingSourceSObjectRecords

{%s} Deleting records from the Source ...

# amountOfRecordsToDelete

{%s} Amount of records to delete: %s.

# deletingRecordsCompleted

{%s} Deleting has been completed.

# nothingToDelete

{%s} No records to delete.

# nothingToDelete2

No data to delete.

# deletingDataCompleted

Deleting data has been completed.

# deletingDataSkipped

Deleting data was skipped.

# retrievingData

===== Fetching the data (%s) =====

# usingRestApi

{%s} Using REST API (v%s) to retrieve the data ...

# usingBulkAPIQuery

{%s} Using Bulk API Query (v%s) to retrieve the data ...

# usingApiForDml

{%s} Using %s (API v%s) to execute %s ...

# retrievingDataCompleted

Data retrieval (%s) has been completed.

# queryingAll

{%s} Fetching the %s data from %s (%s: all records) ...

# queryingIn

{%s} Fetching the %s data from %s (%s: filtered records) ...

# queryingIn2

{%s} Fetching the %s data (filtered records) ...

# retrievingBinaryData

{%s} Fetching the binary data. Please wait for a while ...

# queryingSelfReferenceRecords

{%s} Fetching self-referencing records from %s ...

# queryingFinished

{%s} Data retrieval (%s) has been completed. Got %s new records.

# amountOfRetrievedRecordsByQueries

{%s} The total amount of the retrieved records from %s by %s queries: %s.

# targetNotQueriedInsert

{%s} %s was not queried since Insert operation is set.

# targetNotQueriedCsv

{%s} %s was not queried since csvfile is set as a TARGET.

# queryString

{%s} Query string: %s.

# fetchingSummary

===== DATA RETRIEVAL SUMMARY =====

# apiCallProgress

In progress... Completed %s records.

# updatingTarget

===== Updating the Target (%s) =====

# deletingTarget

===== Deleting from the Target (%s) =====

# updatePersonAccountsAndContacts

{%s} Updating person Accounts and Contacts ...

# amountOfRecordsTo

{%s} Amount of records to %s: %s.

# updatingTargetObjectCompleted

{%s} The Target has been updated. Totally processed %s records.

# updatingTargetCompleted

The Target (%s) has been updated. Totally processed %s records.

# writingToFile

{%s} Creating the file %s ...

# nothingUpdated

Nothing was updated.

# skippedUpdatesWarning

{%s} %s target records remained untouched, since they do not differ from the corresponding source records.

# skippedTargetRecordsFilterWarning

One 'targetRecordsFilter' could not be applied: %s.

# missingParentLookupsPrompt

{%s} %s missing parent lookup records were found. See %s file for the details.

# updatingSummary

===== DATA PROCESSING SUMMARY =====

# updatingTotallyUpdated

{%s} Totally processed %s records:

# updatingPassSummary

%s: Updated %s, Deleted %s, Inserted %s.

# updatingPassNone

%s: None.

# processingAddon

Triggering Add-On events ...

# runAddonMethod

{%s} Add-On event:%s has been triggered.

# nothingToProcess

No Add-On modules found to run.

# objectSetSkippedNoObjects

[WARNING] Object set %s has no objects to process after validation. Skipping.

# startAddonExecution

[%s] {%s} The Add-On module has started ...

# stopAddonExecution

[%s] {%s} The Add-On module has stopped.

# coreAddonMessageTemplate

[%s] {%s} %s.

# runAddonMethodCompleted

{%s} Add-On event:%s has been completed.

# writingToCacheFile

{%s} Writing to the cache file: %s.

# readingFromCacheFile

{%s} Reading from the cache file: %s.
