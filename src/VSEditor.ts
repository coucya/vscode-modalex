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
        let range = this.getSearchRange();
        let text = this.getText();

        let activeOnly = this._oldModalType === ModalType.visual;
        editor.searchNextAndSelect(text, range, dir, activeOnly, () => {
            editor.enterMode(this._oldModalType);
        });
    }
}

class VSVisualModal extends VisualModal {
    constructor(editor: Editor) {
        super("visual", editor);
    }

    override getEditor(): VSModalEditor {
        return this._editor as VSModalEditor;
    }

    override onWillEnter(option?: any) {
        super.onWillEnter(option);
    }

    override onDidEnter(): void | Thenable<void> {
        super.onDidEnter();
        let editor = this.getEditor();
        let vsEditor = editor.getVSCodeTextEditor();

        if (this._visualType === VisualType.block) {
        } else if (this._visualType === VisualType.line) {
            const curLineRange = vsEditor.document.lineAt(vsEditor.selection.active.line).range;
            const newSelection = new vscode.Selection(curLineRange.start, curLineRange.end);
            vsEditor.selections = [newSelection];
        }
    }

    override async onExecCommand(command: string, ...args: any[]) {
        await vscode.commands.executeCommand(command, ...args);
    }
}


function cursorUpOrDownSelect_line(
    selections: readonly vscode.Selection[],
    document: vscode.TextDocument,
    direction: "up" | "down"
): vscode.Selection[] {
    if (selections.length === 0)
        throw new Error("selections is empty");

    const lastSelection = selections[selections.length - 1];
    const secondToLast = selections.length > 1 ? selections[selections.length - 2] : undefined;
    const documentLineCount = document.lineCount;

    let newSelections: vscode.Selection[];

    if (direction === "up") {
        if (secondToLast && secondToLast.anchor.line <= lastSelection.anchor.line) {
            newSelections = selections.slice(0, -1);
        } else {
            const nextLine = lastSelection.active.line - 1;
            if (nextLine >= 0) {
                const newRange = document.lineAt(nextLine).range;
                let newSelection: vscode.Selection;
                if (lastSelection.active.character >= lastSelection.anchor.character) {
                    newSelection = new vscode.Selection(newRange.start, newRange.end);
                } else {
                    newSelection = new vscode.Selection(newRange.end, newRange.start);
                }
                newSelections = [...selections, newSelection];
            } else {
                newSelections = [...selections];
            }
        }
    } else if (direction === "down") {
        if (secondToLast && secondToLast.anchor.line >= lastSelection.anchor.line) {
            newSelections = selections.slice(0, -1);
        } else {
            const nextLine = lastSelection.active.line + 1;
            if (nextLine < documentLineCount) {
                const newRange = document.lineAt(nextLine).range;
                let newSelection: vscode.Selection;
                if (lastSelection.active.character >= lastSelection.anchor.character) {
                    newSelection = new vscode.Selection(newRange.start, newRange.end);
                } else {
                    newSelection = new vscode.Selection(newRange.end, newRange.start);
                }
                newSelections = [...selections, newSelection];
            } else {
                newSelections = [...selections];
            }
        }
    } else {
        throw new Error(`invalid direction: '${direction}', must be 'up' or 'down'`);
    }

    return newSelections;
}

