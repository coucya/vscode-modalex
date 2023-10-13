import * as vscode from 'vscode';

import {
    Keymap,
    Modal,
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
    normal: vscode.TextEditorCursorStyle,
    insert: vscode.TextEditorCursorStyle,
    visual: vscode.TextEditorCursorStyle,
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

async function execCommand(command: string, ...args: any[]) {
    await vscode.commands.executeCommand(command, ...args);
}

class VSModalEditor extends Editor {
    _vsTextEditor: vscode.TextEditor;
    _styles: StyleTable;
    _oldCursorStyle: vscode.TextEditorCursorStyle | undefined;
    _insertTimeout: number | null;
    _timeoutErrorCallback: (e?: any) => void;

    constructor(vsEditor: vscode.TextEditor, option?: {
        insertTimeout?: number,
        timeoutErrorCallback: (e?: any) => void;
    }) {
        super({
            execCommandCallback: execCommand,
        });

        this._vsTextEditor = vsEditor;
        this._oldCursorStyle = vsEditor.options.cursorStyle;
        this._styles = {
            normal: vscode.TextEditorCursorStyle.Block,
            insert: vscode.TextEditorCursorStyle.Line,
            visual: vscode.TextEditorCursorStyle.Block,
        };

        this._insertTimeout = option?.insertTimeout ?? null;
        this._timeoutErrorCallback = option?.timeoutErrorCallback ?? (() => { });

        this.addListener("enterMode", async (mode: string) => await this._onEnterMode(mode));
    }

    destroy() {
        this.removeAllListeners();
        this._vsTextEditor.options.cursorStyle = this._oldCursorStyle;
    }

    getVSCodeTextEditor(): vscode.TextEditor {
        return this._vsTextEditor;
    }

    getCurrentModal() {
        return super.getCurrentModal() as Modal;
    }

    async _onEnterMode(mode: string) {
        this.updateCursorStyle();
        if (mode === "normal" || mode === "insert") {
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
        let name = this.getCurrentModal()?.getName();
        if (name) {
            let style: vscode.TextEditorCursorStyle | undefined = (this._styles as any)[name];
            if (style)
                this._vsTextEditor.options.cursorStyle = style;
        }
    }

    resetKeymaps() {
        let _insertText = async (modal: Modal, keySeq: string[]) => {
            let text = keySeq.join("");
            await vscode.commands.executeCommand('default:type', { text });
        };

        let insertTextAction = new FunctionAction(_insertText);

        let insert = new Modal("insert", {
            defaultAction: insertTextAction,
            timeout: this._insertTimeout ?? undefined,
            timeoutAction: insertTextAction,
            timeoutErrorCallback: this._timeoutErrorCallback,
        });
        let normal = new Modal("normal");
        let visual = new Modal("visual");

        normal.setRootKeymap(new Keymap());
        insert.setRootKeymap(new Keymap());
        visual.setRootKeymap(new Keymap());

        this.removeAllModal();
        this.addModal(normal);
        this.addModal(insert);
        this.addModal(visual);
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
            this.getModal("normal")?.margeKeymap(keymap);
        }
        if (insertConfig) {
            let keymap = ParseKeymapConfigObj(insertConfig);
            this.getModal("insert")?.margeKeymap(keymap);
        }
        if (visualConfig) {
            let keymap = ParseKeymapConfigObj(visualConfig);
            this.getModal("visual")?.margeKeymap(keymap);
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
        let insertTimeout = config.get<number>("insertTimeout") ?? 0;

        let normalKeymaps = config.get<object>("normalKeymaps");
        let insertKeymaps = config.get<object>("insertKeymaps");
        let visualKeymaps = config.get<object>("visualKeymaps");
        let normalCursorStyle = config.get<string>("normalCursorStyle") ?? "block";
        let insertCursorStyle = config.get<string>("insertCursorStyle") ?? "line";
        let visualCursorStyle = config.get<string>("visualCursorStyle") ?? "block";

        this._insertTimeout = insertTimeout >= 0 ? insertTimeout : null;

        let styles = {
            normal: toVSCodeCursorStyle(normalCursorStyle),
            insert: toVSCodeCursorStyle(insertCursorStyle),
            visual: toVSCodeCursorStyle(visualCursorStyle),
        };
        this.setCursorStyle(styles);

        this.resetKeymaps();
        this.updateKeymapsFromPreset(preset);
        this.updateKeymaps({ normalKeymaps, insertKeymaps, visualKeymaps });
    }
}

export {
    VSModalEditor
};