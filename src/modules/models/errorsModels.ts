/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



/**
 * Errors in the Org metadata validation
 */
export class OrgMetadataError extends Error {
    constructor(m: string) {
        super(m);
    }
}


/**
 * Errors occur while the command is being initializating
 */
export class CommandInitializationError extends Error {
    constructor(m: string) {
        super(m);
    }
}



/**
 * Errors during command execution
 */
export class CommandExecutionError extends Error {
    constructor(m: string) {
        super(m);
    }
}


/**
 * Unresolvable warning => exit
 */
export class UnresolvableWarning extends Error {
    constructor(m: string) {
        super(m);
    }
}



/**
 * User has stopped execution of the command
 */
export class CommandAbortedByUserError extends Error {
    constructor(m: string) {
        super(m);
    }
}
