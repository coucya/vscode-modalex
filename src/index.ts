import * as vscode from 'vscode';
import * as commands from './commands';

import {
    activate as extActivate,
    deactivate as extDeactivate,
} from "./extension";


export function activate(context: vscode.ExtensionContext) {
    commands.registerCommands();
    extActivate(context);
}

export function deactivate() {
    extDeactivate();
}