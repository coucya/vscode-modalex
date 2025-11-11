import * as vscode from "vscode";
import fs from "fs"

import { extensionName } from "../config";
import { getExtension } from "../extension";
import { ModalType } from "../modal/modal";

import { Cncut } from "../utils/cncut"
// @ts-ignore
import dict from "../utils/cncut/dict.txt"
import path from "path";

const commandPrefix = `${extensionName}.action`;

let cncut: Cncut | null = null;

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





function _cursorWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        let targetPosition: vscode.Position | null = null;
        let currentWordIndex = -1;

        // 找到当前光标所在的词
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (position.character >= word.start && position.character <= word.end) {
                currentWordIndex = i;
                // 如果光标在词的开始位置，跳转到上一个词的开头
                if (position.character === word.start) {
                    if (i > 0) {
                        targetPosition = new vscode.Position(position.line, words[i - 1].start);
                    } else {
                        // 已经是第一个词，移动到行首
                        targetPosition = new vscode.Position(position.line, 0);
                    }
                } else {
                    // 光标在词的中间或末尾，移动到词的开始
                    targetPosition = new vscode.Position(position.line, word.start);
                }
                break;
            }
        }

        // 如果没找到当前词，查找上一个词
        if (!targetPosition) {
            for (let i = words.length - 1; i >= 0; i--) {
                if (words[i].end < position.character) {
                    targetPosition = new vscode.Position(position.line, words[i].start);
                    break;
                }
            }
        }

        // 如果还是没找到，移动到行首
        if (!targetPosition) {
            targetPosition = new vscode.Position(position.line, 0);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function _cursorWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        let targetPosition: vscode.Position | null = null;
        let currentWordIndex = -1;

        // 找到当前光标所在的词
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (position.character >= word.start && position.character <= word.end) {
                currentWordIndex = i;
                // 如果光标在词的结束位置，跳转到下一个词的结尾
                if (position.character === word.end) {
                    if (i < words.length - 1) {
                        targetPosition = new vscode.Position(position.line, words[i + 1].end);
                    } else {
                        // 已经是最后一个词，移动到行尾
                        targetPosition = new vscode.Position(position.line, lineText.length);
                    }
                } else {
                    // 光标在词的开始或中间，移动到词的结束
                    targetPosition = new vscode.Position(position.line, word.end);
                }
                break;
            }
        }

        // 如果没找到当前词，查找下一个词
        if (!targetPosition) {
            for (let i = 0; i < words.length; i++) {
                if (words[i].start > position.character) {
                    targetPosition = new vscode.Position(position.line, words[i].end);
                    break;
                }
            }
        }

        // 如果还是没找到，移动到行尾
        if (!targetPosition) {
            targetPosition = new vscode.Position(position.line, lineText.length);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function _cursorPrevWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        // 找到当前位置前面的词的开始位置
        let targetWord = null;
        for (let i = words.length - 1; i >= 0; i--) {
            const word = words[i];
            if (word.start < position.character) {
                targetWord = word;
                break;
            }
        }

        let targetPosition: vscode.Position;
        if (targetWord) {
            targetPosition = new vscode.Position(position.line, targetWord.start);
        } else {
            // 没有找到前面的词，移动到行首
            targetPosition = new vscode.Position(position.line, 0);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function _cursorPrevWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        // 找到当前位置前面的词的结束位置
        let targetWord = null;
        for (let i = words.length - 1; i >= 0; i--) {
            const word = words[i];
            if (word.end < position.character) {
                targetWord = word;
                break;
            }
        }

        let targetPosition: vscode.Position;
        if (targetWord) {
            targetPosition = new vscode.Position(position.line, targetWord.end);
        } else {
            // 没有找到前面的词，移动到行首
            targetPosition = new vscode.Position(position.line, 0);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function _cursorNextWordStart() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        // 找到当前位置后面的词
        let targetWord = null;
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (position.character >= word.start && position.character < word.end) {
                // 找到当前词，取下一个
                if (i < words.length - 1) {
                    targetWord = words[i + 1];
                }
                break;
            }
        }

        // 如果没找到当前词，查找当前位置后面的词
        if (!targetWord) {
            for (let i = 0; i < words.length; i++) {
                if (words[i].start > position.character) {
                    targetWord = words[i];
                    break;
                }
            }
        }

        let targetPosition: vscode.Position;
        if (targetWord) {
            targetPosition = new vscode.Position(position.line, targetWord.start);
        } else {
            // 没有找到后面的词，移动到行尾
            targetPosition = new vscode.Position(position.line, lineText.length);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function _cursorNextWordEnd() {
    let editor = vscode.window.activeTextEditor;
    if (!editor || !cncut)
        return;

    let newSelections: vscode.Selection[] = [];

    for (const selection of editor.selections) {
        const position = selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text;

        // 对当前行进行分词
        const words = cncut.cut(lineText);

        // 找到当前位置后面的词的结束位置
        let targetWord = null;
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            if (position.character >= word.start && position.character < word.end) {
                // 找到当前词，取下一个
                if (i < words.length - 1) {
                    targetWord = words[i + 1];
                }
                break;
            }
        }

        // 如果没找到当前词，查找当前位置后面的词
        if (!targetWord) {
            for (let i = 0; i < words.length; i++) {
                if (words[i].start > position.character) {
                    targetWord = words[i];
                    break;
                }
            }
        }

        let targetPosition: vscode.Position;
        if (targetWord) {
            targetPosition = new vscode.Position(position.line, targetWord.end);
        } else {
            // 没有找到后面的词，移动到行尾
            targetPosition = new vscode.Position(position.line, lineText.length);
        }

        newSelections.push(new vscode.Selection(targetPosition, targetPosition));
    }

    editor.selections = newSelections;
}

function registerCommands(context: vscode.ExtensionContext) {

    (async () => {
        let wordSeparators = vscode.workspace.getConfiguration("editor").get<string>("wordSeparators") || "";
        wordSeparators = [...new Set(["\n", "\r", " ", ...wordSeparators])].join("")

        const p = path.join(__dirname, dict);
        const dictContent: string = await fs.promises.readFile(p, { encoding: "utf-8" })

        cncut = new Cncut(dictContent, wordSeparators);
    })();

    const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("editor.wordSeparators")) {
            let wordSeparators = vscode.workspace.getConfiguration("editor").get<string>("wordSeparators") || "";
            wordSeparators = [...new Set(["\n", "\r", " ", ...wordSeparators])].join("")

            cncut?.setDelimiters(wordSeparators)
        }
    });

    context.subscriptions.push(configChangeListener);

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