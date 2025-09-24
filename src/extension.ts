import * as vscode from 'vscode';
import { EventEmitter } from "events";

import { ModalType } from './modal/modal';
import { Keymap } from './modal/keymap';
import { parseKeymapConfigObject, ParseKeymapError } from './modal/parser';

import { extensionName, extensionDisplayName } from "./config";
import { ExtConfig } from "./config";

import presets from "./presets";

import { CursorStyles, VSModalEditor } from "./VSEditor";
import { ExtensionError } from './error';


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

async function readFileAsString(path: string): Promise<string | undefined> {
    let uri = vscode.Uri.file(path);
    let data = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(data);
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
    try {
        let keymapsString = await readFileAsString(path);
        if (!keymapsString)
            return null;
        let p = JSON.parse(keymapsString);

        if (!p)
            return null;

        let normalKeymapObj = p.normal;
        let insertKeymapObj = p.insert;
        let visualKeymapObj = p.visual;
        if (!normalKeymapObj || typeof normalKeymapObj !== "object")
            normalKeymapObj = {};
        if (!insertKeymapObj || typeof insertKeymapObj !== "object")
            insertKeymapObj = {};
        if (!visualKeymapObj || typeof visualKeymapObj !== "object")
            visualKeymapObj = {};

        let normal = parseKeymapConfigObject(normalKeymapObj);
        let insert = parseKeymapConfigObject(insertKeymapObj);
        let visual = parseKeymapConfigObject(visualKeymapObj);

        return { normal, insert, visual };
    } catch (e) {
        if (e instanceof ParseKeymapError) {
            throw new ExtensionError(`error loading custom keymap, ${e.message}`, e);
        } else if (e instanceof vscode.FileSystemError) {
            throw new ExtensionError(`error loading custom keymap, ${e.message}`, e);
        } else {
            throw new ExtensionError(`error loading custom keymap`, e);
        }
    }
}

function loadPresetKeymaps(preset: string) {
    try {
        if (preset === "none")
            return null;

        let p = (presets as any)[preset];
        if (!p)
            return null;

        let normalKeymapObj = p.normal;
        let insertKeymapObj = p.insert;
        let visualKeymapObj = p.visual;
        if (!normalKeymapObj || typeof normalKeymapObj !== "object")
            normalKeymapObj = {};
        if (!insertKeymapObj || typeof insertKeymapObj !== "object")
            insertKeymapObj = {};
        if (!visualKeymapObj || typeof visualKeymapObj !== "object")
            visualKeymapObj = {};

        let normal = parseKeymapConfigObject(normalKeymapObj);
        let insert = parseKeymapConfigObject(insertKeymapObj);
        let visual = parseKeymapConfigObject(visualKeymapObj);

        return { normal, insert, visual };
    } catch (e) {
        if (e instanceof ParseKeymapError) {
            throw new ExtensionError(`error loading custom keymap, ${e.message}`, e);
        } else {
            throw new ExtensionError(`error loading custom keymap`, e);
        }
    }
}

