/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import SfdmuRunAddonModule from "../../../components/sfdmu-run/sfdmuRunAddonModule";
import { SFDMU_RUN_ADDON_MESSAGES } from "../../../messages/sfdmuRunAddonMessages";
import { IRecordsFilter, IRecordsFilterArgs, IRecordsFilterSetting } from "./IRecordsFilter";

import * as fs from "fs";
import * as path from "path";


// Specific interfaces for this filter
interface IBadwordFilterSettings extends IRecordsFilterSetting {
  badwordsFile: string;
  detectFields: string[];
  highlightWords: boolean;
  outputMatches: boolean;
}

export interface BadwordFilterArgs extends IRecordsFilterArgs {
  settings: IBadwordFilterSettings;
}

// The filter implementation
export class BadWordsFilter implements IRecordsFilter {


  isInitialized: boolean;

  _args: BadwordFilterArgs;
  _module: SfdmuRunAddonModule;

  _detectFields: string[];
  _badwordsFile: string;
  _highlightWords: string | boolean;
  _outputMatches: boolean;

  _badwords: string[];
  _badwordsRegex: RegExp;
  _filteredNumber = 0;

  constructor(args: IRecordsFilterArgs, module: SfdmuRunAddonModule) {

    this._args = args as BadwordFilterArgs;
    this._module = module;

    // Checking required arguments
    var requiredArgs = [
      '',
      '.settings',
      '.settings.detectFields'];

    for (let prop of requiredArgs) {
      prop = `args${prop}`;
      if (!eval(`${prop}`)) {
        this._module.runtime.logFormattedError(this._module, SFDMU_RUN_ADDON_MESSAGES.General_MissingRequiredArguments, prop);
        return;
      }
    }

    // Locate the badword file
    this._args.settings.badwordsFile = this._args.settings.badwordsFile || "badwords.json";
    this._badwordsFile = path.isAbsolute(this._args.settings.badwordsFile) ? this._args.settings.badwordsFile // Absolute path provided -> as is
      : path.join(this._module.runtime.basePath, path.normalize(this._args.settings.badwordsFile)); // Relative to the base folder path -> resolving
    if (!fs.existsSync(this._badwordsFile)) {
      this._module.runtime.logFormattedError(this._module, SFDMU_RUN_ADDON_MESSAGES.BadwordFilter_badwordsDetectFileError);
      return;
    }

    // Build badwords regex (and complete with values without special characters)
    this._badwords = JSON.parse(fs.readFileSync(this._badwordsFile).toString()).badwords;
    for (const word of this._badwords) {
      const wordWithSpecialChars = word.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      if (!this._badwords.includes(wordWithSpecialChars)) {
        this._badwords.push(wordWithSpecialChars);
      }
    }
    const regexString = "\\b(" + this._badwords.join("|") + ")\\b";
    this._module.runtime.logFormattedInfoVerbose(this._module, SFDMU_RUN_ADDON_MESSAGES.BadwordFilter_badwordsDetectRegex, regexString);
    this._badwordsRegex = new RegExp(regexString, "gmi");
    this._detectFields = this._args.settings.detectFields;
    this._outputMatches = this._args.settings.outputMatches;
    this._highlightWords = this._args.settings.highlightWords;

    this.isInitialized = true;
  }

  async filterRecords(records: any[]): Promise<any[]> {
    this._module.runtime.logFormattedInfo(this._module,
      SFDMU_RUN_ADDON_MESSAGES.BadwordFilter_badwordsDetectStart,
      this._module.context.objectName,
      this._badwordsFile,
      this._detectFields.length > 0 ? this._detectFields.join(",") : "all fields");
    let filteredRecords = records.filter((record) => this._checkRecord(record));
    if (this._highlightWords) {
      const replacement = typeof this._highlightWords === 'string' ? this._highlightWords : `***$1***`;
      filteredRecords = filteredRecords.map((record) => this._highlightWordsInRecord(record, replacement));
    }
    this._module.runtime.logFormattedInfo(this._module,
      SFDMU_RUN_ADDON_MESSAGES.FilteringEnd,
      this._module.context.objectName,
      this._filteredNumber.toString());
    return filteredRecords;
  }


  // ------------ Helper methods ---------------------------------
  // Check if a record contains at least one of the bad words
  private _checkRecord(record: any) {
    const fieldsValues = this._getFieldsValues(record);
    // Check regex on each field value
    const found = [];
    for (const [field, value] of fieldsValues) {
      if (this._badwordsRegex.test(value)) {
        found.push([field, value]);
      }
    }
    // Manage check result
    if (found.length > 0) {
      if (this._outputMatches) {
        const foundStr = found.map(([field, value]) => `${field}: ${value}` + (value.includes("\n") ? "\n" : '')).join(",");
        this._module.runtime.logFormattedInfo(this._module,
          SFDMU_RUN_ADDON_MESSAGES.BadwordFilter_badwordsDetected, record.Name,
          foundStr);
      }
      return true;
    }
    this._filteredNumber++;
    return false
  }

  // Apply replacement regex on each matching regex element
  private _highlightWordsInRecord(record: any, replacement: string) {
    const fieldsValues = this._getFieldsValues(record);
    for (const [field, value] of fieldsValues) {
      if (typeof record[field] === 'string') {
        record[field] = value.replace(this._badwordsRegex, replacement);
      }
    }
    return record
  }

  private _getFieldsValues(record: any) {
    let fieldsValues = [];
    if (this._detectFields.length > 0) {
      // Return only fields includes in detectFields
      fieldsValues = Object.keys(record)
        .filter(field => this._detectFields.includes(field))
        .map(field => [field, record[field]]);
    }
    else {
      // Return all fields values
      fieldsValues = Object.keys(record).map(field => [field, record[field]]);
    }
    return fieldsValues;
  }








}
