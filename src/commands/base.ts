import * as vscode from "vscode";

import { extensionName, getExtension } from "../extension";

const enterNormalId = `${extensionName}.enterNormal`;
const enterInsertId = `${extensionName}.enterInsert`;
const enterVisualId = `${extensionName}.enterVisual`;

function isAtLineEnd(): boolean {
    let editor = vscode.window.activeTextEditor;
    if (editor) {
        let selection = editor.selection;
        let line = editor.document.lineAt(selection.end.line);
        return selection.end.character === line.text.length;
    } else {
        return false;
    }
}

function subStringCount(str: string, sub: string): number {
    let n = 0;
    let it = 0;
    while ((it = str.indexOf(sub, it)) >= 0)
        n++;
    return n;
}


function _enterNormal() {
    let editor = getExtension().getCurrentEditor();
    if (editor)
        editor.enterMode("normal");
}
function _enterInsert(option?: { right: boolean; }) {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode("insert");
        if (option?.right && !isAtLineEnd())
            vscode.commands.executeCommand("cursorRight");
    }
}
function _entervisual() {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode("visual");
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(enterNormalId, _enterNormal),
        vscode.commands.registerCommand(enterInsertId, _enterInsert),
        vscode.commands.registerCommand(enterVisualId, _entervisual),
    );
}

export {
    registerCommands
};
