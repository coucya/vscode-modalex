import * as vscode from 'vscode';

import { SearchModal, KeymapModal, VisualModal } from "./modal/modal";
import { ModalType, VisualType, SearchDirection, SearchRange } from "./modal/modal";
import { Editor } from "./modal/editor";
import { Keymap } from './modal/keymap';

type CursorStyles = {
    [key in ModalType]: vscode.TextEditorCursorStyle
};

enum CursorMoveDir {
    up = 1,
    down = 2,
    left = 3,
    right = 4,
}

function selectionWidth(s: vscode.Selection) {
    return s.end.character - s.start.character;
}

function maxWidthSelection(selections: readonly vscode.Selection[]): vscode.Selection | undefined {
    let maxSelection = selections?.reduce((a, b) => {
        return selectionWidth(a) > selectionWidth(b) ? a : b;
    });
    return maxSelection;
}

function selectionToString(selection: vscode.Selection): string {
    return `${selection.anchor.line}:${selection.anchor.character} - ${selection.active.line}:${selection.active.character}`;
}

class VSNormalModal extends KeymapModal {
    constructor(editor: VSModalEditor) {
        super("normal", editor);
    }
    override async onExecCommand(command: string, ...args: any[]) {
        await vscode.commands.executeCommand(command, ...args);
    }
}

class VSInsertModal extends KeymapModal {
    constructor(editor: VSModalEditor) {
        super("insert", editor);
    }

