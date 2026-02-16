# summary

Run a SFDMU migration job.

# description

Execute a data migration using export.json in the current directory or with --path.

# flags.sourceusername.summary

Source org username or alias (or csvfile).

# flags.sourceusername.description

Optionally specifies the username for the source Salesforce org. Overrides sourceUsername in export.json.
Use 'csvfile' to import from CSV files instead of a Salesforce org.

# flags.targetusername.summary

Target org username or alias (or csvfile).

# flags.targetusername.description

Specifies the username for the target Salesforce org or sets the target to CSV files. Overrides targetUsername in export.json.
Use 'csvfile' to export to CSV files instead of a Salesforce org.

# flags.path.summary

Directory containing export.json.

# flags.path.description

Defaults to the current working directory.

# flags.silent.summary

Suppress standard output.

# flags.silent.description

Suppress all stdout output, including final JSON output. Prompts auto-accept with default answers.

# flags.quiet.summary

Suppress standard output.

# flags.quiet.description

Suppress all stdout output, including final JSON output. Prompts auto-accept with default answers.

# flags.diagnostic.summary

Enable diagnostic file logging.

# flags.diagnostic.description

Writes diagnostic details to the .log file and forces file logging on.
Stdout output is unchanged.

# flags.verbose.summary

Legacy verbose flag (deprecated, no effect).

# flags.verbose.description

Deprecated. This flag has no effect and is kept only to support legacy command strings.

# flags.concise.summary

Legacy concise flag (deprecated, no effect).

# flags.concise.description

Deprecated. This flag has no effect and is kept only to support legacy command strings.

# flags.logfullquery.summary

Log full SOQL queries.

# flags.logfullquery.description

Log all selected fields in SOQL output instead of the shortened version.
SOQL output may still be truncated after FROM if it exceeds the length limit.

# flags.apiversion.summary

Override API version.

# flags.apiversion.description

Type: Float (as String).
Overrides apiVersion in export.json when provided. Example: '65.0'.

# flags.filelog.summary

Enable file logging.

# flags.filelog.description

Type: Number, 0 or 1, Default 0.
Use 0 to disable .log file output and 1 to enable. This suppresses .log output even when --json is used.
When --diagnostic is set, file logging is automatically enabled.

# flags.json.summary

Output JSON.

# flags.json.description

Type: Boolean, Default false.
Outputs a single JSON payload at the end of command execution and suppresses all other stdout output.
JSON is printed to stdout unless --quiet or --silent are set.
When --json is used, prompts are suppressed and default answers are applied.

# flags.noprompt.summary

Disable interactive prompts.

# flags.noprompt.description

Continue using default settings when prompts would normally appear (for example, missing lookup references).

# flags.nowarnings.summary

Suppress warning output.

# flags.nowarnings.description

Suppress warnings in stdout and JSON fullLog while still logging warnings to file when enabled.

# flags.canmodify.summary

Allow production modifications without confirmation.

# flags.canmodify.description

Provide the production org domain name to skip the confirmation prompt (for example, prod-instance.my.salesforce.com).
Ignored for non-production targets.

# flags.simulation.summary

Run in simulation mode.

# flags.simulation.description

Run the migration without making data changes; generate reports only.

# flags.loglevel.summary

Set log level.

# flags.loglevel.description

Type: String, Default TRACE.
Controls log output for stdout, .log files, and JSON payloads (content only; JSON output itself still appears unless quiet/silent).
TRACE logs everything, including stack traces for unhandled exceptions.
DEBUG is the same as INFO.
WARN logs only warning messages.
ERROR logs only exception messages without stack traces.
FATAL is the same as ERROR.
When loglevel is ERROR or FATAL, prompts are suppressed and default answers are applied.

# flags.usesf.summary

Legacy CLI switch (deprecated, no effect).

# flags.usesf.description

Deprecated. This flag has no effect and is kept only to support legacy command strings.

# flags.version.summary

Display version.

# flags.version.description

Show the installed plugin version.

# examples

- Run org to org:

  <%= config.bin %> <%= command.id %> --sourceusername source@example.com --targetusername target@example.com

- Import from CSV:

  <%= config.bin %> <%= command.id %> --sourceusername csvfile --targetusername target@example.com

- Export to CSV:

  <%= config.bin %> <%= command.id %> --sourceusername source@example.com --targetusername csvfile

# info.ready

SFDMU run command initialized. Migration engine wiring is pending.
