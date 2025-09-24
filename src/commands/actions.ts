import * as vscode from "vscode";

import { extensionName } from "../config";
import { getExtension } from "../extension";
import { ModalType } from "../modal/modal";

const commandPrefix = `${extensionName}.action`;

function eolToString(eol: vscode.EndOfLine): string {
    switch (eol) {
        case vscode.EndOfLine.LF:
            return "\n";
        case vscode.EndOfLine.CRLF:
            return "\r\n";
        default:
            return "\n";
    }
}

async function _yankLine() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let selection = editor.selection;
    let text = editor.document.lineAt(selection.start.line).text +
        eolToString(editor.document.eol);

    await vscode.env.clipboard.writeText(text);
}

async function _deleteAndYankLine() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let selection = editor.selection;
    let text = editor.document.lineAt(selection.start.line).text +
        eolToString(editor.document.eol);

    await Promise.all([
        editor.edit((builder) => {
            const range = editor.document.lineAt(selection.start.line).rangeIncludingLineBreak;
            builder.delete(range);
        }),
        vscode.env.clipboard.writeText(text)
    ]);
}

async function _paste(args?: { before?: boolean; enterNormal?: boolean; }) {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let before = args?.before ?? false;

    let text = await vscode.env.clipboard.readText();

    let documentLineCount = editor.document.lineCount;
    let selections = editor.selections;

    let eol = eolToString(editor.document.eol);

    text = text.replace(/\r?\n/g, eol)

    if (text.endsWith(eol)) {
        const documentLastLine = editor.document.lineAt(documentLineCount - 1);

        let newSelections: vscode.Selection[] = [];

        await editor.edit((builder) => {
            for (var selection of selections) {
                let curPos = selection.active;

                if (selection.isEmpty) {
                    if (before) {
                        let pos = new vscode.Position(curPos.line, 0);
                        builder.insert(pos, text);

                        newSelections.push(new vscode.Selection(curPos, curPos));
                    } else {
                        if (curPos.line >= documentLineCount - 1) {
                            let pos = documentLastLine.rangeIncludingLineBreak.end;
                            text = eol + text.slice(0, text.lastIndexOf(eol));
                            builder.insert(pos, text);
                        } else {
                            let pos = new vscode.Position(curPos.line + 1, 0);
                            builder.insert(pos, text);
                        }

                        let newPos = curPos.translate({ lineDelta: +1 });
                        newSelections.push(new vscode.Selection(newPos, newPos));
                    }
                } else {
                    builder.replace(selection, text);
                    let newPos = new vscode.Position(curPos.line, curPos.character + text.length);
                    newSelections.push(new vscode.Selection(newPos, newPos));
                }
            }
        });

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

    if (args?.enterNormal) {
        getExtension().getActiveEditor()?.enterMode(ModalType.normal);
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

function _cursorUpSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorUpSelect();
}
function _cursorDownSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorDownSelect();
}
function _cursorLeftSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorLeftSelect();
}
function _cursorRightSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorRightSelect();
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(`${commandPrefix}.paste`, _paste),
        vscode.commands.registerCommand(`${commandPrefix}.yankLine`, _yankLine),
        vscode.commands.registerCommand(`${commandPrefix}.deleteAndYankLine`, _deleteAndYankLine),
        vscode.commands.registerCommand(`${commandPrefix}.transformToUppercase`, () => _transformTo(true)),
        vscode.commands.registerCommand(`${commandPrefix}.transformToLowercase`, () => _transformTo(false)),
        vscode.commands.registerCommand(`${commandPrefix}.cursorUpSelect`, _cursorUpSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorDownSelect`, _cursorDownSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorLeftSelect`, _cursorLeftSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorRightSelect`, _cursorRightSelect)
    );
}


export {
    registerCommands
};
