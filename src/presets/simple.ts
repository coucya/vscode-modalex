let insert = {};

let normal = {
    i: "modalex.enterInsert",
    a: "modalex.enterInsertRight",
    h: "cursorLeft",
    j: "cursorDown",
    k: "cursorUp",
    l: "cursorRight",
    W: "cursorWordStartRight",
    w: "cursorWordStartRight",
    b: "cursorWordStartLeft",
    B: "cursorWordStartLeft",
    e: "cursorWordEndRight",
    E: "cursorWordEndRight",
    x: "deleteRight",
    X: "deleteLeft",
    o: [
        "editor.action.insertLineAfter",
        "modalex.enterInsert"
    ],
    O: [
        "editor.action.insertLineBefore",
        "modalex.enterInsert"
    ],
    d: {
        d: [
            {
                "command": "cursorMove",
                "args": {
                    "to": "wrappedLine"
                }
            },
            "editor.action.clipboardCutAction"
        ],
        b: "deleteWordLeft",
        e: "deleteWordRight",
        w: "deleteWordRight"
    },
    y: {
        y: [
            {
                "command": "cursorMove",
                "args": {
                    "to": "wrappedLine"
                }
            },
            "editor.action.clipboardCopyAction"
        ]
    },
    v: "modalex.enterVisual",
    V: "modalex.enterVisualLine",
    p: "modalex.action.paste",
    P: "editor.action.clipboardPasteAction",
    f: "modalex.searchCharLineAfter",
    F: "modalex.searchCharLineBefore",
    "/": "modalex.searchAfter",
    "?": "modalex.searchBefore",
    n: "modalex.searchNext",
    N: "modalex.searchPrev",
    u: "undo",
};

let visual = {
    h: "cursorLeftSelect",
    j: "cursorDownSelect",
    k: "cursorUpSelect",
    l: "cursorRightSelect",
    I: "modalex.enterInsert",
    A: "modalex.enterInsertRight",
    w: "cursorWordStartRightSelect",
    e: "cursorWordRightSelect",
    b: "cursorWordLeftSelect",
    y: [
        "editor.action.clipboardCopyAction",
        "modalex.enterNormal"
    ],
    Y: [
        "editor.action.clipboardCopyAction",
        "modalex.enterNormal"
    ],
    p: [
        "modalex.action.paste",
        "modalex.enterNormal"
    ],
    d: [
        "editor.action.clipboardCutAction",
        "modalex.enterNormal"
    ],
    x: [
        "editor.action.clipboardCutAction",
        "modalex.enterNormal"
    ],
    t: {
        "u": "modalex.action.transformToUppercase",
        "l": "modalex.action.transformToLowercase"
    },
    f: "modalex.searchCharLineAfter",
    F: "modalex.searchCharLineBefore"
};

export default {
    normal,
    insert,
    visual
};