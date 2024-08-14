import * as vscode from 'vscode';
import { EventEmitter } from "events";

import { ModalType } from './modal/modal';
import { Keymap } from './modal/keymap';
import { ParseKeymapConfigObj as parseKeymapObj } from './modal/parser';

import { extensionName, extensionDisplayName } from "./config";
import { ExtConfig } from "./config";

import * as presetSimple from "./presets/simple";

import { VSModalEditor } from "./VSEditor";


const presets = {
    simple: presetSimple
};

let channel: vscode.OutputChannel | null = null;
let _extension: Extension | null = null;

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

    let normalKeymapObj = p.normal;
    let insertKeymapObj = p.insert;
    let visualKeymapObj = p.visual;
    if (typeof normalKeymapObj !== "object")
        normalKeymapObj = {};
    if (typeof insertKeymapObj !== "object")
        insertKeymapObj = {};
    if (typeof visualKeymapObj !== "object")
        visualKeymapObj = {};

    let normal = parseKeymapObj(normalKeymapObj);
    let insert = parseKeymapObj(insertKeymapObj);
    let visual = parseKeymapObj(visualKeymapObj);

    return { normal, insert, visual };
}

function asPresetKeymaps(preset: string): {
    normal: Keymap,
    insert: Keymap,
    visual: Keymap,
} | null {
    if (preset === "none")
        return null;

    let p = (presets as any)[preset];
    if (!p)
        return null;

    let normalKeymapObj = p.normal;
    let insertKeymapObj = p.insert;
    let visualKeymapObj = p.visual;
    if (typeof normalKeymapObj !== "object")
        normalKeymapObj = {};
    if (typeof insertKeymapObj !== "object")
        insertKeymapObj = {};
    if (typeof visualKeymapObj !== "object")
        visualKeymapObj = {};

    let normal = parseKeymapObj(normalKeymapObj);
    let insert = parseKeymapObj(insertKeymapObj);
    let visual = parseKeymapObj(visualKeymapObj);

    return { normal, insert, visual };
}

async function asExtConfig(config: vscode.WorkspaceConfiguration): Promise<ExtConfig> {
    let preset = config.get<string>("preset") ?? "none";
    let insertTimeout = config.get<number>("insertTimeout") ?? null;

    let customKeymapsPath = config.get<string | null>("customKeymaps");

    let keymaps: any = config.get<object>("keymaps") ?? {};
    let normalKeymapObj = keymaps?.normal ?? {};
    let insertKeymapObj = keymaps?.insert ?? {};
    let visualKeymapObj = keymaps?.visual ?? {};
    let normalCursorStyle = config.get<string>("normalCursorStyle") ?? "block";
    let insertCursorStyle = config.get<string>("insertCursorStyle") ?? "line";
    let visualCursorStyle = config.get<string>("visualCursorStyle") ?? "block";
    let searchCursorStyle = config.get<string>("searchCursorStyle") ?? "underline";
    let normalKeymap = parseKeymapObj(normalKeymapObj);
    let insertKeymap = parseKeymapObj(insertKeymapObj);
    let visualKeymap = parseKeymapObj(visualKeymapObj);

    let presetKeymaps = asPresetKeymaps(preset);
    let customKeymaps = customKeymapsPath ? await loadCustomKeymaps(customKeymapsPath) : null;

    insertTimeout = insertTimeout && insertTimeout >= 0 ? insertTimeout : null;

    let setting: ExtConfig = {
        preset: presetKeymaps,
        customKeymaps,
        customKeymapsPath: customKeymapsPath ?? null,
        keymaps: {
            normal: normalKeymap,
            insert: insertKeymap,
            visual: visualKeymap,
        },
        insertTimeout,
        normalCursorStyle: toVSCodeCursorStyle(normalCursorStyle),
        insertCursorStyle: toVSCodeCursorStyle(insertCursorStyle),
        visualCursorStyle: toVSCodeCursorStyle(visualCursorStyle),
        searchCursorStyle: toVSCodeCursorStyle(searchCursorStyle),
    };

    return setting;
}

type CompositionState = {
    compositionText: string,
    isInComposition: boolean,
};

class Extension extends EventEmitter {
    _config: ExtConfig | null;
    _statusBar: vscode.StatusBarItem;
    _editors: Map<vscode.TextEditor, VSModalEditor>;
    _curEditor: VSModalEditor | null;

    compositionState: CompositionState;

    constructor() {
        super();

        this._config = null;
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._editors = new Map();
        this._curEditor = null;

        this.compositionState = {
            compositionText: "",
            isInComposition: false,
        };
    }

    destroy() {
        this._curEditor = null;
        this._statusBar.dispose();
        for (var e of this._editors.values())
            e.destroy();
        this._editors.clear();
    }

