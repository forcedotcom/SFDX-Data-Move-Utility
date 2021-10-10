/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



export enum SFDMU_RUN_ADDON_MESSAGES {

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
    ExportFiles_NothingToUpdate = "The target Files were deleted. There is no data to Update. Define another operation."




}