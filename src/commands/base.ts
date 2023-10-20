import * as vscode from "vscode";

import { extensionName, getExtension } from "../extension";
import { ModalType, SearchDirection, SearchRange, VisualType } from "../modalEditor";

const enterNormalId = `${extensionName}.enterNormal`;
const enterInsertId = `${extensionName}.enterInsert`;
const enterVisualId = `${extensionName}.enterVisual`;
const enterVisualLineId = `${extensionName}.enterVisualLine`;
const enterVisualBlockId = `${extensionName}.enterVisualBlock`;
const enterSearchLineBeforeId = `${extensionName}.enterSearchLineBefore`;
const enterSearchLineAfterId = `${extensionName}.enterSearchLineAfter`;

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
    if (editor) {
        editor.clearSelection();
        editor.enterMode(ModalType.normal);
    }
}
function _enterInsert(option?: { right: boolean; }) {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.insert);
        if (option?.right && !isAtLineEnd())
            vscode.commands.executeCommand("cursorRight");
    }
}
function _enterVisual() {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.visual);
    }
}
function _enterVisualLine() {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.visual, { visualType: VisualType.line });
    }
}
function _enterVisualBlock() {
    let editor = getExtension().getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.visual, { visualType: VisualType.block });
    }
}
function _enterSearchLineBefore() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();

    if (editor) {
        editor.enterMode(ModalType.search, { searchRange: SearchRange.line, searchDirection: SearchDirection.before });
    }
}
function _enterSearchLineAfter() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();

    if (editor) {
        editor.enterMode(ModalType.search, { searchRange: SearchRange.line, searchDirection: SearchDirection.after });
    }
}

function _searchClear() {
    // getExtension().searchTextClear();
}
function _searchAppend() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (!editor)
        return;
    let keys = editor.getCurrentKeySeq().join("");
    // getExtension().searchTextAppend(keys);
}
function _searchNext() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (!editor)
        return;

    let text = ext.getSearchText();
    if (!text || text === "")
        return;

    let nextPos = editor.nextMatchFromCursor(text);
    if (!nextPos)
        return;
    let vsEditor = editor.getVSCodeTextEditor();
    vsEditor.selection = new vscode.Selection(nextPos, nextPos);
    vsEditor.revealRange(vsEditor.selection);
}
function _searchPrev() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (!editor)
        return;

    let text = ext.getSearchText();
    if (!text || text === "")
        return;

    let nextPos = editor.prevMatchFromCursor(text);
    if (!nextPos)
        return;
    let vsEditor = editor.getVSCodeTextEditor();
    vsEditor.selection = new vscode.Selection(nextPos, nextPos);
    vsEditor.revealRange(vsEditor.selection);
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(enterNormalId, _enterNormal),
        vscode.commands.registerCommand(enterInsertId, _enterInsert),
        vscode.commands.registerCommand(enterVisualId, _enterVisual),
        vscode.commands.registerCommand(enterVisualLineId, _enterVisualLine),
        vscode.commands.registerCommand(enterVisualBlockId, _enterVisualBlock),
        vscode.commands.registerCommand(enterSearchLineBeforeId, _enterSearchLineBefore),
        vscode.commands.registerCommand(enterSearchLineAfterId, _enterSearchLineAfter),
        vscode.commands.registerCommand(`${extensionName}.searchClear`, _searchClear),
        vscode.commands.registerCommand(`${extensionName}.searchAppend`, _searchAppend),
        vscode.commands.registerCommand(`${extensionName}.searchNext`, _searchNext),
        vscode.commands.registerCommand(`${extensionName}.searchPrev`, _searchPrev),
    );
}

export {
    registerCommands
};
