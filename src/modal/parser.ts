
import { Action, CommandAction, SeqAction } from "./action";
import { Keymap } from "./keymap";

function isObject(a: unknown): a is object {
    return !!a && typeof a === "object";
}
function isString(a: unknown): a is string {
    return typeof a === "string";
}

function deepCopyObj(obj: object): object {
    if (typeof obj !== "object" && obj !== null)
        throw new TypeError();
    let newObj = {};
    for (var [k, v] of Object.entries(obj)) {
        let nv = deepCopy(v);
        (newObj as any)[k] = v;
    }
    return newObj;
}
function deepCopyArray(arr: Array<any>): Array<any> {
    if (!(arr instanceof Array))
        throw new TypeError();
    let newArr = [];
    for (var v of arr) {
        let nv = deepCopy(v);
        newArr.push(nv);
    }
    return newArr;
}

function deepCopy(v: any): any {
    if (v === undefined || v === null ||
        typeof v === "boolean" || typeof v === "number" ||
        typeof v === "string" || typeof v === "symbol"
    )
        return v;
    else if (v instanceof Array)
        return deepCopyArray(v);
    else if (typeof v === "object")
        return deepCopyObj(v);
    else if (typeof v === "function")
        return v;
    else
        throw new TypeError(`this object does not support deep copy: ${v}`);
}

class ModalRuntimeError extends Error {
    constructor(msg?: string) { super(msg); }
}

class ParseKeymapError extends Error {
    constructor(msg?: string) { super(msg); }
}

class ParseKeysError extends ParseKeymapError {
    constructor(source: string, pos: number) {
        super(`parse \"${source}\" error, at ${pos}`);
    }
}

// Seq  :: Atom (',' Atom)*
// Atom :: Char | (Char '-' Char)
function parseToKeys(keyStr: string): string[] {
    class StrIter {
        _cur: number;
        _source: string;
        _chars: string[];
        constructor(s: string) {
            this._cur = 0;
            this._source = s;
            this._chars = [...s];
        }
        getSource(): string { return this._source; }
        getCur(): number { return this._cur; }
        peek(n: number = 0): string | null {
            return this._chars[this._cur + n] || null;
        }
        next(): string | null {
            return this._chars[this._cur++] || null;
        }
    }
    function _atom(s: StrIter): string[] {
        let first_v = s.peek(0);
        let second_v = s.peek(1);
        let third_v = s.peek(2);

        if (!first_v)
            throw new ParseKeysError(s.getSource(), s.getCur());

        if (!second_v || second_v !== "-") {
            s.next();
            return [first_v];
        }

        if (!third_v)
            throw new ParseKeysError(s.getSource(), s.getCur());

        let beg, end;
        if (first_v < third_v) {
            beg = first_v.codePointAt(0);
            end = third_v.codePointAt(0);
        } else {
            end = first_v.codePointAt(0);
            beg = third_v.codePointAt(0);
        }

        if (!beg || !end)
            throw new ParseKeysError(s.getSource(), s.getCur());

        s.next(), s.next(), s.next();

        let res = [];
        for (var i = beg; i <= end; i++) {
            res.push(String.fromCodePoint(i));
        }
        return res;
    }

    function _seq(s: StrIter): string[] {
        let res = _atom(s);

        let n = s.next();
        while (n) {
            if (n !== ",")
                throw new ParseKeysError(s.getSource(), s.getCur());
            let nn = _atom(s);
            res.splice(res.length, 0, ...nn);

            n = s.next();
        }
        return res;
    }

    if (typeof keyStr !== "string")
        throw new TypeError("Expected string");

    let keySeq = _seq(new StrIter(keyStr));
    return keySeq;
}

interface Parameterized {
    command: string,
    args?: object | string,
}
type Command = string | Parameterized | Command[];

class KeymapParser {
    _keymapsConfig: object;
    _keymapsStack: Keymap[];

    static isParameterized(a: unknown): a is Parameterized {
        if (isObject(a)) {
            var aa = a as any;
            var t: boolean = aa.args ? (isObject(aa.args) || isString(aa.args)) : true;
            return isString(aa.command) && t;
        }
        return false;
    }
    static isCommandSeq(a: unknown): a is Command[] {
        return a instanceof Array && a.every(KeymapParser.isCommand);
    }
    static isCommand(a: unknown): a is Command {
        return isString(a) || KeymapParser.isCommandSeq(a) || KeymapParser.isParameterized(a);
    }

    constructor(keymapsConfig: object) {
        if (typeof keymapsConfig !== "object")
            throw new ParseKeymapError(`invalid keymaps: ${JSON.stringify(keymapsConfig)}`);
        this._keymapsConfig = keymapsConfig;
        this._keymapsStack = [];
    }

    __toAction(v: Command): Action {
        if (isString(v)) {
            return new CommandAction(v);
        } else if (KeymapParser.isParameterized(v)) {
            return new CommandAction(v.command, v.args);
        } else if (v instanceof Array) {
            let actions = [];
            for (var c of v) {
                actions.push(this.__toAction(c));
            }
            return new SeqAction(...actions);
        }

        // should not be executed here.
        return new Action();
    }
    _toAction(v: unknown): Action | null {
        if (KeymapParser.isCommand(v))
            return this.__toAction(v);
        else
            return null;
    }

    _toActionOrKeymap(k: string, v: unknown): Action | Keymap {
        if (typeof v === "number") {
            if (v <= 0) {
                if (v > this._keymapsStack.length)
                    throw new ParseKeymapError(`out of range.\n "${k}": ${v}`);
                return this._keymapsStack[this._keymapsStack.length + v - 1];
            } else {
                throw new ParseKeymapError(`action must be 0 or negative.\n "${k}": ${v}`);
            }
        }

        let action = this._toAction(v);
        if (action)
            return action;

        return this._parseObjConfig(v);
    }

    _parseObjConfig(obj: any): Keymap {
        if (!isObject(obj))
            throw new ParseKeymapError(`invalid keymaps: ${JSON.stringify(obj)}`);

        let help = (obj as any).help;
        if (typeof help !== "string" && typeof help !== "undefined")
            throw new Error(`invalid help: ${JSON.stringify(help)}`);

        let keymap: Keymap = new Keymap(help);

        this._keymapsStack.push(keymap);

        for (var [k, v] of Object.entries(obj)) {
            if (k === "id" || k === "help")
                continue;
            let keySeq = parseToKeys(k);
            let action = this._toActionOrKeymap(k, v);
            for (var key of keySeq) {
                keymap.setKey(key, action);
            }
        }

        this._keymapsStack.pop();

        return keymap;
    }

    parse(): Keymap {
        return this._parseObjConfig(this._keymapsConfig);
    }
}

function ParseKeymapConfigObj(obj: object): Keymap {
    let parser = new KeymapParser(obj);
    return parser.parse();
}

export {
    ParseKeymapConfigObj
};