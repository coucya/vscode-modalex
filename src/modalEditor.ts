import { EventEmitter } from "events";

function isObject(a: unknown): a is object {
    return !!a && typeof a === "object"
}
function isString(a: unknown): a is string {
    return typeof a === "string"
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
        newArr.push(nv)
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
        throw new TypeError(`this object does not support deep copy: ${v}`)
}

class ModalRuntimeError extends Error {
    constructor(msg?: string) { super(msg) }
}

class ParseKeymapError extends Error {
    constructor(msg?: string) { super(msg) }
}

class ParseKeysError extends ParseKeymapError {
    constructor(source: string, pos: number) {
        super(`parse \"${source}\" error, at ${pos}`)
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
            this._source = s
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
        let first_v = s.peek(0)
        let second_v = s.peek(1)
        let third_v = s.peek(2)

        if (!first_v)
            throw new ParseKeysError(s.getSource(), s.getCur())

        if (!second_v || second_v !== "-") {
            s.next();
            return [first_v];
        }

        if (!third_v)
            throw new ParseKeysError(s.getSource(), s.getCur())

        let beg, end;
        if (first_v < third_v) {
            beg = first_v.codePointAt(0);
            end = third_v.codePointAt(0);
        } else {
            end = first_v.codePointAt(0);
            beg = third_v.codePointAt(0);
        }

        if (!beg || !end)
            throw new ParseKeysError(s.getSource(), s.getCur())

        s.next(), s.next(), s.next();

        let res = []
        for (var i = beg; i <= end; i++) {
            res.push(String.fromCodePoint(i))
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
        return res
    }

    if (typeof keyStr !== "string")
        throw new TypeError("Expected string")

    let keySeq = _seq(new StrIter(keyStr))
    return keySeq
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
            var aa = a as any
            var t: boolean = aa.args ? (isObject(aa.args) || isString(aa.args)) : true
            return isString(aa.command) && t
        }
        return false
    }
    static isCommandSeq(a: unknown): a is Command[] {
        return a instanceof Array && a.every(KeymapParser.isCommand)
    }
    static isCommand(a: unknown): a is Command {
        return isString(a) || KeymapParser.isCommandSeq(a) || KeymapParser.isParameterized(a)
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
            return new CommandAction(v.command, v.args)
        } else if (v instanceof Array) {
            let actions = [];
            for (var c of v) {
                actions.push(this.__toAction(c))
            }
            return new SeqAction(...actions);
        }

        // should not be executed here.
        return new Action();
    }
    _toAction(v: unknown): Action | null {
        if (KeymapParser.isCommand(v))
            return this.__toAction(v)
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

        return this._parseObjConfig(v)
    }

    _parseObjConfig(obj: any): Keymap {
        if (!isObject(obj))
            throw new ParseKeymapError(`invalid keymaps: ${JSON.stringify(obj)}`);

        let help = (obj as any).help;
        if (typeof help !== "string" && typeof help !== "undefined")
            throw new Error(`invalid help: ${JSON.stringify(help)}`)

        let keymap: Keymap = new Keymap(help);

        this._keymapsStack.push(keymap);

        for (var [k, v] of Object.entries(obj)) {
            if (k === "id" || k === "help")
                continue;
            let keySeq = parseToKeys(k)
            let action = this._toActionOrKeymap(k, v);
            for (var key of keySeq) {
                keymap.setKey(key, action)
            }
        }

        this._keymapsStack.pop();

        return keymap
    }

    parse(): Keymap {
        return this._parseObjConfig(this._keymapsConfig)
    }
}

function ParseKeymapConfigObj(obj: object): Keymap {
    let parser = new KeymapParser(obj);
    return parser.parse();
}

class Action {
    constructor() { }
    async exec(modal: Modal, keySeq: string[]) { }
}

