import { EventEmitter } from "events";

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
            await editor.onExecCommand(this.command, this.args);
        }
    }
}

class FunctionAction extends Action {
    _func: (Modal: Modal, keySeq: string[]) => Thenable<void> | void;
    constructor(f: (Modal: Modal, keySeq: string[]) => Thenable<void> | void) {
        super();
        this._func = f;
    }
    async exec(modal: Modal, keySeq: string[]) {
        await this._func(modal, keySeq);
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

        this._maps.set(key, keymap_or_action);
    }

    getKey(key: string): Keymap | Action | null {
        return this._maps.get(key) ?? null;
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

enum ModalType {
    normal = 1,
    insert = 2,
    visual = 3,
    search = 4,
}
enum VisualType {
    normal = 1,
    line = 2,
    block = 3,
}
enum SearchDirection {
    before = 1,
    after = 2,
    start = 3,
    reverse = 4,
}
enum SearchRange {
    line = 1,
    document = 2,
}

function isVisualType(t: VisualType | SearchDirection | undefined): t is VisualType {
    return t === VisualType.normal || t === VisualType.line || t === VisualType.block;
}
function isSearchDirection(t: VisualType | SearchDirection | undefined): t is SearchDirection {
    return t === SearchDirection.before || t === SearchDirection.after || t === SearchDirection.start || t === SearchDirection.reverse;
}

function modalTypeToString(type_: ModalType) {
    switch (type_) {
        case ModalType.normal: return "normal";
        case ModalType.insert: return "insert";
        case ModalType.visual: return "visual";
        case ModalType.search: return "search";
        default: throw new Error(`invalid ModalType: ${type_}`);
    }
}

class Modal {
    _type: ModalType;
    _editor: Editor;

    _timeout: number | null;

    _rootKeymap: Keymap;
    _currentKeymap: Keymap | null;
    _currentKeySeq: string[];

    _timeoutHandle: NodeJS.Timeout | null = null;

    constructor(type_: ModalType, editor: Editor, option?: {
        timeout?: number,
    }) {
        this._type = type_;
        this._editor = editor;

        this._timeout = option?.timeout ?? null;

        this._rootKeymap = new Keymap();

        this._currentKeymap = null;
        this._currentKeySeq = [];
    }

    getType(): ModalType { return this._type; }
    getEditor(): Editor | null { return this._editor; }

    updateKeymap(keymap: Keymap) {
        this._rootKeymap.marge(keymap);
    }

    clearKeymap() {
        this.reset();
        this._rootKeymap.clear();
    }

    reset() {
        this._clearTimeout();
        this._currentKeySeq = [];
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
        try {
            if (this._type === ModalType.insert)
                await this._editor.onInsertTimeoutAction(keySeq);
            else if (this._type === ModalType.normal)
                await this._editor.onNoramlTimeoutAction(keySeq);
            else if (this._type === ModalType.visual)
                await this._editor.onVisualTimeoutAction(keySeq);
            else if (this._type === ModalType.search)
                await this._editor.onSearchTimeoutAction(keySeq);
        } finally {
            this.reset();
        }
    }

    async _doDefault() {
        let keySeq = this._currentKeySeq;
        this._timeoutHandle = null;
        try {
            if (this._type === ModalType.insert)
                await this._editor.onInsertDefaultAction(keySeq);
            else if (this._type === ModalType.normal)
                await this._editor.onNoramlDefaultAction(keySeq);
            else if (this._type === ModalType.visual)
                await this._editor.onVisualDefaultAction(keySeq);
            else if (this._type === ModalType.search)
                await this._editor.onSearchDefaultAction(keySeq);
        } finally {
            this.reset();
        }
    }


    async emitKey(key: string) {
        this._clearTimeout();

        this._currentKeySeq.push(key);

        let ac_or_km: Action | Keymap | null = null;
        if (this._currentKeymap) {
            ac_or_km = this._currentKeymap.getKey(key);
        } else {
            ac_or_km = this._rootKeymap.getKey(key);
        }

        if (ac_or_km instanceof Keymap) {
            this._currentKeymap = ac_or_km;
            if (typeof this._timeout === "number") {
                this._timeoutHandle = setTimeout(() => this._doTimeout(), this._timeout);
            }
        } else if (ac_or_km instanceof Action) {
            try {
                let keySeq = this._currentKeySeq;
                await ac_or_km.exec(this, keySeq);
            } finally {
                this.reset();
            }
        } else {
            this._doDefault();
        }
    }
}

abstract class Editor extends EventEmitter {
    _normalModal: Modal;
    _insertModal: Modal;
    _visualModal: Modal;
    _searchModal: Modal;

    _currentModal: Modal;
    _currentModalType: ModalType;
    _visualType: VisualType = VisualType.normal;
    _searchDirection: SearchDirection = SearchDirection.after;
    _searchRange: SearchRange = SearchRange.document;

    constructor() {
        super();
        this._normalModal = new Modal(ModalType.normal, this);
        this._visualModal = new Modal(ModalType.visual, this);
        this._insertModal = new Modal(ModalType.insert, this);
        this._searchModal = new Modal(ModalType.search, this);

        this._currentModal = this._normalModal;
        this._currentModalType = ModalType.normal;
    }

    getCurrentModalType(): ModalType { return this._currentModalType; }
    getCurrentModal(): Modal { return this._currentModal; }
    getNormalModal(): Modal { return this._normalModal; }
    getInsertModal(): Modal { return this._insertModal; }
    getVisualModal(): Modal { return this._visualModal; }
    getSearchModal(): Modal { return this._searchModal; }

    setInsertTimeout(timeout: number | null) {
        this._insertModal._timeout = timeout;
    }

    async _emitkey(key: string) {
        await this._currentModal.emitKey(key);
    }

    async emitKeys(key: string) {
        for (var k of key) {
            await this._emitkey(k);
        }
    }

    getCurrentKeySeq(): readonly string[] {
        return this._currentModal._currentKeySeq;
    }

    clearKeymapsAll() {
        this._normalModal.clearKeymap();
        this._insertModal.clearKeymap();
        this._visualModal.clearKeymap();
    }

    resetCurrent() {
        this._currentModal.reset();
    }

    resetAll() {
        this._normalModal.reset();
        this._insertModal.reset();
        this._visualModal.reset();
    }

    isNormal() { return this._currentModalType === ModalType.normal; }
    isInsert() { return this._currentModalType === ModalType.insert; }
    isVisual(visualType?: VisualType) {
        return this._currentModalType === ModalType.visual && (visualType === undefined || this._visualType === visualType);
    }
    isSearch(searchDirection?: SearchDirection, searchRange?: SearchRange) {
        return this._currentModalType === ModalType.search
            && (searchDirection === undefined || this._searchDirection === searchDirection)
            && (searchRange === undefined || this._searchRange === searchRange);
    }

    enterMode(
        modalType: string | ModalType,
        option?: { visualType?: VisualType, searchDirection?: SearchDirection, searchRange?: SearchRange; }
    ) {
        let modal: Modal | null = null;
        let type_: ModalType | null = null;
        if (typeof modalType === "string") {
            switch (modalType) {
                case "normal": type_ = ModalType.normal; modal = this._normalModal; break;
                case "insert": type_ = ModalType.insert; modal = this._insertModal; break;
                case "visual": type_ = ModalType.visual; modal = this._visualModal; break;
                case "search": type_ = ModalType.search; modal = this._searchModal; break;
                default: modal = null; break;
            }
        } else {
            type_ = modalType;
            switch (modalType) {
                case ModalType.normal: modal = this._normalModal; break;
                case ModalType.insert: modal = this._insertModal; break;
                case ModalType.visual: modal = this._visualModal; break;
                case ModalType.search: modal = this._searchModal; break;
                default: modal = null; break;
            }
        }

        let visualType: VisualType = option?.visualType ?? VisualType.normal;
        let searchDirection: SearchDirection = option?.searchDirection ?? SearchDirection.after;
        let searchRange: SearchRange = option?.searchRange ?? SearchRange.document;

        if (modal && type_) {
            this._visualType = visualType;
            this._searchDirection = searchDirection;
            this._searchRange = searchRange;

            this.resetAll();
            this._currentModal = modal;
            this._currentModalType = type_;
            this.emit("enterMode", type_, this);
        } else {
            throw new ModalRuntimeError(`mode "${modalType}" not found`);
        }
    }

    onExecCommand(command: string, ...args: any): Thenable<void> | void { }
    onInsertDefaultAction(keySeq: string[]): Thenable<void> | void { }
    onNoramlDefaultAction(keySeq: string[]): Thenable<void> | void { }
    onVisualDefaultAction(keySeq: string[]): Thenable<void> | void { }
    onSearchDefaultAction(keySeq: string[]): Thenable<void> | void { }
    onInsertTimeoutAction(keySeq: string[]): Thenable<void> | void { }
    onNoramlTimeoutAction(keySeq: string[]): Thenable<void> | void { }
    onVisualTimeoutAction(keySeq: string[]): Thenable<void> | void { }
    onSearchTimeoutAction(keySeq: string[]): Thenable<void> | void { }
}

export {
    ModalRuntimeError,
    ParseKeymapError,
    Keymap,
    ModalType,
    VisualType,
    SearchDirection,
    SearchRange,
    modalTypeToString,
    Modal,
    Editor,
    Action,
    CommandAction,
    FunctionAction,
    SeqAction,
    ParseKeymapConfigObj,
    deepCopy,
};