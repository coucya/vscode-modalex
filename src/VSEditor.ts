import * as vscode from 'vscode';

import {
    Keymap,
    Modal,
    ModalType,
    Editor,
    Action,
    FunctionAction,
    ParseKeymapConfigObj,
    deepCopy,
} from "./modalEditor";

import * as presetSimple from "./presets/simple";

const presets = {
    simple: presetSimple
};


type StyleTable = {
    [key in ModalType]: vscode.TextEditorCursorStyle
};

function toVSCodeCursorStyle(style: string): vscode.TextEditorCursorStyle {
    switch (style.toLowerCase()) {
        case "block": return vscode.TextEditorCursorStyle.Block;
        case "block-outline": return vscode.TextEditorCursorStyle.BlockOutline;
        case "line": return vscode.TextEditorCursorStyle.Line;
        case "line-thin": return vscode.TextEditorCursorStyle.LineThin;
        case "underline": return vscode.TextEditorCursorStyle.Underline;
        case "underline-thin": return vscode.TextEditorCursorStyle.UnderlineThin;
        default:
            throw new Error(`invalid cursor style: "${style}"`);
    }
}

class VSModalEditor extends Editor {
    _vsTextEditor: vscode.TextEditor;
    _styles: StyleTable;
    _oldCursorStyle: vscode.TextEditorCursorStyle | undefined;

    constructor(vsEditor: vscode.TextEditor) {
        super();

        this._vsTextEditor = vsEditor;
        this._oldCursorStyle = vsEditor.options.cursorStyle;
        this._styles = {
            [ModalType.normal]: vscode.TextEditorCursorStyle.Block,
            [ModalType.insert]: vscode.TextEditorCursorStyle.Line,
            [ModalType.visual]: vscode.TextEditorCursorStyle.LineThin,
        };


        this.addListener("enterMode", async () => await this._onEnterMode());
    }

    destroy() {
        this.removeAllListeners();
        this._vsTextEditor.options.cursorStyle = this._oldCursorStyle;
    }

    execCommand(command: string, ...args: any): Thenable<void> | void {
        vscode.commands.executeCommand(command, ...args);
    }
    async defaultTimeoutAction(keySeq: string[]) {
        let text = keySeq.join("");
        await vscode.commands.executeCommand('default:type', { text });
    }
    async insertTimeoutAction(keySeq: string[]) {
        let text = keySeq.join("");
        await vscode.commands.executeCommand('default:type', { text });
    }
    noramlTimeoutAction(keySeq: string[]): Thenable<void> | void { }
    visualTimeoutAction(keySeq: string[]): Thenable<void> | void { }

    getVSCodeTextEditor(): vscode.TextEditor {
        return this._vsTextEditor;
    }

    async _onEnterMode() {
        this.updateCursorStyle();
        if (this._currentModalType === ModalType.normal ||
            this._currentModalType === ModalType.insert) {
            await this._clearSelection();
        }
    }

    async _clearSelection() {
        await vscode.commands.executeCommand("cancelSelection");
    }

    setCursorStyle(styles: StyleTable) {
        this._styles = styles;
    }

    updateCursorStyle() {
        let style = this._styles[this.getCurrentModalType()];
        if (style)
            this._vsTextEditor.options.cursorStyle = style;
    }

    updateKeymaps(config: {
        normalKeymaps?: object,
        insertKeymaps?: object;
        visualKeymaps?: object;
    }) {
        let normalConfig = config.normalKeymaps ?? {};
        let insertConfig = config.insertKeymaps ?? {};
        let visualConfig = config.visualKeymaps ?? {};

        if (normalConfig) {
            let keymap = ParseKeymapConfigObj(normalConfig);
            this.getNormalModal().updateKeymap(keymap);
        }
        if (insertConfig) {
            let keymap = ParseKeymapConfigObj(insertConfig);
            this.getInsertModal().updateKeymap(keymap);
        }
        if (visualConfig) {
            let keymap = ParseKeymapConfigObj(visualConfig);
            this.getVisualModal().updateKeymap(keymap);
        }
    }

    updateKeymapsFromPreset(presetName: string) {
        if (presetName === "none")
            return;
        let preset: any = (presets as any)[presetName];
        if (preset)
            this.updateKeymaps(preset);
    }

    updateFromConfig(config: vscode.WorkspaceConfiguration) {
        let preset = config.get<string>("preset") ?? "none";
        let insertTimeout = config.get<number>("insertTimeout") ?? null;

        let normalKeymaps = config.get<object>("normalKeymaps");
        let insertKeymaps = config.get<object>("insertKeymaps");
        let visualKeymaps = config.get<object>("visualKeymaps");
        let normalCursorStyle = config.get<string>("normalCursorStyle") ?? "block";
        let insertCursorStyle = config.get<string>("insertCursorStyle") ?? "line";
        let visualCursorStyle = config.get<string>("visualCursorStyle") ?? "block";

        insertTimeout = insertTimeout && insertTimeout >= 0 ? insertTimeout : null;
        this.setInsertTimeout(insertTimeout);

        let styles = {
            [ModalType.normal]: toVSCodeCursorStyle(normalCursorStyle),
            [ModalType.insert]: toVSCodeCursorStyle(insertCursorStyle),
            [ModalType.visual]: toVSCodeCursorStyle(visualCursorStyle),
        };
        this.setCursorStyle(styles);

        this.clearKeymapsAll();
        this.updateKeymapsFromPreset(preset);
        this.updateKeymaps({ normalKeymaps, insertKeymaps, visualKeymaps });
    }
}

export {
    VSModalEditor
};