    override async onWillEnter(options?: any) {
        let editor = this.getEditor() as VSModalEditor;
        let vsEditor = editor.getVSCodeTextEditor();

        let newSelections = [];
        if (editor.isNormal() && options?.right) {
            for (var selection of vsEditor.selections) {
                let pos = selection.active;
                if (!editor.isAtLineEnd(selection))
                    pos = new vscode.Position(pos.line, pos.character + 1);
                let newSelection = new vscode.Selection(pos, pos);
                newSelections.push(newSelection);
            }
        } else if (editor.isVisual()) {
            if (options?.right) {
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
        } else if (options?.right) {
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
        vsEditor.selections = newSelections;
    }

    override async onExecCommand(command: string, ...args: any[]) {
        await vscode.commands.executeCommand(command, ...args);
    }
    override async onTimeout() {
        let text = this.getCurrentKeySeq().join("");
        await vscode.commands.executeCommand('default:type', { text });
    }
    override async onDefault() {
        let text = this.getCurrentKeySeq().join("");
        await vscode.commands.executeCommand('default:type', { text });
    }
}

class VSSearchModal extends SearchModal {
    _oldModalType: ModalType = ModalType.normal;

    constructor(editor: Editor) {
        super("search", editor);
    }

    override async onExecCommand(command: string, ...args: any[]) {
        await vscode.commands.executeCommand(command, ...args);
    }

    override onWillEnter(option?: any): void | Thenable<void> {
        super.onWillEnter(option);
        this._oldModalType = this._editor.getCurrentModalType();
    }

    override onConfirm(): void | Thenable<void> {
        let editor = this.getEditor() as VSModalEditor;
        let dir = this.getSearchDirection();

        let nextCursor: vscode.Position | undefined;
        if (dir === SearchDirection.after) {
            nextCursor = editor.nextMatchFromCursor(this.getText(), this.getSearchRange() === SearchRange.line);
            if (this._oldModalType === ModalType.visual)
                nextCursor = nextCursor?.translate(0, 1);
        } else if (dir === SearchDirection.before) {
            nextCursor = editor.prevMatchFromCursor(this.getText(), this.getSearchRange() === SearchRange.line);
        } else {
            throw new Error(`implementation of SearchDirection(${dir}) has not been completed yet`);
            // TODO
        }
        setTimeout(() => {
            editor.enterMode(this._oldModalType);
            if (nextCursor) {
                editor.getVSCodeTextEditor().selection = new vscode.Selection(nextCursor, nextCursor);
            }
        }, 0);
    }
}

class VSVisualModal extends VisualModal {
    _anchorLine: number = 0;
    _activeLine: number = 0;
    _anchorChar: number = 0;
    _activeChar: number = 0;

    constructor(editor: Editor) {
        super("visual", editor);
    }

    override getEditor(): VSModalEditor {
        return this._editor as VSModalEditor;
    }

    override onWillEnter(option?: any) {
        super.onWillEnter(option);
        let editor = this.getEditor() as VSModalEditor;
        let selection = editor.getVSCodeTextEditor().selection;
        this._anchorLine = selection.anchor.line;
        this._activeLine = selection.active.line;
        this._anchorChar = selection.anchor.character;
        this._activeChar = selection.active.character;
    }

    override onDidEnter(): void | Thenable<void> {
        super.onDidEnter();
        let editor = this.getEditor() as VSModalEditor;
        if (this._visualType === VisualType.block) {
            this._updateSelections(editor, this._anchorChar, this._activeChar);
        } else if (this._visualType === VisualType.line) {
            this._updateSelections(editor);
        }
    }

    override async onExecCommand(command: string, ...args: any[]) {
        await vscode.commands.executeCommand(command, ...args);
    }

    _updateSelections(editor: VSModalEditor, anchorChar?: number, actionChar?: number) {
        let selections: vscode.Selection[] = [];
        if (this._activeLine >= this._anchorLine) {
            for (let i = this._activeLine; i >= this._anchorLine; i--) {
                let s = editor.getSelectionByLine(i, anchorChar, actionChar);
                s && selections.push(s);
            }
        } else {
            for (let i = this._activeLine; i <= this._anchorLine; i++) {
                let s = editor.getSelectionByLine(i, anchorChar, actionChar);
                s && selections.push(s);
            }
        }
        editor.getVSCodeTextEditor().selections = selections;
    }

    _visualLine_up(editor: VSModalEditor) {
        this._activeLine--;
        this._updateSelections(editor);
    }

    _visualLine_down(editor: VSModalEditor) {
        this._activeLine++;
        this._updateSelections(editor);
    }

    _visualBlock_up(editor: VSModalEditor) {
        this._activeLine--;
        this._updateSelections(editor, this._anchorChar, this._activeChar);
    }
    _visualBlock_down(editor: VSModalEditor) {
        this._activeLine++;
        this._updateSelections(editor, this._anchorChar, this._activeChar);
    }
    _visualBlock_left(editor: VSModalEditor) {
        this._activeChar--;
        this._updateSelections(editor, this._anchorChar, this._activeChar);
    }

    _visualBlock_right(editor: VSModalEditor) {
        this._activeChar++;
        this._updateSelections(editor, this._anchorChar, this._activeChar);
    }

    cursorUp() {
        let editor = this.getEditor();
        let vsEditor = editor.getVSCodeTextEditor();
        if (this.getVisualType() === VisualType.line) {
            this._visualLine_up(editor);
        } else if (this.getVisualType() === VisualType.block) {
            this._visualBlock_up(editor);
        } else {
            vscode.commands.executeCommand("cursorUpSelect");
        }
        vsEditor.revealRange(vsEditor.selection);
    }
    cursorDown() {
        let editor = this.getEditor();
        let vsEditor = editor.getVSCodeTextEditor();
        if (this.getVisualType() === VisualType.line) {
            this._visualLine_down(editor);
        } else if (this.getVisualType() === VisualType.block) {
            this._visualBlock_down(editor);
        } else {
            vscode.commands.executeCommand("cursorDownSelect");
        }
        vsEditor.revealRange(vsEditor.selection);
    }
    cursorLeft() {
        let editor = this.getEditor();
        let vsEditor = editor.getVSCodeTextEditor();
        if (this.getVisualType() === VisualType.line) {
            vscode.commands.executeCommand("cursorLeftSelect");
        } else if (this.getVisualType() === VisualType.block) {
            this._visualBlock_left(editor);
        } else {
            vscode.commands.executeCommand("cursorLeftSelect");
        }
        vsEditor.revealRange(vsEditor.selection);
    }
    cursorRight() {
        let editor = this.getEditor();
        let vsEditor = editor.getVSCodeTextEditor();
        if (this.getVisualType() === VisualType.line) {
            vscode.commands.executeCommand("cursorRightSelect");
        } else if (this.getVisualType() === VisualType.block) {
            this._visualBlock_right(editor);
        } else {
            vscode.commands.executeCommand("cursorRightSelect");
        }
        vsEditor.revealRange(vsEditor.selection);
    }
}

class VSModalEditor extends Editor {
    _vsTextEditor: vscode.TextEditor;
    _styles: CursorStyles;
    _oldCursorStyle: vscode.TextEditorCursorStyle | undefined;

    constructor(
        vsEditor: vscode.TextEditor,
        styles?: CursorStyles,
        insertTimeout?: number,
    ) {
        super();

        let searchModal = new VSSearchModal(this);
        let normalModal = new VSNormalModal(this);
        let visualModal = new VSVisualModal(this);
        let insertModal = new VSInsertModal(this);

        insertModal.setTimeout(insertTimeout ?? null);

        this.setSearchModal(searchModal);
        this.setInsertModal(insertModal);
        this.setNormalModal(normalModal);
        this.setVisualModal(visualModal);

        this._vsTextEditor = vsEditor;
        this._oldCursorStyle = vsEditor.options.cursorStyle;
        this._styles = styles ?? {
            [ModalType.normal]: vscode.TextEditorCursorStyle.Block,
            [ModalType.insert]: vscode.TextEditorCursorStyle.Line,
            [ModalType.visual]: vscode.TextEditorCursorStyle.LineThin,
            [ModalType.search]: vscode.TextEditorCursorStyle.Underline,
        };
    }

    destroy() {
        this._vsTextEditor.options.cursorStyle = this._oldCursorStyle;
        this.removeAllListeners();
    }

    override getVisualModal(): VSVisualModal {
        return super.getVisualModal() as VSVisualModal;
    }

    override enterMode(modalType: string | ModalType, options?: any): void {
        super.enterMode(modalType, options);
        this.updateCursorStyle();
    }

    getVSCodeTextEditor(): vscode.TextEditor {
        return this._vsTextEditor;
    }

    async clearSelection() {
        let s = this._vsTextEditor.selection;
        let newSelections = [new vscode.Selection(s.anchor, s.anchor)];
        this._vsTextEditor.selections = newSelections;
    }

    setCursorStyle(styles: CursorStyles) {
        this._styles = styles;
    }

    updateCursorStyle() {
        let style = this._styles[this.getCurrentModalType()];
        if (style)
            this._vsTextEditor.options.cursorStyle = style;
    }

    updateKeymaps(config: {
        normal?: Keymap,
        insert?: Keymap;
        visual?: Keymap;
    }) {
        if (config.normal)
            this.getNormalModal().updateKeymap(config.normal);
        if (config.insert)
            this.getInsertModal().updateKeymap(config.insert);
        if (config.visual)
            this.getVisualModal().updateKeymap(config.visual);
    }

    cursorUpSelect() {
        this.getVisualModal().cursorUp();
    }
    cursorDownSelect() {
        this.getVisualModal().cursorDown();
    }
    cursorLeftSelect() {
        this.getVisualModal().cursorLeft();
    }
    cursorRightSelect() {
        this.getVisualModal().cursorRight();
    }

    onSelectionChange(selections: readonly vscode.Selection[], kind: vscode.TextEditorSelectionChangeKind | undefined) {
        if (kind === vscode.TextEditorSelectionChangeKind.Mouse) {
            let hasSelection = selections.some((s) => !s.isEmpty);
            let curMode = this.getCurrentModalType();
            if (hasSelection) {
                if (curMode !== ModalType.visual)
                    this.enterMode(ModalType.visual);
            } else if (curMode !== ModalType.normal) {
                this.enterMode(ModalType.normal);
            }
        } else {
        }
    }

    selectionsContainsLine(line: number): boolean {
        return this._vsTextEditor.selections.some(a => line >= a.start.line && line <= a.end.line);
    }

    lineLength(line: number): number | undefined {
        let document = this._vsTextEditor.document;
        if (line >= document.lineCount)
            return undefined;
        let l = this._vsTextEditor.document.lineAt(line);
        return l.range.end.character;
    }

    isAtLineEnd(selection: vscode.Selection) {
        let length = this.lineLength(selection.active.line) ?? 0;
        return selection.active.character >= length;
    }

    getSelectionByLine(line: number, anchorChar?: number, actionChar?: number): vscode.Selection | undefined {
        let document = this._vsTextEditor.document;
        if (line < 0 || line >= document.lineCount)
            return undefined;

        let range = document.lineAt(line).range;
        let anchor = range.start;
        let action = range.end;
        let endChar = action.character;

        if (anchorChar !== undefined)
            anchor = anchor.with(undefined, Math.max(Math.min(endChar, anchorChar), 0));
        if (actionChar !== undefined)
            action = action.with(undefined, Math.max(Math.min(endChar, actionChar), 0));

        return new vscode.Selection(anchor, action);
    }

    getLineRange(at: vscode.Position | number, after?: boolean): vscode.Range | undefined {
        let editor = this._vsTextEditor;
        let doc = editor.document;

        let lineNumber = typeof at === 'number' ? at : at.line;
        if (lineNumber < 0 || lineNumber >= doc.lineCount)
            return undefined;

        let lineRange = doc.lineAt(lineNumber).range;

        if (typeof at !== "number") {
            if (after) {
                return new vscode.Range(at, lineRange.end);
            } else {
                return new vscode.Range(lineRange.start, at);
            }
        } else {
            return lineRange;
        }
    }

    getDocumentRange(at?: vscode.Position, after: boolean = true): vscode.Range {
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

    getSearchRange(searchRange: SearchRange, searchDirection: SearchDirection, incaludingCursor: boolean = true): vscode.Range {
        let editor = this._vsTextEditor;

        if (searchRange === SearchRange.line) {
            if (searchDirection === SearchDirection.before) {
                let at = editor.selection.active;
                return this.getLineRange(at, false)!;
            } else if (searchDirection === SearchDirection.after) {
                let at = incaludingCursor ? editor.selection.active : editor.selection.active.translate(0, 1);
                return this.getLineRange(at, true)!;
            } else if (searchDirection === SearchDirection.start || searchDirection === SearchDirection.reverse) {
                let line = editor.selection.active.line;
                return this.getLineRange(line)!;
            } else {
                throw new Error("Invalid search direction");
            }
        } else if (searchRange === SearchRange.document) {
            if (searchDirection === SearchDirection.before) {
                let at = editor.selection.active;
                return this.getDocumentRange(at, false);
            } else if (searchDirection === SearchDirection.after) {
                let at = incaludingCursor ? editor.selection.active : editor.selection.active.translate(0, 1);
                return this.getDocumentRange(at, true);
            } else if (searchDirection === SearchDirection.start || searchDirection === SearchDirection.reverse) {
                return this.getDocumentRange();
            } else {
                throw new Error("Invalid search direction");
            }
        } else {
            throw new Error("Invalid search range");
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
        let range = this.getSearchRange(searchRange, SearchDirection.after, false);
        if (!range)
            return undefined;
        return this._nextMatch(text, range);
    }
    prevMatchFromCursor(text: string, line = false) {
        let searchRange = line ? SearchRange.line : SearchRange.document;
        let range = this.getSearchRange(searchRange, SearchDirection.before);
        if (!range)
            return undefined;
        return this._nextMatch(text, range, true);
    }
}

export type {
    CursorStyles
};
export {
    VSModalEditor,
    CursorMoveDir,
};