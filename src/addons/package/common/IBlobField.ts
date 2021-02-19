/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export default interface IBlobField {
    objectName: string,
    fieldName: string,

    /**
     * Currently there is only base64 data type,
     * but optionally another type can be added.
     */
    dataType: 'base64' // | ....
}
