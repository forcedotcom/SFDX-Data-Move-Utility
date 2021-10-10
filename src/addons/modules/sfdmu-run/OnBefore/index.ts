/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import IAddonContext from "../../../components/common/IAddonContext";
import SfdmuRunAddonModule from "../../../components/sfdmu-run/sfdmuRunAddonModule";


export default class CoreOnBefore extends SfdmuRunAddonModule {

    async onExecute(context: IAddonContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here   
    }

}