async function vsConfigAsExtConfig(config: vscode.WorkspaceConfiguration): Promise<ExtConfig> {
    try {
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
        let normalKeymap = parseKeymapConfigObject(normalKeymapObj);
        let insertKeymap = parseKeymapConfigObject(insertKeymapObj);
        let visualKeymap = parseKeymapConfigObject(visualKeymapObj);

        let presetKeymaps = null;
        let customKeymaps = null;

        try {
            presetKeymaps = loadPresetKeymaps(preset);
        } catch (e) {
            if (e instanceof ExtensionError) {
                logError(e.message);
                notifyError(e.message);
            } else {
                logError(`unknown error when processing preset`);
                notifyError(`unknown error when processing preset`);
            }
        }

        try {
            customKeymaps = customKeymapsPath ? await loadCustomKeymaps(customKeymapsPath) : null;
        } catch (e) {
            if (e instanceof ExtensionError) {
                logError(e.message);
                notifyError(e.message);
            } else {
                logError(`unknown error when processing custom keymap`);
                notifyError(`unknown error when processing custom keymap`);
            }
        }

        let cursorStyles: CursorStyles = {
            [ModalType.normal]: toVSCodeCursorStyle(normalCursorStyle),
            [ModalType.insert]: toVSCodeCursorStyle(insertCursorStyle),
            [ModalType.visual]: toVSCodeCursorStyle(visualCursorStyle),
            [ModalType.search]: toVSCodeCursorStyle(searchCursorStyle),
        };

        let normalMargedKeymap: Keymap = new Keymap();
        let insertMargedKeymap: Keymap = new Keymap();
        let visualMargedKeymap: Keymap = new Keymap();
        if (presetKeymaps?.normal)
            normalMargedKeymap.marge(presetKeymaps.normal);
        if (customKeymaps?.normal)
            normalMargedKeymap.marge(customKeymaps.normal);
        normalMargedKeymap.marge(normalKeymap);
        if (presetKeymaps?.insert)
            insertMargedKeymap.marge(presetKeymaps.insert);
        if (customKeymaps?.insert)
            insertMargedKeymap.marge(customKeymaps.insert);
        insertMargedKeymap.marge(insertKeymap);
        if (presetKeymaps?.visual)
            visualMargedKeymap.marge(presetKeymaps.visual);
        if (customKeymaps?.visual)
            visualMargedKeymap.marge(customKeymaps.visual);
        visualMargedKeymap.marge(visualKeymap);

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
            margedKeymaps: {
                normal: normalMargedKeymap,
                insert: insertMargedKeymap,
                visual: visualMargedKeymap,
            },
            insertTimeout,
            normalCursorStyle: toVSCodeCursorStyle(normalCursorStyle),
            insertCursorStyle: toVSCodeCursorStyle(insertCursorStyle),
            visualCursorStyle: toVSCodeCursorStyle(visualCursorStyle),
            searchCursorStyle: toVSCodeCursorStyle(searchCursorStyle),
            cursorStyles,
        };

        return setting;
    } catch (e) {
        if (e instanceof ExtensionError) {
            throw e;
        } else {
            throw new ExtensionError("error loading config.", e);
        }
    }
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

    _oldStatusBarText: string | null;

    compositionState: CompositionState;

    constructor() {
        super();

        this._config = null;
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._editors = new Map();
        this._curEditor = null;
        this._oldStatusBarText = null;

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
            throw new ExtensionError("config is not loaded yet");
        return this._config;
    }

    async emitKeys(keys: string) {
        if (this._curEditor) {
            await this._curEditor.emitKeys(keys);
            this.updateStatusBarText();
        }
    }

    getByVSCodeTextEditor(e: vscode.TextEditor): VSModalEditor | null {
        return this._editors.get(e) ?? null;
    }

    getActiveEditor(): VSModalEditor | null {
        return this._curEditor;
    }
    setActiveEditor(editor: VSModalEditor) {
        if (!(editor instanceof VSModalEditor))
            throw new TypeError("editor must be VSModalEditor");
        this._curEditor = editor;
        this.updateStatusBarText();
    }
    clearActiveEditor() {
        this._curEditor = null;
        this.updateStatusBarText();
    }

    isInInsertMode(): boolean {
        return this._curEditor?.getCurrentModal()?.getName() === "insert";
    }

    getSearchText(): string {
        return this._curEditor?.getSearchModal().getText() ?? "";
    }

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

    _createEditorWithConfig(editor: vscode.TextEditor) {
        let config = this._config;
        if (!config)
            throw new ExtensionError("config is not loaded yet");

        let modalEditor = new VSModalEditor(
            editor,
            config.cursorStyles,
            config.insertTimeout ?? undefined,
        );
        modalEditor.updateKeymaps(config.margedKeymaps);
        return modalEditor;
    }

    _updateEditorWithConfig(editor: VSModalEditor) {
        let config = this._config;
        if (!config)
            throw new ExtensionError("config is not loaded yet");

        editor.getInsertModal().setTimeout(config.insertTimeout);
        editor.setCursorStyle(config.cursorStyles);
        editor.clearKeymapsAll();
        editor.updateKeymaps(config.margedKeymaps);
    }

    async _updateConfig(): Promise<ExtConfig> {
        let vsConfig = vscode.workspace.getConfiguration(extensionName);
        this._config = await vsConfigAsExtConfig(vsConfig);
        return this._config;
    }

    async updateConfig() {
        await this._updateConfig();
        for (var editor of this._editors.values())
            this._updateEditorWithConfig(editor);
    }

    hasAttachEditor(editor: vscode.TextEditor): boolean {
        return this._editors.has(editor);
    }

    attachEditor(editor: vscode.TextEditor): VSModalEditor {
        let modalEditor = this._createEditorWithConfig(editor);
        this._editors.set(editor, modalEditor);

        modalEditor.enterMode("normal");
        modalEditor.addListener("enterMode", (mode: string) => this.updateStatusBarText());

        return modalEditor;
    }

    detachEditor(editor: vscode.TextEditor) {
        let me = this._editors.get(editor);
        if (me) {
            me.destroy();
            this._editors.delete(editor);
        }
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
                this.attachEditor(vsEditor);
            }
        }

        for (let vsEditor of noExist) {
            this.detachEditor(vsEditor);
        }
    }
}

