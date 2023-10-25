import * as vscode from 'vscode';
import { EventEmitter } from "events";

import { ModalType } from './modal/modal';
import { Keymap } from './modal/keymap';
import { ParseKeymapConfigObj as parseKeymapConfigObj } from './modal/parser';

import { extensionName, extensionDisplayName } from "./config";
import { VSModalEditor } from "./VSEditor";

import * as presetSimple from "./presets/simple";

const presets = {
    simple: presetSimple
};

let channel: vscode.OutputChannel | null = null;
var extension: Extension | null = null;

function log(msg: string) {
    if (channel) channel.appendLine(`[ info] ${msg}`);
}
function logError(msg: string) {
    if (channel) channel.appendLine(`[error] ${msg}`);
}

async function notify(msg: string) {
    await vscode.window.showInformationMessage(msg);
}
async function notifyError(msg: string) {
    await vscode.window.showErrorMessage(msg);
}

function timeoutErrorHandle(e: any) {
    if (e instanceof Error) {
        logError(e.message);
        notifyError(e.message);
    } else {
        logError(`unknown error in timeoutAction`);
        notifyError("unknown error in timeoutAction");
    }
}

async function readFileAsString(path: string): Promise<string | undefined> {
    try {
        let uri = vscode.Uri.file(path);
        let data = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(data);
    } catch (e) {
        if (e instanceof vscode.FileSystemError) {
            return undefined;
        } else {
            throw e;
        }
    }
}

