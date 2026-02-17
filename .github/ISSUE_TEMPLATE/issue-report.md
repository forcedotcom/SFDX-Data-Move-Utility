---
name: Issue Report
about: Report an issue with required diagnostic artifacts for investigation.
title: '[ISSUE] - Replace this placeholder with a short and specific title.'
labels: bug
assignees: hknokh
---

**Issue title**  
Use a short and specific title that clearly describes the problem.
-- Add your title here --

**Issue summary**  
Describe what failed, what operation you ran, and the exact error message.
-- Add your issue summary here --

**Steps to reproduce**  
List exact steps and command line used.
-- Add steps to reproduce here --

**Expected behavior**  
Describe what you expected to happen.
-- Add expected behavior here --

**Actual behavior**  
Describe what actually happened.
-- Add actual behavior here --

**Log file (required)**  
Before submitting this issue, run SFDMU with `--diagnostic --anonymise` to generate a shareable log file.  
Example command: `sf sfdmu run --sourceusername source@name.com --targetusername target@name.com --diagnostic --anonymise`  
Attach your full generated **.log** file from that run.  
If `--diagnostic` was not used or the full `.log` file is missing, **we cannot review this issue**.  
`--anonymise` is required before sharing logs to hash sensitive values.  
Reference (what is hashed and what is not): https://help.sfdmu.com/full-documentation/reports/the-execution-log#what-is-masked-and-what-is-not  
-- Add your log file here (attach the .log file or link to it) --

**\_target.csv file (if relevant)**  
If there are failed rows, attach a dump of the **\_target.csv** file with error messages (include at least 1-2 full relevant rows).  
Reference: https://help.sfdmu.com/full-documentation/reports/the-target-csv-files
-- Add your \_target.csv file here (attach the file or link to it) --
