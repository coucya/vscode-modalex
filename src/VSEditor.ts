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

class VSSearchModal extends SearchModal {
    _oldModalType: ModalType = ModalType.normal;

    constructor(name: string, editor: Editor) {
        super(name, editor);
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

class VSModalEditor extends Editor {
    _vsTextEditor: vscode.TextEditor;
    _styles: CursorStyles;
    _oldCursorStyle: vscode.TextEditorCursorStyle | undefined;

    _lastSelection: vscode.Selection;
    _visaulAnchor: vscode.Position;
    _visaulActionOffset: number;

    constructor(vsEditor: vscode.TextEditor) {
        super();

        this._lastSelection = vsEditor.selection;
        this._visaulAnchor = vsEditor.selection.anchor;
        this._visaulActionOffset = 0;

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
        let visualModal = new VisualModal("visual", this, {
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
    }

    destroy() {
        this.removeAllListeners();
        this._vsTextEditor.options.cursorStyle = this._oldCursorStyle;
    }

    override enterMode(modalType: string | ModalType, options?: any): void {
        super.enterMode(modalType, options);
        if (this.isVisual()) {
            let selection = this._vsTextEditor.selection;
            this._visaulAnchor = selection.anchor;
            this._visaulActionOffset = selection.active.character - selection.anchor.character;
            if (this.isVisual(VisualType.line)) {
                let newSelection = this._lineAsSelection(selection.active.line) ?? selection;
                this._vsTextEditor.selection = newSelection;
            }
        }

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

    _lineAsSelection(line: number, beg?: number, end?: number): vscode.Selection | undefined {
        let document = this._vsTextEditor.document;
        if (line < 0 || line >= document.lineCount)
            return undefined;

        let range = document.lineAt(line).range;
        let s = range.start;
        let e = range.end;
        if (beg && beg >= s.character && beg <= e.character)
            s = new vscode.Position(s.line, beg);
        if (end && end >= s.character && end <= e.character)
            e = new vscode.Position(e.line, end);
        return new vscode.Selection(s, e);
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

    _selectionContainsLine(line: number): boolean {
        return this._vsTextEditor.selections.some(a => line >= a.start.line && line <= a.end.line);
    }


    _onSelectionChange(selections: readonly vscode.Selection[]) {
        let selection: vscode.Selection = selections[0];
        let doc = this._vsTextEditor.document;

        if (this.isVisual(VisualType.normal)) {
            let newSelection = new vscode.Selection(this._visaulAnchor, selection.active);
            this._vsTextEditor.selection = newSelection;
        } else if (this.isVisual(VisualType.line)) {
            let anchorLine = this._visaulAnchor.line;
            let curLine = selection.active.line;

            let anchor, active;
            if (anchorLine <= curLine) {
                anchor = new vscode.Position(anchorLine, 0);
                active = new vscode.Position(curLine, this.lineLength(curLine) ?? 0);
            } else {
                anchor = new vscode.Position(anchorLine, this.lineLength(anchorLine) ?? 0);
                active = new vscode.Position(curLine, 0);
            }
            anchor = doc.validatePosition(anchor);
            active = doc.validatePosition(active);
            let newSelection = new vscode.Selection(anchor, active);
            this._vsTextEditor.selection = newSelection;
        } else if (this.isVisual(VisualType.block)) {
            let anchorLine = this._visaulAnchor.line;
            let anchorChar = this._visaulAnchor.character;
            let curLine = selection.active.line;

            if (this._lastSelection.active.line === selection.active.line) {
                let newActionCharOffset = selection.active.character - anchorChar;
                if (this._visaulActionOffset > 0 && newActionCharOffset > this._visaulActionOffset)
                    this._visaulActionOffset = newActionCharOffset;
                else if (this._visaulActionOffset < 0 && newActionCharOffset < this._visaulActionOffset)
                    this._visaulActionOffset = newActionCharOffset;
                else
                    this._visaulActionOffset = newActionCharOffset;
            }

            let newSelections = [];
            if (anchorLine <= curLine) {
                for (var i = curLine; i >= anchorLine; i--) {
                    let anchor = doc.validatePosition(new vscode.Position(i, anchorChar));
                    let active = doc.validatePosition(new vscode.Position(i, anchorChar + this._visaulActionOffset));
                    let newSelection = new vscode.Selection(anchor, active);
                    newSelections.push(newSelection);
                }
            } else {
                for (var i = curLine; i <= anchorLine; i++) {
                    let anchor = doc.validatePosition(new vscode.Position(i, anchorChar));
                    let active = doc.validatePosition(new vscode.Position(i, anchorChar + this._visaulActionOffset));
                    let newSelection = new vscode.Selection(anchor, active);
                    newSelections.push(newSelection);
                }
            }

            this._vsTextEditor.selections = newSelections;
        }
    }

    onSelectionChange(selections: readonly vscode.Selection[], kind: vscode.TextEditorSelectionChangeKind | undefined) {
        let selection: vscode.Selection = selections[0];

        if (kind === vscode.TextEditorSelectionChangeKind.Mouse) {
            let isSelection = selections.some((s) => !s.isEmpty);
            let oldMode = this.getCurrentModalType();
            if (!this.isVisual() && isSelection) {
                this.enterMode(ModalType.visual);
            } else if (oldMode !== ModalType.normal) {
                this.enterMode(ModalType.normal);
            }
            this._lastSelection = this._vsTextEditor.selection;
        } else if (!selection.isEqual(this._lastSelection)) {
            this._onSelectionChange(selections);
            this._lastSelection = this._vsTextEditor.selection;
        }
    }

    _getLineRange(at: vscode.Position | number, after?: boolean) {
        let editor = this._vsTextEditor;
        let doc = editor.document;
        let lineNumber = typeof at === 'number' ? at : at.line;
        if (lineNumber >= doc.lineCount)
            return undefined;

        let lineRange = doc.lineAt(lineNumber).range;
        if (after === true && typeof at !== 'number') {
            return new vscode.Range(at, lineRange.end);
        } else if (after === false && typeof at !== 'number') {
            return new vscode.Range(lineRange.start, at);
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
    prevMatchFromCursor(text: string, line = false) {
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
    CursorStyles
};