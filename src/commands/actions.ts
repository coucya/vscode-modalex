import * as vscode from "vscode";

import { Jieba } from "@node-rs/jieba";
import { dict } from '@node-rs/jieba/dict'

import { extensionName } from "../config";
import { getExtension } from "../extension";
import { ModalType } from "../modal/modal";


const commandPrefix = `${extensionName}.action`;

const jieba = Jieba.withDict(dict)

function eolToString(eol: vscode.EndOfLine): string {
    switch (eol) {
        case vscode.EndOfLine.LF:
            return "\n";
        case vscode.EndOfLine.CRLF:
            return "\r\n";
        default:
            return "\n";
    }
}

async function _yankLine() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let selection = editor.selection;
    let text = editor.document.lineAt(selection.start.line).text +
        eolToString(editor.document.eol);

    await vscode.env.clipboard.writeText(text);
}

async function _cutLine() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let selection = editor.selection;
    let text = editor.document.lineAt(selection.start.line).text +
        eolToString(editor.document.eol);

    await Promise.all([
        editor.edit((builder) => {
            const range = editor.document.lineAt(selection.start.line).rangeIncludingLineBreak;
            builder.delete(range);
        }),
        vscode.env.clipboard.writeText(text)
    ]);
}

async function _yank() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    vscode.commands.executeCommand("editor.action.clipboardCopyAction")
}

async function _cut() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    vscode.commands.executeCommand("editor.action.clipboardCutAction")
}

async function _paste(args?: { before?: boolean; enterNormal?: boolean; }) {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    let before = args?.before ?? false;

    let text = await vscode.env.clipboard.readText();

    let documentLineCount = editor.document.lineCount;
    let selections = editor.selections;

    let eol = eolToString(editor.document.eol);

    text = text.replace(/\r?\n/g, eol)

    if (text.endsWith(eol)) {
        const documentLastLine = editor.document.lineAt(documentLineCount - 1);

        let newSelections: vscode.Selection[] = [];

        await editor.edit((builder) => {
            for (var selection of selections) {
                let curPos = selection.active;

                if (selection.isEmpty) {
                    if (before) {
                        let pos = new vscode.Position(curPos.line, 0);
                        builder.insert(pos, text);

                        newSelections.push(new vscode.Selection(curPos, curPos));
                    } else {
                        if (curPos.line >= documentLineCount - 1) {
                            let pos = documentLastLine.rangeIncludingLineBreak.end;
                            text = eol + text.slice(0, text.lastIndexOf(eol));
                            builder.insert(pos, text);
                        } else {
                            let pos = new vscode.Position(curPos.line + 1, 0);
                            builder.insert(pos, text);
                        }

                        let newPos = curPos.translate({ lineDelta: +1 });
                        newSelections.push(new vscode.Selection(newPos, newPos));
                    }
                } else {
                    builder.replace(selection, text);
                    let newPos = new vscode.Position(curPos.line, curPos.character + text.length);
                    newSelections.push(new vscode.Selection(newPos, newPos));
                }
            }
        });

        editor.selections = newSelections;
    } else {
        await editor.edit((builder) => {
            for (var selection of selections) {
                if (selection.isEmpty) {
                    builder.insert(selection.anchor, text);
                } else {
                    builder.replace(selection, text);
                }
            }
        });
    }

    if (args?.enterNormal) {
        getExtension().getActiveEditor()?.enterMode(ModalType.normal);
    }
}

function _transformTo(upper: boolean) {
    let editor = vscode.window.activeTextEditor;
    if (editor) {
        let replaced: [vscode.Selection | vscode.Range, string][] = [];
        for (var selection of editor.selections) {
            let range: vscode.Range;
            let newText: string;
            if (selection.isEmpty) {
                let start = new vscode.Position(selection.start.line, selection.start.character);
                let end = new vscode.Position(selection.start.line, selection.start.character + 1);
                range = new vscode.Range(start, end);
            } else {
                range = new vscode.Range(selection.start, selection.end);
            }
            if (upper) {
                newText = editor.document.getText(range).toUpperCase();
            } else {
                newText = editor.document.getText(range).toLowerCase();
            }
            replaced.push([range, newText]);
        }
        editor.edit((builder) => {
            for (var [s, text] of replaced) {
                builder.replace(s, text);
            }
        });
    }
}

function _cursorUpSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorUpSelect();

    const vsEditor = editor.getVSCodeTextEditor()
    const active = vsEditor.selections[vsEditor.selections.length - 1].active.with(undefined, 0);
    vsEditor.revealRange(new vscode.Range(active, active));
}
function _cursorDownSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorDownSelect();

    const vsEditor = editor.getVSCodeTextEditor()
    const active = vsEditor.selections[vsEditor.selections.length - 1].active.with(undefined, 0);
    vsEditor.revealRange(new vscode.Range(active, active));
}
function _cursorLeftSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorLeftSelect();
}
function _cursorRightSelect() {
    let editor = getExtension().getActiveEditor();
    if (!editor)
        return;
    editor.cursorRightSelect();
}

// Helper function to check if a character is a word character (letter, digit, or underscore)
function isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
}

// Helper function to check if a character is a Chinese character
function isChineseChar(char: string): boolean {
    return /[\u4e00-\u9fff]/.test(char);
}

// Helper function to check if a character is whitespace
function isWhitespace(char: string): boolean {
    return /\s/.test(char);
}

