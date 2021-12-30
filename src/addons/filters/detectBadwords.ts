import * as fs from "fs";
import * as path from "path";
import { RESOURCES } from "../../modules/components/common_components/logger";
import { CommandExecutionError, MigrationJobTask } from "../../modules/models";

export class DetectBadwords {

  protected task: MigrationJobTask;
  protected detectFields: string[];
  protected badwordsFile: string;
  protected highlightWords: string|boolean ;
  protected outputMatches: boolean ;

  protected badwords: string[];
  protected badwordsRegex: RegExp;
  protected filteredNumber = 0 ;

  constructor(task: MigrationJobTask) {
    this.task = task ;
    this.detectFields = task.scriptObject?.targetRecordsFilterParams?.detectFields || [] ;
    this.outputMatches = task.scriptObject?.targetRecordsFilterParams?.outputMatches || false ;
    this.highlightWords = task.scriptObject?.targetRecordsFilterParams?.highlightWords || false ;

    // Get badwords file
    this.badwordsFile =
      task.scriptObject?.targetRecordsFilterParams?.badwordsFile && fs.existsSync(task.scriptObject?.targetRecordsFilterParams?.badwordsFile) ?
      task.scriptObject.targetRecordsFilterParams.badwordsFile :
      task.scriptObject?.targetRecordsFilterParams?.badwordsFile ?
      path.join(task.job.script.basePath, task.scriptObject.targetRecordsFilterParams.badwordsFile):
      path.join(task.job.script.basePath, "badwords.json");
    if (!fs.existsSync(this.badwordsFile)) {
      throw new CommandExecutionError(task.logger.getResourceString(RESOURCES.badwordsDetectFileError, this.badwordsFile));
    }

    // Build badwords regex (and complete with values without special characters)
    this.badwords = JSON.parse(fs.readFileSync(this.badwordsFile).toString());
    for (const word of this.badwords) {
      const wordWithSpecialChars = word.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      if (!this.badwords.includes(wordWithSpecialChars)) {
        this.badwords.push(wordWithSpecialChars);
      }
    }
    const regexString = "\\b(" + this.badwords.join("|") + ")\\b";
    this.task.logger.infoVerbose(RESOURCES.badwordsDetectRegex,regexString);
    this.badwordsRegex = new RegExp(regexString, "gmi");
  }

  // Main method to filter the records
  async filterRecords(records: any[]): Promise<any[]> {
    this.task.logger.infoNormal(RESOURCES.badwordsDetectStart,this.task.sObjectName, this.badwordsFile,
      this.detectFields.length > 0 ? this.detectFields.join(",") : "all fields");
    let filteredRecords= records.filter((record) => this.checkRecord(record));
    if (this.highlightWords) {
      const replacement = typeof this.highlightWords === 'string' ? this.highlightWords: `***$1***` ;
      filteredRecords = filteredRecords.map((record) => this.highlightWordsInRecord(record,replacement));
    }
    this.task.logger.infoNormal(RESOURCES.badwordsDetectEnd,this.task.sObjectName, this.filteredNumber.toString());
    return filteredRecords ;
  }

  // Check if a record contains at least one of the bad words
  checkRecord(record: any) {
    const fieldsValues = this.getFieldsValues(record);
    // Check regex on each field value
    const found = [];
    for (const [field,value] of fieldsValues) {
      if (this.badwordsRegex.test(value)) {
        found.push([field,value]) ;
      }
    }
    // Manage check result
    if (found.length > 0) {
      if (this.outputMatches){
        const foundStr = found.map(([field,value]) => `${field}: ${value}`+(value.includes("\n")?"\n":'')).join(",");
        this.task.logger.infoNormal(RESOURCES.badwordsDetected,record.Name,foundStr);
      }
      return true ;
    }
    this.filteredNumber++ ;
    return false
  }

  // Apply replacement regex on each matching regex element
  highlightWordsInRecord(record: any,replacement: string) {
    const fieldsValues = this.getFieldsValues(record);
    for (const [field,value] of fieldsValues) {
      if (typeof record[field] === 'string') {
        record[field] = value.replace(this.badwordsRegex,replacement);
      }
    }
    return record
  }

  getFieldsValues(record:any) {
    let fieldsValues = [];
    if (this.detectFields.length > 0) {
      // Return only fields includes in detectFields
      fieldsValues = Object.keys(record)
        .filter(field => this.detectFields.includes(field))
        .map(field => [field,record[field]]);
    }
    else {
      // Return all fields values
      fieldsValues = Object.keys(record).map(field => [field,record[field]]);
    }
    return fieldsValues;
  }
}
