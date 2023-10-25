import * as vscode from 'vscode';
import * as baseCommands from './commands/base';
import * as actionsCommands from './commands/actions';

import { initialize, enable, disable, } from "./extension";


export function activate(context: vscode.ExtensionContext) {
    initialize(context);

    baseCommands.registerCommands(context);
    actionsCommands.registerCommands(context);

    enable();
}

export function deactivate() {
    disable();
} 