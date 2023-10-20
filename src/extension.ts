import * as vscode from 'vscode';
import { EventEmitter } from "events";

import * as commands from './commands/base';
import { VSModalEditor } from "./VSEditor";
import { extensionName, extensionDisplayName } from "./config";
import { ModalType, modalTypeToString } from './modalEditor';


let channel: vscode.OutputChannel | null = null;
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

class Extension extends EventEmitter {
    _statusBar: vscode.StatusBarItem;
    _editors: Map<vscode.TextEditor, VSModalEditor>;
    _curEditor: VSModalEditor | null;

    constructor() {
        super();
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._editors = new Map();
        this._curEditor = null;
    }

    destroy() {
        this._curEditor = null;
        for (var e of this._editors.values()) {
            e.destroy();
        }
        this._editors.clear();
    }

    async emitKeys(keys: string) {
        if (this._curEditor) {
            await this._curEditor.emitKeys(keys);
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
        return this._curEditor || undefined;
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

    updateStatusBarText(msg?: string) {
        if (this._curEditor) {
            let mode = modalTypeToString(this._curEditor.getCurrentModalType());
            let s: string;
            if (msg) {
                s = `-- ${mode.toUpperCase()} --: ${msg}`;
            } else {
                s = `-- ${mode.toUpperCase()} --`;
            }
            this._statusBar.text = s;
        } else {
            this._statusBar.text = "-- NO MODAL --";
        }
    }
    showStatusBar() {
        this._statusBar.show();
    }
    hideStatusBar() {
        this._statusBar.hide();
    }

    updateFromConfig() {
        const config = vscode.workspace.getConfiguration(extensionName);
        for (var editor of this._editors.values()) {
            editor.updateFromConfig(config);
        }
    }

    onNewEditor(editor: vscode.TextEditor) {
        let modalEditor = new VSModalEditor(editor);
        this._editors.set(editor, modalEditor);

        const config = vscode.workspace.getConfiguration(extensionName);
        modalEditor.updateFromConfig(config);
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


var extension: Extension | null = null;

function getExtension(): Extension {
    if (!extension)
        throw Error("extension not initialized");
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

function doDidChangeVisibleTextEditors(editors: readonly vscode.TextEditor[]) {
    if (!extension) return;

    let missing: vscode.TextEditor[] = extension.getMissingEditor(editors);
    let extra: vscode.TextEditor[] = extension.getExtraEditor(editors);

    for (let e of extra)
        extension.onCloseEditor(e);
    for (let e of missing)
        extension.onNewEditor(e);
}

function doDidChangeConfiguration(e: vscode.ConfigurationChangeEvent) {
    try {
        if (extension) extension.updateFromConfig();
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

    let isSelection = e.selections.some((s) => !s.isEmpty);
    let modalEditor = extension.getByVSCodeTextEditor(e.textEditor);
    let oldMode = modalEditor?.getCurrentModalType();

    if (isSelection) {
        if (!modalEditor?.isVisual()) {
            modalEditor?.enterMode(ModalType.visual);
        }
    } else {
        if (oldMode !== ModalType.normal && e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
            modalEditor?.enterMode(ModalType.normal);
        }
    }
}

function activate(context: vscode.ExtensionContext) {
    channel = vscode.window.createOutputChannel(extensionDisplayName);

    log("activate");

    extension = new Extension();

    context.subscriptions.push(
        channel,
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

}

function deactivate() {
    extension?.destroy();
    extension = null;

    log("deactivate.");
}

export {
    extensionName,
    activate,
    deactivate,
    log,
    logError,
    notify,
    notifyError,
    getExtension,
    Extension,
};