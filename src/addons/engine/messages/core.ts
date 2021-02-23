/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



export enum CORE_MESSAGES {
    // Common -------------------------------------
    Preparing = 'Preparing ...',
    Analysing = 'Analysing ...',
    RetrievedRecords = 'Retrieved %s records.',
    RecordsToBeProcessed = 'There are %s records to process.',
    ProcessedRecords = 'Total %s records have been processed, %s records failed.',
    TotalDataVolume = 'The total volume of the data to process: %s items of total %sMb.',
    DataWillBeProcessedInChunksOfSize = 'The processed data was splitted into %s chunks with max size of %sMb each chunk.',
    ProcessingChunk = "Processing chunk #%s of %s items.",

    // ExportFiles plugin -------------------------
    ExportFiles_TargetIsFileWarning = 'Cannot process Files on CSV targets. Set a salesforce org as a Target.',
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




}