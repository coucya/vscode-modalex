import * as vscode from "vscode";

import { Keymap } from "./modal/keymap";

export const extensionName = "modalex";
export const extensionDisplayName = "ModalEx";

export type Keymaps = {
    normal: Keymap,
    insert: Keymap,
    visual: Keymap,
};

export type ExtConfig = {
    preset: Keymaps | null,
    customKeymaps: Keymaps | null,
    keymaps: Keymaps,
    insertTimeout: number | null,
    normalCursorStyle: vscode.TextEditorCursorStyle;
    insertCursorStyle: vscode.TextEditorCursorStyle;
    visualCursorStyle: vscode.TextEditorCursorStyle;
    searchCursorStyle: vscode.TextEditorCursorStyle;
};
