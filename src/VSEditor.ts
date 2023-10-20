import * as vscode from 'vscode';

import {
    Keymap,
    BaseModal,
    SearchModal,
    KeymapModal,
    ModalType,
    VisualType,
    SearchDirection,
    SearchRange,
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

enum CursorMoveDir {
    up = 1,
    down = 2,
    left = 3,
    right = 4,
}

function translatePos(pos: vscode.Position, x: number, y: number, maxWidth?: number): vscode.Position {
    let line = pos.line + y;
    let character = pos.character + x;
    line = line < 0 ? 0 : line;
    character = character < 0 ? 0 : (maxWidth && character > maxWidth ? maxWidth : character);
    return new vscode.Position(line, character);
}
function translate(selection: vscode.Selection, x: number, y: number, select: boolean = false, maxWidth?: number) {
    let anchor = select ? selection.anchor : translatePos(selection.anchor, x, y, maxWidth);
    let active = translatePos(selection.active, x, y, maxWidth);
    return new vscode.Selection(anchor, active);
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

class VSSearchModal extends SearchModal {
    constructor(name: string, editor: Editor) {
        super(name, editor);
    }

    override onConfirm(): void | Thenable<void> {
        let editor = this.getEditor() as VSModalEditor;
        editor.nextMatchFromCursor(this.getText(), this.getSearchRange() === SearchRange.line);
    }
}

class VSModalEditor extends Editor {
    _vsTextEditor: vscode.TextEditor;
    _styles: StyleTable;
    _oldCursorStyle: vscode.TextEditorCursorStyle | undefined;

    constructor(vsEditor: vscode.TextEditor) {
        super();

        async function execCommandCb(modal: KeymapModal, command: string, ...args: any) {
            await vscode.commands.executeCommand(command, ...args);
        }
        async function insertTextCb(modal: KeymapModal) {
            let text = modal.getCurrentKeySeq().join("");
            await vscode.commands.executeCommand('default:type', { text });
        }

        let searchModal = new VSSearchModal("search", this);
        let normalModal = new KeymapModal("normal", this, {
            onExecCommand: execCommandCb,
        });
        let visualModal = new KeymapModal("visual", this, {
            onExecCommand: execCommandCb,
        });
        let insertModal = new KeymapModal("insert", this, {
            onDefault: insertTextCb,
            onTimeout: insertTextCb,
            onExecCommand: execCommandCb,
        });
        this.setSearchModal(searchModal);
        this.setInsertModal(insertModal);
        this.setNormalModal(normalModal);
        this.setVisualModal(visualModal);

        this._vsTextEditor = vsEditor;
        this._oldCursorStyle = vsEditor.options.cursorStyle;
        this._styles = {
            [ModalType.normal]: vscode.TextEditorCursorStyle.Block,
            [ModalType.insert]: vscode.TextEditorCursorStyle.Line,
            [ModalType.visual]: vscode.TextEditorCursorStyle.LineThin,
            [ModalType.search]: vscode.TextEditorCursorStyle.Underline,
        };

        this.addListener("enterMode", async () => await this._onEnterMode());
    }

    destroy() {
        this.removeAllListeners();
        this._vsTextEditor.options.cursorStyle = this._oldCursorStyle;
    }

    override enterMode(modalType: string | ModalType, options?: {
        visualType?: VisualType | undefined;
        searchDirection?: SearchDirection | undefined;
        searchRange?: SearchRange | undefined;
    }): void {
        super.enterMode(modalType, options);
        // if (this.isNormal() || this.isInsert())
        //     this._clearSelection();
        if (!this.isVisual())
            this._visualBlockRange = null;
        if (this.isVisual(VisualType.block))
            this.setVisualBlockRange(this._vsTextEditor.selection);
        if (this.isVisual(VisualType.line)) {
            let base = this._lineAsSelection(this._vsTextEditor.selection.anchor.line);
            if (base) {
                this._vsTextEditor.selections = [base];
            }
        }

    }



    getVSCodeTextEditor(): vscode.TextEditor {
        return this._vsTextEditor;
    }

    async _onEnterMode() {
        this.updateCursorStyle();
        if (this._currentModalType === ModalType.normal ||
            this._currentModalType === ModalType.insert) {
            await this.clearSelection();
        }
    }

    async clearSelection() {
        let s = this._vsTextEditor.selection;
        let newSelections = [new vscode.Selection(s.anchor, s.anchor)];
        this._vsTextEditor.selections = newSelections;
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
        searchKeymaps?: object;
    }) {
        let normalConfig = config.normalKeymaps ?? {};
        let insertConfig = config.insertKeymaps ?? {};
        let visualConfig = config.visualKeymaps ?? {};
        // let searchConfig = config.searchKeymaps ?? {};


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
        // if (searchConfig) {
        // let keymap = ParseKeymapConfigObj(searchConfig);
        // this.getSearchModal().updateKeymap(keymap);
        // }
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
        let searchKeymaps = config.get<object>("searchKeymaps");
        let normalCursorStyle = config.get<string>("normalCursorStyle") ?? "block";
        let insertCursorStyle = config.get<string>("insertCursorStyle") ?? "line";
        let visualCursorStyle = config.get<string>("visualCursorStyle") ?? "block";
        let searchCursorStyle = config.get<string>("searchCursorStyle") ?? "underline";

        insertTimeout = insertTimeout && insertTimeout >= 0 ? insertTimeout : null;
        this.getInsertModal().setTimeout(insertTimeout);

        let styles = {
            [ModalType.normal]: toVSCodeCursorStyle(normalCursorStyle),
            [ModalType.insert]: toVSCodeCursorStyle(insertCursorStyle),
            [ModalType.visual]: toVSCodeCursorStyle(visualCursorStyle),
            [ModalType.search]: toVSCodeCursorStyle(searchCursorStyle),
        };
        this.setCursorStyle(styles);

        this.clearKeymapsAll();
        this.updateKeymapsFromPreset(preset);
        this.updateKeymaps({ normalKeymaps, insertKeymaps, visualKeymaps, searchKeymaps });
    }

    _visualBlockRange: { beg: number, end: number; } | null = null;
    setVisualBlockRange(beg: number | vscode.Range | vscode.Selection | null, end?: number) {
        if (typeof beg === "number")
            this._visualBlockRange = { beg, end: end ?? 0 };
        else if (beg && typeof beg === "object")
            this._visualBlockRange = { beg: beg.start.character, end: beg.end.character };
        else
            this._visualBlockRange = null;
        return this._visualBlockRange;
    }

    _rangeTo(range: vscode.Range) {
        return { beg: range.start.character, end: range.end.character };
    }

    _lineAsSelection(line: number): vscode.Selection | undefined {
        let document = this._vsTextEditor.document;
        if (line < 0 || line >= document.lineCount)
            return undefined;

        if (this._visualType === VisualType.block) {
            let bRange = this._visualBlockRange ? this._visualBlockRange : this._rangeTo(this._vsTextEditor.selection);
            let s = new vscode.Position(line, bRange.beg);
            let e = new vscode.Position(line, bRange.end);
            return new vscode.Selection(s, e);
        } else if (this._visualType === VisualType.line) {
            let range = document.lineAt(line).range;
            return new vscode.Selection(range.start, range.end);
        } else {
            return undefined;
        }
    }
    _widthOfLine(line: number): number | undefined {
        let document = this._vsTextEditor.document;
        if (line > document.lineCount)
            return undefined;
        let l = this._vsTextEditor.document.lineAt(line);
        return l.range.end.character;
    }

    _visualRange(): vscode.Range {
        let ranges = this._vsTextEditor.selections as readonly vscode.Range[];
        return ranges.reduce((a, b) => a.union(b));
    }
    _visualContainsLine(line: number): boolean {
        if (!this.isVisual())
            return false;
        return this._vsTextEditor.selections.some(a => line >= a.start.line && line <= a.end.line);
    }

    _cursorUp() {
        if (this._currentModalType === ModalType.normal || this._currentModalType === ModalType.insert) {
            vscode.commands.executeCommand("cursorUp");
        } else if (this.isVisual(VisualType.normal)) {
            vscode.commands.executeCommand("cursorUpSelect");
        } else if (this.isVisual(VisualType.line) || this.isVisual(VisualType.block)) {
            let selection = this._vsTextEditor.selection;
            let selections = this._vsTextEditor.selections;

            let nextLine = selection.anchor.line - 1;
            if (nextLine < 0)
                return;
            if (!this._visualContainsLine(nextLine)) {
                let newSelection = this._lineAsSelection(nextLine);
                let newSelections = newSelection ? [newSelection, ...selections] : selections;
                this._vsTextEditor.selections = newSelections;
            } else {
                let newSelections = selections.slice(1);
                this._vsTextEditor.selections = newSelections;
            };
        }
        this._vsTextEditor.revealRange(this._vsTextEditor.selection);
    }
    _cursorDown() {
        if (this._currentModalType === ModalType.normal || this._currentModalType === ModalType.insert) {
            vscode.commands.executeCommand("cursorDown");
        } else if (this.isVisual(VisualType.normal)) {
            vscode.commands.executeCommand("cursorDownSelect");
        } else if (this.isVisual(VisualType.line) || this.isVisual(VisualType.block)) {
            let selection = this._vsTextEditor.selection;
            let selections = this._vsTextEditor.selections;

            let nextLine = selection.anchor.line + 1;
            if (nextLine >= this._vsTextEditor.document.lineCount)
                return;
            if (!this._visualContainsLine(nextLine)) {
                let newSelection = this._lineAsSelection(nextLine);
                let newSelections = newSelection ? [newSelection, ...selections] : selections;
                this._vsTextEditor.selections = newSelections = newSelection ? [newSelection, ...selections] : selections;
                this._vsTextEditor.selections = newSelections;
            } else {
                let newSelections = selections.slice(1);
                this._vsTextEditor.selections = newSelections;
            };
        }
        this._vsTextEditor.revealRange(this._vsTextEditor.selection);
    }

    _cursorLeft() {
        if (this._currentModalType === ModalType.normal || this._currentModalType === ModalType.insert) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, -1, 0, false, this._widthOfLine(s.anchor.line));
            });
            this._vsTextEditor.selections = newSelections;
        } else if (this.isVisual(VisualType.normal)) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, -1, 0, true, this._widthOfLine(s.anchor.line));
            });
            this._vsTextEditor.selections = newSelections;
        } else if (this.isVisual(VisualType.line)) {
            // nothing
        } else if (this.isVisual(VisualType.block)) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, -1, 0, true);
            });
            this._vsTextEditor.selections = newSelections;
            let maxSelection = newSelections.reduce((a, b) => {
                if (a.end.character - a.start.character > b.end.character - b.start.character)
                    return a;
                else
                    return b;
            });
            this.setVisualBlockRange(maxSelection);
        }
    }

    _cursorRight() {
        if (this._currentModalType === ModalType.normal || this._currentModalType === ModalType.insert) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, 1, 0, false, this._widthOfLine(s.anchor.line));
            });
            this._vsTextEditor.selections = newSelections;
        } else if (this._currentModalType === ModalType.visual) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, 1, 0, true, this._widthOfLine(s.anchor.line));
            });
            this._vsTextEditor.selections = newSelections;
        } else if (this.isVisual(VisualType.line)) {
            // nothing
        } else if (this.isVisual(VisualType.block)) {
            let newSelections = this._vsTextEditor.selections.map((s) => {
                return translate(s, 1, 0, true);
            });
            this._vsTextEditor.selections = newSelections;
            let maxSelection = newSelections.reduce((a, b) => {
                if (a.end.character - a.start.character > b.end.character - b.start.character)
                    return a;
                else
                    return b;
            });
            this.setVisualBlockRange(maxSelection);
        }
    }

    cursorMove(direction: CursorMoveDir) {
        if (direction === CursorMoveDir.up) {
            this._cursorUp();
        } else if (direction === CursorMoveDir.down) {
            this._cursorDown();
        } else if (direction === CursorMoveDir.left) {
            this._cursorLeft();
        } else if (direction === CursorMoveDir.right) {
            this._cursorRight();
        }
    }

    onSelectionChange() {
    }

    _getLineRange(at: vscode.Position | number, after?: boolean) {
        let editor = this._vsTextEditor;
        let doc = editor.document;
        let lineNumber = typeof at === 'number' ? at : at.line;
        if (lineNumber >= doc.lineCount)
            return undefined;

        let lineRange = doc.lineAt(lineNumber).range;
        if (after === true && typeof at !== 'number') {
            return new vscode.Range(lineRange.start, at);
        } else if (after === false && typeof at !== 'number') {
            return new vscode.Range(at, lineRange.end);
        } else {
            return lineRange;
        }
    }

    _getDocumentRange(at?: vscode.Position, after: boolean = true) {
        let editor = this._vsTextEditor;
        let doc = editor.document;
        if (at && !after) {
            let start = new vscode.Position(0, 0);
            let end = at;
            return doc.validateRange(new vscode.Range(start, end));
        } else if (at && after) {
            let start = at;
            let end = doc.lineAt(doc.lineCount - 1).range.end;
            return doc.validateRange(new vscode.Range(start, end));
        } else {
            let start = new vscode.Position(0, 0);
            let end = new vscode.Position(doc.lineCount, 0);
            return doc.validateRange(new vscode.Range(start, end));
        }
    }

    _getSearchRange(searchRange: SearchRange, searchDirection: SearchDirection, incaludingCursor: boolean = true) {
        let editor = this._vsTextEditor;

        if (searchRange === SearchRange.line) {
            if (searchDirection === SearchDirection.before) {
                let at = editor.selection.active;
                return this._getLineRange(at, false);
            } else if (searchDirection === SearchDirection.after) {
                let at = incaludingCursor ? editor.selection.active : editor.selection.active.translate(0, 1);
                return this._getLineRange(at, true);
            } else if (searchDirection === SearchDirection.start || searchDirection === SearchDirection.reverse) {
                let line = editor.selection.active.line;
                return this._getLineRange(line);
            } else {
                return undefined;
            }
        } else if (searchRange === SearchRange.document) {
            if (searchDirection === SearchDirection.before) {
                let at = editor.selection.active;
                return this._getDocumentRange(at, false);
            } else if (searchDirection === SearchDirection.after) {
                let at = incaludingCursor ? editor.selection.active : editor.selection.active.translate(0, 1);
                return this._getDocumentRange(at, true);
            } else if (searchDirection === SearchDirection.start || searchDirection === SearchDirection.reverse) {
                return this._getDocumentRange();
            } else {
                return undefined;
            }
        } else {
            return undefined;
        }
    }

    _nextMatch(text: string, range: vscode.Range, reverse: boolean = false) {
        let doc = this._vsTextEditor.document;
        let searchRange = doc.validateRange(range);
        let docText = doc.getText(searchRange);
        let matchPos = !reverse ? docText.indexOf(text) : docText.lastIndexOf(text);
        if (matchPos < 0)
            return undefined;
        matchPos = doc.offsetAt(searchRange.start) + matchPos;
        return doc.positionAt(matchPos);
    }

    nextMatchFromCursor(text: string, line = false) {
        let searchRange = line ? SearchRange.line : SearchRange.document;
        let range = this._getSearchRange(searchRange, SearchDirection.after, false);
        if (!range)
            return undefined;
        return this._nextMatch(text, range);
    }
    prevMatch(text: string, line = false) {
        let searchRange = line ? SearchRange.line : SearchRange.document;
        let range = this._getSearchRange(searchRange, SearchDirection.before);
        if (!range)
            return undefined;
        return this._nextMatch(text, range, true);
    }
}

export {
    VSModalEditor,
    CursorMoveDir,
};