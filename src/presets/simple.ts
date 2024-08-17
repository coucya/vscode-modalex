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
    f: "modalex.enterSearchCharLineAfter",
    F: "modalex.enterSearchCharLineBefore",
    "/": "modalex.enterSearchAfter",
    "?": "modalex.enterSearchBefore",
    n: "modalex.searchNext",
    N: "modalex.searchPrev",
    u: "undo",
};

let visual = {
    h: "modalex.action.cursorLeftSelect",
    l: "modalex.action.cursorRightSelect",
    j: "modalex.action.cursorDownSelect",
    k: "modalex.action.cursorUpSelect",
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
    f: "modalex.enterSearchCharLineAfter",
    F: "modalex.enterSearchCharLineBefore"
};

export default {
    normal,
    insert,
    visual
};