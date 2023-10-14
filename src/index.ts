import * as vscode from 'vscode';
import * as baseCommands from './commands/base';
import * as actionsCommands from './commands/actions';

import {
    activate as extActivate,
    deactivate as extDeactivate,
} from "./extension";


export function activate(context: vscode.ExtensionContext) {
    baseCommands.registerCommands(context);
    actionsCommands.registerCommands(context);
    extActivate(context);
}

export function deactivate() {
    extDeactivate();
}