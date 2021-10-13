/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



/**
 * Errors in the Org metadata validation
 * 
 * @export
 * @class OrgMetadataError
 * @extends {Error}
 */
export class OrgMetadataError extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * Errors occur while the command is being initializating
 *
 * @export
 * @class CommandInitializationError
 * @extends {Error}
 */
export class CommandInitializationError extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * Errors during command execution
 *
 * @export
 * @class CommandExecutionError
 * @extends {Error}
 */
export class CommandExecutionError extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * Unresolvable warning
 *
 * @export
 * @class UnresolvableWarning
 * @extends {Error}
 */
export class UnresolvableWarning extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * User has stopped execution of the command
 *
 * @export
 * @class CommandAbortedByUserError
 * @extends {Error}
 */
export class CommandAbortedByUserError extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * Add-On module has stopped execution of the command
 *
 * @export
 * @class CommandAbortedByAddOnError
 * @extends {Error}
 */
 export class CommandAbortedByAddOnError extends Error {
    constructor(m: string) {
        super(m);
    }
}

/**
 * When thrown the command need to be aborted with success result
 *
 * @export
 * @class SuccessExit
 * @extends {Error}
 */
export class SuccessExit extends Error {
    constructor(m?: string) {
        super(m);
    }
}