class CommandAction extends Action {
    command: string;
    args: object | string | undefined;
    constructor(command: string, args?: object | string) {
        super();
        this.command = command;
        this.args = args;
    }
    async exec(modal: Modal, keySeq: string[]) {
        let editor = modal.getEditor();
        if (editor) {
            await editor.execCommand(this.command, this.args);
        }
    }
}

class FunctionAction extends Action {
    _func: (Modal: Modal, keySeq: string[]) => Thenable<void> | void
    constructor(f: (Modal: Modal, keySeq: string[]) => Thenable<void> | void) {
        super();
        this._func = f;
    }
    async exec(modal: Modal, keySeq: string[]) {
        await this._func(modal, keySeq)
    }
}

class SeqAction extends Action {
    _seq: Action[];
    constructor(...actions: Action[]) {
        super();
        this._seq = [...actions];
    }
    async exec(modal: Modal, keySeq: string[]) {
        for (var action of this._seq) {
            await action.exec(modal, keySeq);
        }
    }
}

class Keymap {
    _help: string;
    _maps: Map<string, Keymap | Action>;

    constructor(help?: string) {
        this._help = help ?? "";
        this._maps = new Map();
    }

    setKey(key: string, keymap_or_action: Keymap | Action) {
        if (typeof key !== "string")
            throw new TypeError(`the parameter "key" of Keymap.setKey() must be a single character, but ${typeof key} was given`);
        if (key.length !== 1)
            throw new Error(`the parameter "key" of Keymap.setKey() must be a single character, but "${key}" was given`);
        if (!(keymap_or_action instanceof Action || keymap_or_action instanceof Keymap))
            throw new TypeError(`the parameter "keymap_or_action" of Keymap.setKey() must be Action or Keymap , but "${keymap_or_action}" was given`);

        this._maps.set(key, keymap_or_action)
    }

    getKey(key: string): Keymap | Action | null {
        return this._maps.get(key) ?? null
    }

    marge(keymap: Keymap) {
        for (var [otherK, otherV] of keymap._maps.entries()) {
            let selfV = this._maps.get(otherK);
            if (selfV === undefined) {
                this._maps.set(otherK, otherV);
            } else if (selfV instanceof Action) {
                this._maps.set(otherK, otherV);
            } else if (selfV instanceof Keymap && otherV instanceof Action) {
                this._maps.set(otherK, otherV);
            } else if (selfV instanceof Keymap && otherV instanceof Keymap) {
                selfV.marge(otherV);
            }
        }
    }

    clear() {
        this._maps.clear();
    }
}

class Modal {
    _name: string;
    _editor: Editor | null;

    _defaultAction: Action | null;
    _timeout: number | null;
    _timeoutAction: Action | null;
    _timeoutErrorCb: ((err: any) => Thenable<void> | void) | null;

    _rootKeymap: Keymap;
    _currentKeymap: Keymap | null;
    _currentKeySeq: string[];

    _timeoutHandle: NodeJS.Timeout | null = null;

    constructor(name: string, option?: {
        defaultAction?: Action,
        timeout?: number,
        timeoutAction?: Action
        timeoutErrorCallback?: ((err: any) => Thenable<void> | void) | null;
    }) {
        if (typeof name !== "string")
            throw TypeError("the name of Modal() must be a string")

        this._name = name;
        this._editor = null;

        this._defaultAction = option?.defaultAction ?? null;
        this._timeout = option?.timeout ?? null;
        this._timeoutAction = option?.timeoutAction ?? null;
        this._timeoutErrorCb = option?.timeoutErrorCallback ?? null;

        this._rootKeymap = new Keymap();

        this._currentKeymap = null;
        this._currentKeySeq = [];
    }

    getName(): string { return this._name; }
    getEditor(): Editor | null { return this._editor; }

    setRootKeymap(keymap: Keymap) {
        this._rootKeymap = keymap
    }

    margeKeymap(keymap: Keymap) {
        this._rootKeymap.marge(keymap);
    }

    clearKeymap() {
        this._rootKeymap.clear();
        this._currentKeymap = null;
        this._currentKeySeq = [];
        this._clearTimeout();
    }

