import * as vscode from "vscode";

import { Editor, Modal } from "./modalEditor";
import { extensionName, getExtension } from "./extension";

const enterNormalId = `${extensionName}.enterNormal`;
const enterInsertId = `${extensionName}.enterInsert`;
const enterVisualId = `${extensionName}.enterVisual`;
const pasteId = `${extensionName}.paste`;

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

async function _paste(args?: { before?: boolean; }) {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let before = args?.before ?? false;
    let text = await vscode.env.clipboard.readText();
    let selections = editor.selections;
    let newSelections: vscode.Selection[] = [];

    let nlPos = text.indexOf("\n");
    if (nlPos === text.length - 1) {
        await editor.edit((builder) => {
            for (var selection of selections) {
                let curPos = selection.start;
                if (selection.isEmpty && before) {
                    let pos = new vscode.Position(curPos.line, 0);
                    builder.insert(pos, text);
                    newSelections.push(selection);
                } else if (selection.isEmpty && !before) {
                    let pos = new vscode.Position(curPos.line + 1, 0);
                    builder.insert(pos, text);
                    let newPos = new vscode.Position(curPos.line + 1, curPos.character);
                    newSelections.push(new vscode.Selection(newPos, newPos));
                } else {
                    builder.replace(selection, text);
                    let newPos = new vscode.Position(curPos.line, curPos.character + text.length);
                    newSelections.push(new vscode.Selection(newPos, newPos));
                }
            }
        });
        if (editor)
            editor.selections = newSelections;

    } else {
        await editor.edit((builder) => {
            for (var selection of selections) {
                if (selection.isEmpty) {
                    builder.insert(selection.anchor, text);
                } else {
                    builder.replace(selection, text);
                }
            }
        });
    }
}

function registerCommands() {
    vscode.commands.registerCommand(enterNormalId, _enterNormal);
    vscode.commands.registerCommand(enterInsertId, _enterInsert);
    vscode.commands.registerCommand(enterVisualId, _entervisual);
    vscode.commands.registerCommand(pasteId, _paste);
}

export {
    registerCommands
};
