let insert = {};

let normal = {
    i: "modalex.enterInsert",
    a: {
        "command": "modalex.enterInsert",
        "args": {
            "right": true
        }
    },
    h: "cursorLeft",
    j: "cursorDown",
    k: "cursorUp",
    l: "cursorRight",
    J: ["cursorDown", "cursorDown", "scrollLineDown", "scrollLineDown"],
    K: ["cursorUp", "cursorUp", "scrollLineUp", "scrollLineUp"],
    H: "cursorHome",
    L: "cursorEnd",
    w: "cursorWordStartRight",
    e: "cursorWordEndRight",
    b: "cursorWordStartLeft",
    o: [
        "editor.action.insertLineAfter",
        "modalex.enterInsert"
    ],
    O: [
        "editor.action.insertLineBefore",
        "modalex.enterInsert"
    ],
    x: "deleteRight",
    d: {
        d: "editor.action.deleteLines",
        w: "deleteWordRight",
        b: "deleteWordLeft",
    },
    g: {
        "g": "",
        "d": "editor.action.revealDefinition"
    },
    u: "undo",
};

let visual = {
    "d,x": "deleteRight",
};

export {
    normal,
    insert,
    visual
};