function cursorUpOrDownSelect_block(
    selections: readonly vscode.Selection[],
    document: vscode.TextDocument,
    direction: "up" | "down"
): vscode.Selection[] {
    if (selections.length === 0)
        throw new Error("selections is empty");

    const firstSelection = selections[0];
    const lastSelection = selections[selections.length - 1];
    const secondToLast = selections.length > 1 ? selections[selections.length - 2] : undefined;
    const documentLineCount = document.lineCount;

    const rightmostCharacter: number = selections.reduce((a, b) => {
        return Math.max(a, Math.max(b.anchor.character, b.active.character))
    }, 0)
    const leftmostCharacter: number = firstSelection.start.character;

    let newSelections: vscode.Selection[] = [];

    if (direction === "up") {
        if (secondToLast && secondToLast.anchor.line <= lastSelection.anchor.line) {
            newSelections = selections.slice(0, -1);
        } else {
            const nextLine = lastSelection.active.line - 1;
            if (nextLine >= 0) {
                const newRange = document.lineAt(nextLine).range;
                let newSelection: vscode.Selection;
                if (lastSelection.active.character >= lastSelection.anchor.character) {
                    newSelection = new vscode.Selection(
                        new vscode.Position(nextLine, leftmostCharacter),
                        new vscode.Position(nextLine, rightmostCharacter),
                    );
                } else {
                    newSelection = new vscode.Selection(
                        new vscode.Position(nextLine, rightmostCharacter),
                        new vscode.Position(nextLine, leftmostCharacter),
                    );
                }
                newSelections = [...selections, newSelection];
            } else {
                newSelections = [...selections];
            }
        }
    } else if (direction === "down") {
        if (secondToLast && secondToLast.anchor.line >= lastSelection.anchor.line) {
            newSelections = selections.slice(0, -1);
        } else {
            const nextLine = lastSelection.active.line + 1;
            if (nextLine < documentLineCount) {
                const newRange = document.lineAt(nextLine).range;
                let newSelection: vscode.Selection;
                if (lastSelection.active.character >= lastSelection.anchor.character) {
                    newSelection = new vscode.Selection(
                        new vscode.Position(nextLine, leftmostCharacter),
                        new vscode.Position(nextLine, rightmostCharacter),
                    );
                } else {
                    newSelection = new vscode.Selection(
                        new vscode.Position(nextLine, rightmostCharacter),
                        new vscode.Position(nextLine, leftmostCharacter),
                    );
                }
                newSelections = [...selections, newSelection];
            } else {
                newSelections = [...selections];
            }
        }
    } else {
        throw new Error(`invalid direction: '${direction}', must be 'up' or 'down'`);
    }

    return newSelections;
}

