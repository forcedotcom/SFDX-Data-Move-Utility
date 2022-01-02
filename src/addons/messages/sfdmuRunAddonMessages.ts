/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



export enum SFDMU_RUN_ADDON_MESSAGES {

  // Gneral -------------------------
 General_CheckingArgs = "Checking the args ...",
 General_EventNotSupported = "The event %s is not supported by the %s. Only %s event(s) supported. The Add-On execution has been aborted.",
 General_ArgumentsCannotBeParsed = "Error during parsing the Add-On arguments provided with the Script. The Add-On execution has been aborted.",
 General_AddOnRuntimeError = "Error occured during executing the Add-On module %s. Check the module source code (if it's a Custom Add-On Module) and the args passed.",
 General_MissingRequiredArguments = 'Missing required arguments: %s. Can not start the Add-on.',


 // ExportFiles Addon -------------------------
 ExportFiles_Preparing = 'Preparing ...',
 ExportFiles_Analysing = 'Analysing ...',
 ExportFiles_RetrievedRecords = 'Retrieved %s records.',
 ExportFiles_RecordsToBeProcessed = 'There are %s records to process.',
 ExportFiles_ProcessedRecords = 'Total %s records have been processed, %s records failed.',
 ExportFiles_TotalDataVolume = 'The total volume of the data to process: %s items of total %sMb.',
 ExportFiles_DataWillBeProcessedInChunksOfSize = 'The processed data was splitted into %s chunks with max size of %sMb each chunk.',
 ExportFiles_ProcessingChunk = "Processing chunk #%s of %s items.",

 ExportFiles_TargetIsFileWarning = 'Cannot process Files on CSV sources or targets. Set a salesforce org as the Source and the Target.',
 ExportFiles_CouldNotFindObjectToProcessWarning = 'Could not find object data to process.',
 ExportFiles_ReadonlyOperationWarning = 'Cannot process Files on Readonly objects. Define another operation.',

 ExportFiles_ReadTargetContentDocumentLinks = 'Retrieving target ContentDocumentLink records ...',
 ExportFiles_DeleteTargetContentDocuments = 'Deleting target ContentDocument records ...',
 ExportFiles_NoSourceRecords = 'There are no linked source records found to process.',
 ExportFiles_ReadTargetContentVersions = 'Retrieving target ContentVersion records ...',
 ExportFiles_ReadSourceContentDocumentLinks = 'Retrieving source ContentDocumentLink records ...',
 ExportFiles_ReadSourceContentVersions = 'Retrieving source ContentVersion records ...',
 ExportFiles_ExportingContentVersions = 'Transferring ContentVersion binary data ...',
 ExportFiles_ExportingContentDocumentLinks = 'Creating target ContentDocumentLink records ...',
 ExportFiles_NothingToProcess = "There is no data to export.",
 ExportFiles_NothingToUpdate = "The target Files were deleted. There is no data to Update. Define another operation.",


 // RecordsTransform Addon ----------------------
 RecordsTransform_SourceTaskNotFound = "[WARN] [Field %s]: The task associated with the sobject %s has not been found. The field will be skipped.",
 RecordsTransform_SourceFieldNotFound = "[WARN] [Field %s]: This field was not found in the source records of the sobject %s. The field will be skipped.",
 RecordsTransform_TargetFieldNotFound = "[WARN] [Field %s]: This field was not found in the target records of the sobject %s. The field will be skipped.",


 RecordsTransform_CreatingMappingScheme = "Creating the transformation map ...",
 RecordsTransform_Tranforming = "Transforming records ...",
 RecordsTransform_AppliedValueMapping = "Applying the Values Mapping",


 // RecordsFilter Addon -------------------------
 FilterUnknown = "Unknown filter %s",
 FilteringEnd= "%s records has been filtered (%s remaining)",
 FilterOperationError = "Error in the target RecordsFilter module %s: %s",

 // Badword filter *** 
 BadwordFilter_badwordsDetectStart= "Filtering results on badwords from file %s on %s...",
 BadwordFilter_badwordsDetectFileError= "Badwords file not found at location %s",
 BadwordFilter_badwordsDetectFileEmptyList= "Badwords file %s must contain a property \"badwords\" with at least one word",
 BadwordFilter_badwordsDetectRegex= "Full badwords detection regular expression %s",
 BadwordFilter_badwordsDetected= "- %s: %s",
}