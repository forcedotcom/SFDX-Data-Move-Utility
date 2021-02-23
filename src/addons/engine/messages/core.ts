/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



export enum CORE_MESSAGES {
    Preparing = 'Preparing ...',
    Analysing = 'Analysing ...',
    
    ExportFiles_TargetIsFileWarning = 'Cannot process Files on CSV targets. Set a salesforce org as a Target.',
    ExportFiles_CouldNotFindObjectToProcessWarning = 'Could not find object data to process.',
    ExportFiles_ReadonlyOperationWarning = 'Cannot process Files on Readonly objects. Define another operation.',

    ExportFiles_ReadTargetContentDocumentLinks = 'Reading target ContentDocumentLink records ...',
    ExportFiles_DeleteTargetContentDocuments = 'Deleting target ContentDocument records ...',
    ExportFiles_NoSourceRecords = 'There are no source records found to process Files.',
    ExportFiles_ReadTargetContentVersions = 'Reading target ContentVersion records ...',
    ExportFiles_ReadSourceContentDocumentLinks = 'Reading source ContentDocumentLink records ...',
    ExportFiles_ReadSourceContentVersions = 'Reading source ContentVersion records ...',
    ExportFiles_ExportingContentVersions = 'Exporting ContentVersion binary data ...',


   
}