    reset() {
        this._clearTimeout();
        this._currentKeySeq = []
        this._currentKeymap = null;
    }

    _clearTimeout() {
        if (this._timeoutHandle) {
            clearTimeout(this._timeoutHandle);
            this._timeoutHandle = null;
        }
    }

    async _doTimeout() {
        let keySeq = this._currentKeySeq;
        this._timeoutHandle = null;
        this.reset();

        if (this._timeoutAction) {
            try {
                await this._timeoutAction.exec(this, keySeq)
            } catch (e) {
                if (this._timeoutErrorCb)
                    await this._timeoutErrorCb(e)
            }
        }
    }

    async emitKey(key: string) {
        this._clearTimeout();

        this._currentKeySeq.push(key);

        let ac_or_km: Action | Keymap | null = null;
        if (this._currentKeymap) {
            ac_or_km = this._currentKeymap.getKey(key)
        } else {
            ac_or_km = this._rootKeymap.getKey(key)
        }

        if (ac_or_km instanceof Keymap) {
            this._currentKeymap = ac_or_km;
            if (typeof this._timeout === "number") {
                this._timeoutHandle = setTimeout(() => this._doTimeout(), this._timeout);
            }
        } else if (ac_or_km instanceof Action) {
            let keySeq = this._currentKeySeq;
            this.reset();
            await ac_or_km.exec(this, keySeq);
        } else if (this._defaultAction) {
            let keySeq = this._currentKeySeq;
            this.reset();
            await this._defaultAction.exec(this, keySeq);
        } else {
            this.reset();
        }
    }
}

class Editor extends EventEmitter {
    _modals: Map<string, Modal>;
    _currentModal: Modal | null;
    _execCommandCallback: ((command: string, ...args: any[]) => Thenable<void> | void) | null;

    constructor(option?: {
        execCommandCallback?: (command: string, ...args: any[]) => Thenable<void> | void,
    }) {
        super();

        this._modals = new Map();
        this._currentModal = null;
        this._execCommandCallback = option?.execCommandCallback ?? null;
    }

    addModal(modal: Modal) {
        let name = modal.getName();
        modal._editor = this;
        this._modals.set(name, modal);
    }

    getModal(modal: string): Modal | undefined {
        return this._modals.get(modal)
    }

    removeModal(modal: Modal | string): Modal | undefined {
        let name: string;
        if (modal instanceof Modal)
            name = modal.getName();
        else if (typeof modal === "string")
            name = modal;
        else
            return undefined;

        let res = this._modals.get(name);
        this._modals.delete(name)
        if (res)
            res._editor = null;

        return res;
    }

    removeAllModal() {
        let modals = [...this._modals.values()];
        for (var m of modals)
            this.removeModal(m)
    }

    getCurrentModal(): Modal | undefined {
        return this._currentModal ?? undefined;
    }

    async _emitkey(key: string) {
        if (!this._currentModal)
            throw new ModalRuntimeError("no mode currently selected")
        await this._currentModal.emitKey(key);
    }

    async emitKey(key: string) {
        for (var k of key) {
            await this._emitkey(k)
        }
    }

    resetCurrent() {
        if (this._currentModal)
            this._currentModal.reset();
    }

    resetAll() {
        for (var m of this._modals.values())
            m.reset();
    }

    enterMode(modalName: string) {
        let modal = this._modals.get(modalName)
        if (modal) {
            this.resetAll()
            this._currentModal = modal;
            this.emit("enterMode", modalName, this);
        } else {
            throw new ModalRuntimeError(`mode "${modalName}" not found`);
        }
    }

    async execCommand(command: string, ...args: any) {
        if (this._execCommandCallback)
            await this._execCommandCallback(command, ...args);
    }
}

export {
    ModalRuntimeError,
    ParseKeymapError,
    Keymap,
    Modal,
    Editor,
    Action,
    CommandAction,
    FunctionAction,
    SeqAction,
    ParseKeymapConfigObj,
    deepCopy,
}