type ExtConfig = {
    preset: null | {
        normalKeymaps: Keymap,
        insertKeymaps: Keymap,
        visualKeymaps: Keymap,
    },
    customKeymaps: null | {
        normalKeymaps: Keymap,
        insertKeymaps: Keymap,
        visualKeymaps: Keymap,
    },
    normalKeymaps: Keymap,
    insertKeymaps: Keymap,
    visualKeymaps: Keymap,
    insertTimeout: number | null,
    normalCursorStyle: vscode.TextEditorCursorStyle;
    insertCursorStyle: vscode.TextEditorCursorStyle;
    visualCursorStyle: vscode.TextEditorCursorStyle;
    searchCursorStyle: vscode.TextEditorCursorStyle;
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

async function loadCustomKeymaps(path: string) {
    let keymapsString = await readFileAsString(path);
    if (!keymapsString)
        return null;
    let p = JSON.parse(keymapsString);

    if (!p)
        return null;

    let normalKeymapsObj = p.normalKeymaps;
    let insertKeymapsObj = p.insertKeymaps;
    let visualKeymapsObj = p.visualKeymaps;
    if (typeof normalKeymapsObj !== "object")
        normalKeymapsObj = {};
    if (typeof insertKeymapsObj !== "object")
        insertKeymapsObj = {};
    if (typeof visualKeymapsObj !== "object")
        visualKeymapsObj = {};

    let normalKeymaps = parseKeymapConfigObj(normalKeymapsObj);
    let insertKeymaps = parseKeymapConfigObj(insertKeymapsObj);
    let visualKeymaps = parseKeymapConfigObj(visualKeymapsObj);

    return { normalKeymaps, insertKeymaps, visualKeymaps };
}

function asPresetKeymaps(preset: string): {
    normalKeymaps: Keymap,
    insertKeymaps: Keymap,
    visualKeymaps: Keymap,
} | null {
    if (preset === "none")
        return null;

    let p = (presets as any)[preset];
    if (!p)
        return null;

    let normalKeymapsObj = p.normalKeymaps;
    let insertKeymapsObj = p.insertKeymaps;
    let visualKeymapsObj = p.visualKeymaps;
    if (typeof normalKeymapsObj !== "object")
        normalKeymapsObj = {};
    if (typeof insertKeymapsObj !== "object")
        insertKeymapsObj = {};
    if (typeof visualKeymapsObj !== "object")
        visualKeymapsObj = {};

    let normalKeymaps = parseKeymapConfigObj(normalKeymapsObj);
    let insertKeymaps = parseKeymapConfigObj(insertKeymapsObj);
    let visualKeymaps = parseKeymapConfigObj(visualKeymapsObj);

    return { normalKeymaps, insertKeymaps, visualKeymaps };
}

async function asExtConfig(config: vscode.WorkspaceConfiguration): Promise<ExtConfig> {
    let preset = config.get<string>("preset") ?? "none";
    let insertTimeout = config.get<number>("insertTimeout") ?? null;

    let customKeymapsPath = config.get<string | null>("customKeymaps");

    let normalKeymapsObj = config.get<object>("normalKeymaps") ?? {};
    let insertKeymapsObj = config.get<object>("insertKeymaps") ?? {};
    let visualKeymapsObj = config.get<object>("visualKeymaps") ?? {};
    let normalCursorStyle = config.get<string>("normalCursorStyle") ?? "block";
    let insertCursorStyle = config.get<string>("insertCursorStyle") ?? "line";
    let visualCursorStyle = config.get<string>("visualCursorStyle") ?? "block";
    let searchCursorStyle = config.get<string>("searchCursorStyle") ?? "underline";

    let normalKeymaps = parseKeymapConfigObj(normalKeymapsObj);
    let insertKeymaps = parseKeymapConfigObj(insertKeymapsObj);
    let visualKeymaps = parseKeymapConfigObj(visualKeymapsObj);

    let presetKeymaps = asPresetKeymaps(preset);
    let customKeymaps = customKeymapsPath ? await loadCustomKeymaps(customKeymapsPath) : null;

    insertTimeout = insertTimeout && insertTimeout >= 0 ? insertTimeout : null;

    let setting = {
        preset: presetKeymaps,
        customKeymaps,
        normalKeymaps,
        insertKeymaps,
        visualKeymaps,
        insertTimeout,
        normalCursorStyle: toVSCodeCursorStyle(normalCursorStyle),
        insertCursorStyle: toVSCodeCursorStyle(insertCursorStyle),
        visualCursorStyle: toVSCodeCursorStyle(visualCursorStyle),
        searchCursorStyle: toVSCodeCursorStyle(searchCursorStyle),
    };

    return setting;
}

class Extension extends EventEmitter {
    _config: ExtConfig | null;
    _statusBar: vscode.StatusBarItem;
    _editors: Map<vscode.TextEditor, VSModalEditor>;
    _curEditor: VSModalEditor | null;

    constructor() {
        super();

        this._config = null;
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._editors = new Map();
        this._curEditor = null;
    }

    destroy() {
        this._curEditor = null;

        this._statusBar.dispose();

        for (var e of this._editors.values())
            e.destroy();
        this._editors.clear();
    }

    async emitKeys(keys: string) {
        if (this._curEditor) {
            await this._curEditor.emitKeys(keys);
            this.updateStatusBarText();
        }
    }

    exist(editor: vscode.TextEditor | VSModalEditor): boolean {
        if (editor instanceof VSModalEditor) {
            for (var e of this._editors.values())
                if (e === editor) return true;
            return false;
        } else {
            return this._editors.has(editor);
        }
    }

    getByVSCodeTextEditor(e: vscode.TextEditor): VSModalEditor | undefined {
        return this._editors.get(e);
    }

    getExtraEditor(editors: readonly vscode.TextEditor[]) {
        let editorSet = new Set(editors);
        let extra = [];
        for (var e of this._editors.keys()) {
            if (!editorSet.has(e))
                extra.push(e);
        }
        editorSet.clear();
        return extra;
    }

    getMissingEditor(editors: readonly vscode.TextEditor[]) {
        return Array.from(editors.filter((e) => !this._editors.has(e)));
    }

    getCurrentEditor(): VSModalEditor | undefined {
        return this._curEditor ?? undefined;
    }
    setCurrentEditor(editor: vscode.TextEditor | VSModalEditor | null | undefined) {
        if (editor instanceof VSModalEditor) {
            this._curEditor = editor;
        } else if (editor) {
            this._curEditor = this._editors.get(editor) ?? null;
        } else {
            this._curEditor = null;
        }
        log(`setCurrentEditor: "${this._curEditor?.getVSCodeTextEditor().document.fileName ?? null}"`);
        this.updateStatusBarText();
    }

    getSearchText(): string {
        return this._curEditor?.getSearchModal().getText() ?? "";
    }

    _oldStatusBarText: string | null = null;
    updateStatusBarText() {
        let modal = this._curEditor?.getCurrentModal();
        if (modal) {
            let name = modal.getName().toUpperCase();
            let msg = modal.getModalMessage();
            let s: string;
            if (msg && msg !== "")
                s = `-- ${name} --: ${msg}`;
            else
                s = `-- ${name} --`;
            if (this._oldStatusBarText !== s) {
                this._oldStatusBarText = s;
                this._statusBar.text = s;
            }
        } else {
            this._oldStatusBarText = "-- NO MODAL --";
            this._statusBar.text = "-- NO MODAL --";
        }
    }
    showStatusBar() {
        this._statusBar.show();
    }
    hideStatusBar() {
        this._statusBar.hide();
    }

    async _updateConfig(): Promise<ExtConfig> {
        let vsConfig = vscode.workspace.getConfiguration(extensionName);
        this._config = await asExtConfig(vsConfig);
        return this._config;
    }

    async _updateEditorConfig(editor: VSModalEditor) {
        let config = this._config;
        if (!config)
            config = await this._updateConfig();

        let styles = {
            [ModalType.normal]: config.normalCursorStyle,
            [ModalType.insert]: config.insertCursorStyle,
            [ModalType.visual]: config.visualCursorStyle,
            [ModalType.search]: config.searchCursorStyle,
        };

        editor.getInsertModal().setTimeout(config.insertTimeout);
        editor.setCursorStyle(styles);
        editor.clearKeymapsAll();
        if (config.preset)
            editor.updateKeymaps(config.preset);
        if (config.customKeymaps)
            editor.updateKeymaps(config.customKeymaps);
        editor.updateKeymaps(config);
    }

    async updateConfig() {
        await this._updateConfig();
        for (var editor of this._editors.values())
            this._updateEditorConfig(editor);
    }

    async onNewEditor(editor: vscode.TextEditor) {
        let modalEditor = new VSModalEditor(editor);
        this._editors.set(editor, modalEditor);

        this._updateEditorConfig(modalEditor);

        modalEditor.enterMode("normal");
        modalEditor.addListener("enterMode", (mode: string) => this.updateStatusBarText());

        return modalEditor;
    }

    onCloseEditor(editor: vscode.TextEditor) {
        let me = this._editors.get(editor);
        if (me) {
            me.destroy();
            this._editors.delete(editor);
        }
    }
}

function getExtension(): Extension {
    if (!extension)
        throw Error("ModalEx extension not enabled");
    return extension;
}

async function onType(args: { text: string; }) {
    try {
        if (extension) {
            await extension.emitKeys(args.text);
        }
    } catch (e) {
        if (e instanceof Error) {
            notifyError(e.message);
            logError(e.message);
        } else {
            notifyError(`error processing key "${args.text}"`);
            logError(`unknown error when processing key "${args.text}"`);
        }
    }
}

function doDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
    if (e && extension) {
        if (!extension.exist(e)) {
            extension.onNewEditor(e);
        }
        extension.setCurrentEditor(e);
    } else if (!e && vscode.window.visibleTextEditors.length === 0) {
        extension?.setCurrentEditor(null);
    }
}

