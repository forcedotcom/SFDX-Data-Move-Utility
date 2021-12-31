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
}

export interface BadwordFilterArgs extends IRecordsFilterArgs {
  settings: IBadwordFilterSettings;
}

// The filter implementation
export class BadWordsFilter implements IRecordsFilter {

  _args: BadwordFilterArgs;
  _module: SfdmuRunAddonModule;

  //protected task: MigrationJobTask;
  protected detectFields: string[];
  protected badwordsFile: string;
  protected highlightWords: string | boolean;
  protected outputMatches: boolean;

  protected badwords: string[];
  protected badwordsRegex: RegExp;
  protected filteredNumber = 0;



  isInitialized: boolean;

  constructor(args: BadwordFilterArgs, module: SfdmuRunAddonModule) {

    this._args = args;
    this._module = module;

    // Checking required arguments
    var requiredArgs = [
      '',
      '.settings',
      '.settings.detectFields'];

    for (let prop of requiredArgs) {
      prop = `args${prop}`;
      if (!eval(`${prop}`)) {
        this._module.runtime.logFormattedWarning(this._module, SFDMU_RUN_ADDON_MESSAGES.General_MissingRequiredArguments, prop);
        return;
      }
    }

    this._args.settings.badwordsFile = this._args.settings.badwordsFile || "badword.json";

    // Get badwords file
    this.badwordsFile = path.isAbsolute(this._args.settings.badwordsFile) ? this._args.settings.badwordsFile // Absolute path provided -> as is
                        : path.join(this._module.runtime.basePath, path.normalize(this._args.settings.badwordsFile)); // Relative to the base folder path -> resolving
    if (!fs.existsSync(this.badwordsFile)) {
      this._module.runtime.logFormattedWarning(this._module, SFDMU_RUN_ADDON_MESSAGES.BadwordFilter_badwordsDetectFileError);
      return;
    }


    // // Build badwords regex (and complete with values without special characters)
    // this.badwords = JSON.parse(fs.readFileSync(this.badwordsFile).toString());
    // for (const word of this.badwords) {
    //   const wordWithSpecialChars = word.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    //   if (!this.badwords.includes(wordWithSpecialChars)) {
    //     this.badwords.push(wordWithSpecialChars);
    //   }
    // }
    // const regexString = "\\b(" + this.badwords.join("|") + ")\\b";
    // this.task.logger.infoVerbose(RESOURCES.badwordsDetectRegex, regexString);
    // this.badwordsRegex = new RegExp(regexString, "gmi");


  }

  async filterRecords(records: any[]): Promise<any[]> {
    throw new Error("Method not implemented.");
  }








}
