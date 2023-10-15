import * as vscode from "vscode";

import { extensionName, getExtension } from "../extension";
import { ModalType } from "../modalEditor";

const commandPrefix = `${extensionName}.action`;
const pasteId = `${commandPrefix}.paste`;
const transformToUppercaseId = `${commandPrefix}.transformToUppercase`;
const transformToLowercaseId = `${commandPrefix}.transformToLowercase`;
const cursorUpId = `${commandPrefix}.cursorUp`;
const cursorDownId = `${commandPrefix}.cursorDown`;

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

function _transformTo(upper: boolean) {
    let editor = vscode.window.activeTextEditor;
    if (editor) {
        let replaced: [vscode.Selection | vscode.Range, string][] = [];
        for (var selection of editor.selections) {
            let range: vscode.Range;
            let newText: string;
            if (selection.isEmpty) {
                let start = new vscode.Position(selection.start.line, selection.start.character);
                let end = new vscode.Position(selection.start.line, selection.start.character + 1);
                range = new vscode.Range(start, end);
            } else {
                range = new vscode.Range(selection.start, selection.end);
            }
            if (upper) {
                newText = editor.document.getText(range).toUpperCase();
            } else {
                newText = editor.document.getText(range).toLowerCase();
            }
            replaced.push([range, newText]);
        }
        editor.edit((builder) => {
            for (var [s, text] of replaced) {
                builder.replace(s, text);
            }
        });
    }
}

enum CursorMoveDir {
    up = 1,
    down = 2,
    left = 3,
    right = 4,
}

function translatePos(pos: vscode.Position, n: number): vscode.Position {
    if (pos.line + n < 0)
        return new vscode.Position(0, pos.character);
    else
        return new vscode.Position(pos.line + n, pos.character);
}
function translate(selection: vscode.Selection, n: number) {
    let anchor = translatePos(selection.anchor, n);
    let active = translatePos(selection.active, n);
    return new vscode.Selection(anchor, active);
}

function _cursorMove(direction: CursorMoveDir) {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (!editor)
        return;

    let vsEditor = editor.getVSCodeTextEditor();
    let modal = editor.getCurrentModal();

    if (direction == CursorMoveDir.up) {
        if (modal.getType() === ModalType.visual) {
            let newSelections = vsEditor.selections.map(s => translate(s, -1));
            vsEditor.selections = newSelections;
        } else {
            let newSelections = vsEditor.selections.map(s => translate(s, -1));
            vsEditor.selections = newSelections;
        }
    } else if (direction === CursorMoveDir.down) {
        if (modal.getType() === ModalType.visual) {
            let newSelections = vsEditor.selections.map(s => translate(s, 1));
            vsEditor.selections = newSelections;
        } else {
            let newSelections = vsEditor.selections.map(s => translate(s, 1));
            vsEditor.selections = newSelections;
        }
    }
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(pasteId, _paste),
        vscode.commands.registerCommand(transformToUppercaseId, () => _transformTo(true)),
        vscode.commands.registerCommand(transformToLowercaseId, () => _transformTo(false)),
        vscode.commands.registerCommand(cursorUpId, () => _cursorMove(CursorMoveDir.up)),
        vscode.commands.registerCommand(cursorDownId, () => _cursorMove(CursorMoveDir.down)),
    );
}


export {
    registerCommands
};
