import * as vscode from "vscode";

import { extensionName } from "../config";
import { getExtension, enable, disable, reloadConfig } from "../extension";
import { ModalType, SearchDirection, SearchRange, VisualType } from "../modal/modal";


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
        let vsEditor = editor.getVSCodeTextEditor();

        let newSelections = [];
        if (option?.right && editor.isNormal()) {
            for (var selection of vsEditor.selections) {
                let pos = selection.active;
                if (!editor.isAtLineEnd(selection))
                    pos = new vscode.Position(pos.line, pos.character + 1);
                let newSelection = new vscode.Selection(pos, pos);
                newSelections.push(newSelection);
            }
        } else if (option?.right) {
            for (var selection of vsEditor.selections) {
                let newSelection = new vscode.Selection(selection.end, selection.end);
                newSelections.push(newSelection);
            }
        } else {
            for (var selection of vsEditor.selections) {
                let newSelection = new vscode.Selection(selection.start, selection.start);
                newSelections.push(newSelection);
            }
        }

        editor.enterMode(ModalType.insert);
        vsEditor.selections = newSelections;
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


function _searchCharLineBefore() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.search, {
            searchRange: SearchRange.line,
            searchDirection: SearchDirection.before,
            singleChar: true,
        });
    }
}
function _searchCharLineAfter() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.search, {
            searchRange: SearchRange.line,
            searchDirection: SearchDirection.after,
            singleChar: true,
        });
    }
}

function _searchBefore() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.search, {
            searchRange: SearchRange.document,
            searchDirection: SearchDirection.before,
            singleChar: false,
        });
    }
}
function _searchAfter() {
    let ext = getExtension();
    let editor = ext.getCurrentEditor();
    if (editor) {
        editor.enterMode(ModalType.search, {
            searchRange: SearchRange.document,
            searchDirection: SearchDirection.after,
            singleChar: false,
        });
    }
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
        vscode.commands.registerCommand(`${extensionName}.enable`, enable),
        vscode.commands.registerCommand(`${extensionName}.disable`, disable),
        vscode.commands.registerCommand(`${extensionName}.reload`, reloadConfig),
        vscode.commands.registerCommand(`${extensionName}.enterNormal`, _enterNormal),
        vscode.commands.registerCommand(`${extensionName}.enterInsert`, _enterInsert),
        vscode.commands.registerCommand(`${extensionName}.enterVisual`, _enterVisual),
        vscode.commands.registerCommand(`${extensionName}.enterVisualLine`, _enterVisualLine),
        vscode.commands.registerCommand(`${extensionName}.enterVisualBlock`, _enterVisualBlock),
        vscode.commands.registerCommand(`${extensionName}.searchCharLineBefore`, _searchCharLineBefore),
        vscode.commands.registerCommand(`${extensionName}.searchCharLineAfter`, _searchCharLineAfter),
        vscode.commands.registerCommand(`${extensionName}.searchBefore`, _searchBefore),
        vscode.commands.registerCommand(`${extensionName}.searchAfter`, _searchAfter),
        vscode.commands.registerCommand(`${extensionName}.searchNext`, _searchNext),
        vscode.commands.registerCommand(`${extensionName}.searchPrev`, _searchPrev),
    );
}

export {
    registerCommands
};