function getExtension(): Extension {
    if (!_extension)
        throw new ExtensionError("ModalEx not enabled");
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
        if (e instanceof ExtensionError) {
            logError(e.message);
            notifyError(e.message);
        } else if (e instanceof Error) {
            logError(e.message);
            notifyError(`unknown error when processing key "${args.text}"`);
        } else {
            logError(`unknown error when processing key "${args.text}"`);
            notifyError(`unknown error when processing key "${args.text}"`);
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
        if (e instanceof ExtensionError) {
            logError(e.message);
            notifyError(e.message);
        } else if (e instanceof Error) {
            logError(e.message);
            notifyError(`unknown error when processing key "${compositionText}"`);
        } else {
            logError(`unknown error when processing key "${compositionText}"`);
            notifyError(`unknown error when processing key "${compositionText}"`);
        }
    }
}

function handleDidChangeActiveTextEditor(e: vscode.TextEditor | undefined) {
    let extension = getExtension();
    if (e) {
        let editor = extension.getByVSCodeTextEditor(e);
        if (!editor)
            editor = extension.attachEditor(e);
        extension.setActiveEditor(editor);
    } else if (!e && vscode.window.visibleTextEditors.length === 0) {
        extension.clearActiveEditor();
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
        if (e instanceof ExtensionError) {
            logError(e.message);
            notifyError(e.message);
        } else if (e instanceof Error) {
            logError(e.message);
            notifyError("Unknown error updating from configuration");
        } else {
            logError(`Unknown error updating from configuration`);
            notifyError("Unknown error updating from configuration");
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
    _extension.updateConfig().then(() => {
        if (!_extension)
            return;

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
            _extension.attachEditor(e);

        if (vscode.window.activeTextEditor) {
            let editor = _extension.getByVSCodeTextEditor(vscode.window.activeTextEditor);
            _extension.setActiveEditor(editor!);
        }

        _extension.showStatusBar();

        vscode.commands.executeCommand("setContext", `${extensionName}.isEnable`, true);

        log("ModalEx enable");
    }).catch((e) => {
        if (e instanceof ExtensionError) {
            logError(e.message);
            notifyError(e.message);
        } else if (e instanceof Error) {
            logError(e.message);
            notifyError(`Error when enable extension.`);
        } else {
            logError(`Error when enable extension.`);
            notifyError(`Error when enable extension.`);
        }
    });
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