    getConfig(): ExtConfig {
        if (!this._config)
            throw new Error("config is not loaded yet");
        return this._config;
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

    isInInsertMode(): boolean {
        return this._curEditor?.getCurrentModal()?.getName() === "insert";
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
            if (msg)
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
        editor.updateKeymaps(config.keymaps);
    }

    async updateConfig() {
        await this._updateConfig();
        for (var editor of this._editors.values())
            this._updateEditorConfig(editor);
    }

    attach(editor: vscode.TextEditor) {
        let modalEditor = new VSModalEditor(editor);
        this._editors.set(editor, modalEditor);

        this._updateEditorConfig(modalEditor);

        modalEditor.enterMode("normal");
        modalEditor.addListener("enterMode", (mode: string) => this.updateStatusBarText());

        return modalEditor;
    }

    detach(editor: vscode.TextEditor) {
        let me = this._editors.get(editor);
        if (me) {
            me.destroy();
            this._editors.delete(editor);
        }
    }

    activeEditor(editor: vscode.TextEditor) {
        if (!this.exist(editor))
            this.attach(editor);
        this.setCurrentEditor(editor);
    }

    updateVisibleEditors(editors: readonly vscode.TextEditor[]) {
        let noExist = [];
        if (editors.length < 5) {
            for (let vsEditor of this._editors.keys()) {
                if (!editors.includes(vsEditor))
                    noExist.push(vsEditor);
            }
        } else {
            let editorSet = new Set(editors);
            for (let vsEditor of this._editors.keys()) {
                if (!editorSet.has(vsEditor))
                    noExist.push(vsEditor);
            }
        }

        for (let vsEditor of editors) {
            if (!this._editors.has(vsEditor)) {
                this.attach(vsEditor);
            }
        }

        for (let vsEditor of noExist) {
            this.detach(vsEditor);
        }
    }
}

function getExtension(): Extension {
    if (!_extension)
        throw Error("ModalEx extension not enabled");
    return _extension;
}

async function onType(args: { text: string; }) {
    try {
        let extension = getExtension();

        if (extension.compositionState.isInComposition) {
            extension.compositionState.compositionText += args.text;
            vscode.commands.executeCommand("default:type", args);
        } else {
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

async function onReplacePreviousChar(args: { text: string; replaceCharCnt: number; }) {
    let extension = getExtension();
    let cs = extension.compositionState;

    let oldCompositionText = cs.compositionText;
    let newCompositionText = oldCompositionText.slice(0, -args.replaceCharCnt) + args.text;
    cs.compositionText = newCompositionText;

    await vscode.commands.executeCommand("default:replacePreviousChar", args);
}

async function onCompositionStart() {
    let extension = getExtension();
    extension.compositionState.isInComposition = true;
    extension.compositionState.compositionText = "";
}

async function onCompositionEnd() {
    let extension = getExtension();

    let cs = extension.compositionState;
    let compositionText = cs.compositionText;

    cs.isInComposition = false;
    cs.compositionText = "";

    try {
        await vscode.commands.executeCommand("replacePreviousChar", {
            text: "",
            replaceCharCnt: compositionText.length
        });

        await extension.emitKeys(compositionText);
    } catch (e) {
        if (e instanceof Error) {
            notifyError(e.message);
            logError(e.message);
        } else {
            notifyError(`error processing key "${compositionText}"`);
            logError(`unknown error when processing key "${compositionText}"`);
        }
    }
}

function handleDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
    let extension = getExtension();
    if (e) {
        extension.activeEditor(e);
    } else if (!e && vscode.window.visibleTextEditors.length === 0) {
        extension.setCurrentEditor(null);
    }
}

async function handleDidChangeVisibleTextEditors(editors: readonly vscode.TextEditor[]) {
    let extension = getExtension();
    extension.updateVisibleEditors(editors);
}

function handleDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    try {
        let extension = getExtension();
        extension.updateConfig();
        log("configuration updated.");
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

function handleDidChangeTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    if (e.textEditor.document.uri.scheme === "output")
        return;

    let extension = getExtension();

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
    if (_extension)
        return;

    _extension = new Extension();

    subscriptions.push(
        vscode.commands.registerCommand("type", onType),
        vscode.commands.registerCommand("replacePreviousChar", onReplacePreviousChar),
        vscode.commands.registerCommand("compositionStart", onCompositionStart),
        vscode.commands.registerCommand("compositionEnd", onCompositionEnd),
        vscode.workspace.onDidChangeConfiguration(handleDidChangeConfiguration),
        vscode.window.onDidChangeActiveTextEditor(handleDidChangeActiveTextEditor),
        vscode.window.onDidChangeVisibleTextEditors(handleDidChangeVisibleTextEditors),
        vscode.window.onDidChangeTextEditorSelection(handleDidChangeTextEditorSelection),
    );

    for (var e of vscode.window.visibleTextEditors)
        _extension.attach(e);
    handleDidChangeActiveTextEditor(vscode.window.activeTextEditor);

    _extension.showStatusBar();

    vscode.commands.executeCommand("setContext", `${extensionName}.isEnable`, true);

    log("ModalEx enable");
}

function disable() {
    vscode.commands.executeCommand("setContext", `${extensionName}.isEnable`, false);

    _extension?.destroy();
    _extension = null;

    for (var d of subscriptions)
        d.dispose();
    subscriptions = [];

    log("ModalEx disable");
}

function reloadConfig() {
    _extension?.updateConfig().then(() => {
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