// Helper function to get segmented words from a line of text
function getSegmentedWords(line: string): { text: string, start: number, end: number }[] {
    const words: { text: string, start: number, end: number }[] = [];
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (isWhitespace(char)) {
            // Skip whitespace
            i++;
        } else if (isWordChar(char)) {
            // English word - collect consecutive word characters
            let start = i;
            while (i < line.length && isWordChar(line[i])) {
                i++;
            }
            words.push({ text: line.slice(start, i), start, end: i });
        } else if (isChineseChar(char)) {
            // For Chinese characters, we need to segment them
            const remainingText = line.slice(i);
            const segmentResult = jieba.cut(remainingText, true);

            if (segmentResult.length > 0) {
                const firstSegment = segmentResult[0];
                words.push({ text: firstSegment, start: i, end: i + firstSegment.length });
                i += firstSegment.length;
            } else {
                // Fallback: treat single character as a word
                words.push({ text: char, start: i, end: i + 1 });
                i++;
            }
        } else {
            // Other punctuation or symbols - treat as single character word
            words.push({ text: char, start: i, end: i + 1 });
            i++;
        }
    }

    return words;
}

// Helper function to find the word at the current cursor position
function findWordAtPosition(line: string, position: number): { text: string, start: number, end: number } | null {
    const words = getSegmentedWords(line);

    for (const word of words) {
        if (position >= word.start && position <= word.end) {
            return word;
        }
    }

    return null;
}

function _cursorWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;

        // Find the word at current position
        const currentWord = findWordAtPosition(line, position.character);

        if (currentWord) {
            // Move to the start of the current word
            const newPosition = new vscode.Position(position.line, currentWord.start);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        } else {
            // If not in a word, move to beginning of line
            const newPosition = new vscode.Position(position.line, 0);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function _cursorWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;

        // Find the word at current position
        const currentWord = findWordAtPosition(line, position.character);

        if (currentWord) {
            // Move to the end of the current word (exclusive)
            const newPosition = new vscode.Position(position.line, currentWord.end - 1);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        } else {
            // If not in a word, move to end of line
            const newPosition = new vscode.Position(position.line, Math.max(0, line.length - 1));
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function _cursorPrevWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;
        const words = getSegmentedWords(line);

        // Find the previous word
        let prevWord: { text: string, start: number, end: number } | null = null;

        for (const word of words) {
            if (word.start < position.character) {
                prevWord = word;
            } else {
                break;
            }
        }

        if (prevWord) {
            const newPosition = new vscode.Position(position.line, prevWord.start);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        } else {
            // Move to beginning of line
            const newPosition = new vscode.Position(position.line, 0);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function _cursorPrevWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;
        const words = getSegmentedWords(line);

        // Find the previous word
        let prevWord: { text: string, start: number, end: number } | null = null;

        for (const word of words) {
            if (word.start < position.character) {
                prevWord = word;
            } else {
                break;
            }
        }

        if (prevWord) {
            const newPosition = new vscode.Position(position.line, prevWord.end - 1);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        } else {
            // Move to beginning of line
            const newPosition = new vscode.Position(position.line, 0);
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function _cursorNextWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;
        const words = getSegmentedWords(line);

        // Find the next word
        let foundNextWord = false;
        for (const word of words) {
            if (word.start > position.character) {
                const newPosition = new vscode.Position(position.line, word.start);
                newSelections.push(new vscode.Selection(newPosition, newPosition));
                foundNextWord = true;
                break;
            }
        }

        // If no next word, move to end of line
        if (!foundNextWord) {
            const newPosition = new vscode.Position(position.line, Math.max(0, line.length - 1));
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function _cursorNextWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor)
        return;

    const selections = editor.selections;
    const newSelections: vscode.Selection[] = [];

    for (const selection of selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line).text;
        const words = getSegmentedWords(line);

        // Find the next word
        let foundNextWord = false;
        for (const word of words) {
            if (word.start > position.character) {
                const newPosition = new vscode.Position(position.line, word.end - 1);
                newSelections.push(new vscode.Selection(newPosition, newPosition));
                foundNextWord = true;
                break;
            }
        }

        // If no next word, move to end of line
        if (!foundNextWord) {
            const newPosition = new vscode.Position(position.line, Math.max(0, line.length - 1));
            newSelections.push(new vscode.Selection(newPosition, newPosition));
        }
    }

    editor.selections = newSelections;
}

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(`${commandPrefix}.yank`, _yank),
        vscode.commands.registerCommand(`${commandPrefix}.cut`, _cut),
        vscode.commands.registerCommand(`${commandPrefix}.yankLine`, _yankLine),
        vscode.commands.registerCommand(`${commandPrefix}.cutLine`, _cutLine),
        vscode.commands.registerCommand(`${commandPrefix}.paste`, _paste),
        vscode.commands.registerCommand(`${commandPrefix}.transformToUppercase`, () => _transformTo(true)),
        vscode.commands.registerCommand(`${commandPrefix}.transformToLowercase`, () => _transformTo(false)),
        vscode.commands.registerCommand(`${commandPrefix}.cursorUpSelect`, _cursorUpSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorDownSelect`, _cursorDownSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorLeftSelect`, _cursorLeftSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorRightSelect`, _cursorRightSelect),
        vscode.commands.registerCommand(`${commandPrefix}.cursorWordStart`, _cursorWordStart),
        vscode.commands.registerCommand(`${commandPrefix}.cursorWordEnd`, _cursorWordEnd),
        vscode.commands.registerCommand(`${commandPrefix}.cursorPrevWordStart`, _cursorPrevWordStart),
        vscode.commands.registerCommand(`${commandPrefix}.cursorPrevWordEnd`, _cursorPrevWordEnd),
        vscode.commands.registerCommand(`${commandPrefix}.cursorNextWordStart`, _cursorNextWordStart),
        vscode.commands.registerCommand(`${commandPrefix}.cursorNextWordEnd`, _cursorNextWordEnd)
    );
}


export {
    registerCommands
};