function cursorLeftOrRightSelect_block(
    selections: readonly vscode.Selection[],
    document: vscode.TextDocument,
    direction: "left" | "right"
): vscode.Selection[] {
    if (selections.length === 0)
        throw new Error("selections is empty");

    const firstSelection = selections[0];
    const lastSelection = selections[selections.length - 1];
    const secondToLast = selections.length > 1 ? selections[selections.length - 2] : undefined;
    const documentLineCount = document.lineCount;

    const rightmostCharacter: number = selections.reduce((a, b) => {
        return Math.max(a, Math.max(b.anchor.character, b.active.character))
    }, 0)

    let newSelections: vscode.Selection[] = [];

    if (direction === "left") {
        newSelections = selections.map(s => {
            if (s.active.character >= s.anchor.character) {
                if (s.active.character > 0 && s.active.character === rightmostCharacter) {
                    return new vscode.Selection(
                        s.anchor,
                        s.active.translate({ characterDelta: -1 })
                    )
                } else {
                    return s;
                }
            } else {
                if (s.active.character > 0) {
                    return new vscode.Selection(
                        s.anchor,
                        s.active.translate({ characterDelta: -1 })
                    )
                } else {
                    return s;
                }
            }

        })
    } else if (direction === "right") {
        newSelections = selections.map(s => {
            return new vscode.Selection(
                s.anchor,
                s.active.translate({ characterDelta: 1 })
            )
        })
    } else {
        throw new Error(`invalid direction: '${direction}', must be 'left' or 'right'`);
    }

    return newSelections;
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
        if (this.getCurrentModalType() === ModalType.visual) {
            const currentVisualType = this.getVisualModal().getVisualType();

            if (currentVisualType === VisualType.normal) {
                vscode.commands.executeCommand("cursorUpSelect");
            } else if (currentVisualType === VisualType.line) {
                this._vsTextEditor.selections = cursorUpOrDownSelect_line(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "up",
                )
            } else if (currentVisualType === VisualType.block) {
                this._vsTextEditor.selections = cursorUpOrDownSelect_block(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "up",
                )
            }
        }
    }
    cursorDownSelect() {
        if (this.getCurrentModalType() === ModalType.visual) {
            const currentVisualType = this.getVisualModal().getVisualType();

            if (currentVisualType === VisualType.normal) {
                vscode.commands.executeCommand("cursorDownSelect");
            } else if (currentVisualType === VisualType.line) {
                this._vsTextEditor.selections = cursorUpOrDownSelect_line(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "down",
                )
            } else if (currentVisualType === VisualType.block) {
                this._vsTextEditor.selections = cursorUpOrDownSelect_block(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "down",
                )
            }
        }
    }
    cursorLeftSelect() {
        if (this.getCurrentModalType() === ModalType.visual) {
            const currentVisualType = this.getVisualModal().getVisualType();

            let newSelections: vscode.Selection[];
            if (currentVisualType === VisualType.normal) {
                vscode.commands.executeCommand("cursorLeftSelect");
            } else if (currentVisualType === VisualType.line) {
                // do nothing
            } else if (currentVisualType === VisualType.block) {
                this._vsTextEditor.selections = cursorLeftOrRightSelect_block(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "left"
                )
            }
        }
    }
    cursorRightSelect() {
        if (this.getCurrentModalType() === ModalType.visual) {
            const currentVisualType = this.getVisualModal().getVisualType();

            if (currentVisualType === VisualType.normal) {
                vscode.commands.executeCommand("cursorRightSelect");
            } else if (currentVisualType === VisualType.line) {
                // do nothing
            } else if (currentVisualType === VisualType.block) {
                this._vsTextEditor.selections = cursorLeftOrRightSelect_block(
                    this._vsTextEditor.selections,
                    this._vsTextEditor.document,
                    "right"
                )
            }
        }
    }

    onSelectionChange(selections: readonly vscode.Selection[], kind?: vscode.TextEditorSelectionChangeKind) {
        if (kind === vscode.TextEditorSelectionChangeKind.Mouse) {
            let hasSelection = selections.some((s) => !s.isEmpty);
            let curMode = this.getCurrentModalType();
            if (hasSelection) {
                if (curMode !== ModalType.visual) {
                    this.enterMode(ModalType.visual);
                }
            } else if (curMode !== ModalType.normal) {
                this.enterMode(ModalType.normal);
            }
        } else if (kind === vscode.TextEditorSelectionChangeKind.Keyboard) {
            let curMode = this.getCurrentModalType();
            if (curMode === ModalType.normal) {
                this.enterMode(ModalType.normal);
            }
        }

    }

    //
    // utility methods 
    //

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

    getSearchRange(
        searchRange: SearchRange,
        searchDirection: SearchDirection,
        at?: vscode.Position,
        includeCursor: boolean = true
    ): vscode.Range {
        let editor = this._vsTextEditor;

        at = at ?? editor.selection.active;

        if (searchRange === SearchRange.line) {
            if (searchDirection === SearchDirection.before) {
                return this.getLineRange(at, false)!;
            } else if (searchDirection === SearchDirection.after) {
                at = includeCursor ? at : at.translate(0, 1);
                return this.getLineRange(at, true)!;
            } else if (searchDirection === SearchDirection.start || searchDirection === SearchDirection.reverse) {
                return this.getLineRange(at.line)!;
            } else {
                throw new Error("Invalid search direction");
            }
        } else if (searchRange === SearchRange.document) {
            if (searchDirection === SearchDirection.before) {
                return this.getDocumentRange(at, false);
            } else if (searchDirection === SearchDirection.after) {
                at = includeCursor ? at : at.translate(0, 1);
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

    searchText(text: string, range: vscode.Range, reverse?: boolean): vscode.Position | undefined {
        let doc = this._vsTextEditor.document;
        let searchRange = doc.validateRange(range);
        let docText = doc.getText(searchRange);
        let matchPos = !reverse ? docText.indexOf(text) : docText.lastIndexOf(text);
        if (matchPos < 0)
            return undefined;
        matchPos = doc.offsetAt(searchRange.start) + matchPos;
        return doc.positionAt(matchPos);
    }

    searchNextAndSelect(
        text: string,
        range: SearchRange,
        dir: SearchDirection,
        activeOnly?: boolean,
        cb?: (selections: vscode.Selection[]) => any
    ) {
        let searchModal = this.getSearchModal();
        let vsEditor = this.getVSCodeTextEditor();

        let selections = vsEditor.selections;

        let newSelections: vscode.Selection[] = [];

        let reverse = dir === SearchDirection.before || dir === SearchDirection.reverse;

        if (activeOnly) {
            for (let selection of selections) {
                let searchRange = this.getSearchRange(range, dir, selection.active, false);
                let pos = this.searchText(text, searchRange, reverse);

                let newSelection: vscode.Selection;
                if (pos) {
                    pos = reverse ? pos : pos.translate(0, 1);
                    newSelection = new vscode.Selection(selection.anchor, pos);
                } else {
                    newSelection = selection;
                }

                newSelections.push(newSelection);
            }
        } else {
            for (let selection of selections) {
                let searchRange = this.getSearchRange(range, dir, selection.active, false);
                let pos = this.searchText(text, searchRange, reverse);

                let newSelection: vscode.Selection;
                if (pos)
                    newSelection = new vscode.Selection(pos, pos);
                else
                    newSelection = selection;

                newSelections.push(newSelection);
            }
        }

        setTimeout(() => {
            this.getVSCodeTextEditor().selections = newSelections;
            cb && cb(newSelections);
        }, 0);
    }

}

export type {
    CursorStyles
};
export {
    VSModalEditor,
    CursorMoveDir,
};