async function doDidChangeVisibleTextEditors(editors: readonly vscode.TextEditor[]) {
    if (!extension) return;

    let missing: vscode.TextEditor[] = extension.getMissingEditor(editors);
    let extra: vscode.TextEditor[] = extension.getExtraEditor(editors);

    for (let e of extra)
        await extension.onCloseEditor(e);
    for (let e of missing)
        await extension.onNewEditor(e);
}

function doDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    try {
        if (extension) extension.updateConfig();
    } catch (e) {
        if (e instanceof Error) {
            notifyError("error updating from configuration.\n" + e.message);
            logError(e.message);
        } else {
            notifyError("error updating from configuration");
            logError(`Unknown error when updating from configuration`);
        }
    }
}

function doDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    if (!extension) return;

    // log(`===== onDidChangeTextEditorSelection, kind ${e.kind} =====`);
    // log("e.selections:");
    // for (var s of e.selections) {
    //     log(`  Selection(${s.start.line}, ${s.start.character}, ${s.end.line}, ${s.end.character})`);
    // }
    // log("e.textEditor.selections:");
    // for (var s of e.textEditor.selections) {
    //     log(`  Selection(${s.start.line}, ${s.start.character}, ${s.end.line}, ${s.end.character})`);
    // }
    // log("===== end =====\n");

    let modalEditor = extension.getByVSCodeTextEditor(e.textEditor);
    modalEditor?.onSelectionChange(e.selections, e.kind);
}

function initialize(context: vscode.ExtensionContext) {
    channel = vscode.window.createOutputChannel(extensionDisplayName);
    context.subscriptions.push(channel);

    log("ModalEx Initialized");
}

let subscriptions: vscode.Disposable[] = [];
function enable() {
    if (extension)
        return;

    extension = new Extension();

    subscriptions.push(
        vscode.commands.registerCommand("type", onType),
        vscode.workspace.onDidChangeConfiguration(doDidChangeConfiguration),
        vscode.window.onDidChangeActiveTextEditor(doDidChangeActiveTextEditor),
        vscode.window.onDidChangeVisibleTextEditors(doDidChangeVisibleTextEditors),
        vscode.window.onDidChangeTextEditorSelection(doDidChangeTextEditorSelection),
    );

    for (var e of vscode.window.visibleTextEditors) {
        extension.onNewEditor(e);
    }
    doDidChangeActiveTextEditor(vscode.window.activeTextEditor);

    extension.showStatusBar();

    vscode.commands.executeCommand("setContext", `${extensionName}.isEnable`, true);

    log("ModalEx enable");
}

function disable() {
    vscode.commands.executeCommand("setContext", `${extensionName}.isEnable`, false);

    extension?.destroy();
    extension = null;

    for (var d of subscriptions)
        d.dispose();
    subscriptions = [];

    log("ModalEx disable");
}

function reloadConfig() {
    extension?.updateConfig().then(() => {
        log("reload config");
    });
}

export {
    initialize,
    enable,
    disable,
    reloadConfig,
    log,
    logError,
    notify,
    notifyError,
    getExtension,
    Extension,
};