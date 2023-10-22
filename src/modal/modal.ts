import { Keymap } from "./keymap";
import { Action } from "./action";
import { Editor } from "./editor";

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

abstract class BaseModal {
    _name: string;
    _editor: Editor;

    _timeout: number | null;

    _currentKeySeq: string[];

    constructor(name: string, editor: Editor, option?: {
        timeout?: number;
    }) {
        this._name = name;
        this._editor = editor;
        this._timeout = option?.timeout ?? null;
        this._currentKeySeq = [];
    }

    getName(): string { return this._name; }
    getEditor(): Editor { return this._editor; }
    setTimeout(timeout: number | null) { this._timeout = timeout && timeout >= 0 ? timeout : null; }
    getTimeout(): number | null { return this._timeout; }

    getCurrentKeySeq(): string[] { return this._currentKeySeq; }

    reset(): void | Thenable<void> { }

    getModalMessage(): string { return ""; }

    onWillEnter(option?: any): void | Thenable<void> { }
    onDidEnter(): void | Thenable<void> { }
    onWillLeave(): void | Thenable<void> { }

    onKey(key: string): void | Thenable<void> { }
    onTimeout(): void | Thenable<void> { }
    onDefault(): void | Thenable<void> { }

    onExecCommand(command: string, args: any): void | Thenable<void> { }
}

class KeymapModal extends BaseModal {
    _rootKeymap: Keymap;
    _currentKeymap: Keymap | null;

    _timeoutHandle: NodeJS.Timeout | null = null;

    _onTimeout: ((modal: KeymapModal) => void | Thenable<void>) | null;
    _onDefault: ((modal: KeymapModal) => void | Thenable<void>) | null;

    _onExecCommand: ((modal: KeymapModal, command: string, args: any) => void | Thenable<void>) | null;

    constructor(name: string, editor: Editor, option?: {
        timeout?: number,
        onTimeout?: (modal: KeymapModal) => void | Thenable<void>,
        onDefault?: (modal: KeymapModal) => void | Thenable<void>,
        onExecCommand?: (modal: KeymapModal, command: string, args: any) => void | Thenable<void>,
    }) {
        super(name, editor, option);
        this._onTimeout = option?.onTimeout ?? null;
        this._onDefault = option?.onDefault ?? null;
        this._onExecCommand = option?.onExecCommand ?? null;

        this._rootKeymap = new Keymap();

        this._currentKeymap = null;
        this._currentKeySeq = [];
    }

    updateKeymap(keymap: Keymap) {
        this._rootKeymap.marge(keymap);
    }

    clearKeymap() {
        this.reset();
        this._rootKeymap.clear();
    }

    override getModalMessage() {
        return this.getCurrentKeySeq().join("");
    }

    override reset() {
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

    override async onExecCommand(command: string, args: any) {
        if (this._onExecCommand) await this._onExecCommand(this, command, args);
    }

    override async onTimeout() {
        if (this._onTimeout) await this._onTimeout(this);
    }
    override async onDefault() {
        if (this._onDefault) await this._onDefault(this);
    }
    override  async onKey(key: string) {
        this._clearTimeout();

        this._currentKeySeq.push(key);

        let actionOrKeymap: Action | Keymap | null = null;
        if (this._currentKeymap) {
            actionOrKeymap = this._currentKeymap.getKey(key);
        } else {
            actionOrKeymap = this._rootKeymap.getKey(key);
        }

        if (actionOrKeymap instanceof Keymap) {
            this._currentKeymap = actionOrKeymap;
            if (typeof this._timeout === "number") {
                this._timeoutHandle = setTimeout(() => {
                    try {
                        this._timeoutHandle = null;
                        this.onTimeout();
                    } finally {
                        this.reset();
                    }
                }, this._timeout);
            }
        } else if (actionOrKeymap instanceof Action) {
            try {
                let keySeq = this._currentKeySeq;
                await actionOrKeymap.exec(this, keySeq);
            } finally {
                this.reset();
            }
        } else {
            try {
                this.onDefault();
            } finally {
                this.reset();
            }
        }
    }
}

class VisualModal extends KeymapModal {
    _visualType: VisualType;

    constructor(name: string, editor: Editor, option?: {
        timeout?: number,
        onTimeout?: (modal: KeymapModal) => void | Thenable<void>,
        onDefault?: (modal: KeymapModal) => void | Thenable<void>,
        onExecCommand?: (modal: KeymapModal, command: string, args: any) => void | Thenable<void>,
    }) {
        super(name, editor, option);
        this._visualType = VisualType.normal;
    }

    override onWillEnter(option?: any): void | Thenable<void> {
        let vt: VisualType = option?.visualType ?? VisualType.normal;
        this._visualType = vt;
    }

    getVisualType(): VisualType { return this._visualType; }
    setVisualType(visualType: VisualType) { this._visualType = visualType; }
}

class SearchModal extends BaseModal {
    _text: string;
    _searchRange: SearchRange;
    _searchDirection: SearchDirection;
    _singleChar: boolean;

    constructor(name: string, editor: Editor) {
        super(name, editor);
        this._text = "";
        this._searchRange = SearchRange.document;
        this._searchDirection = SearchDirection.after;
        this._singleChar = false;
    }

    getText(): string { return this._text; }
    setText(text: string): void { this._text = text; }

    getSearchRange(): SearchRange { return this._searchRange; }
    setSearchRange(searchRange: SearchRange): void { this._searchRange = searchRange; }

    getSearchDirection(): SearchDirection { return this._searchDirection; }
    setSearchDirection(searchDirection: SearchDirection): void { this._searchDirection = searchDirection; }

    override getModalMessage() {
        return this._text;
    }

    override onWillEnter(option?: any): void | Thenable<void> {
        this._text = "";
        if (option && typeof option === "object") {
            this._searchRange = option?.searchRange ?? SearchRange.document;
            this._searchDirection = option?.searchDirection ?? SearchDirection.after;
            this._singleChar = option?.singleChar ?? false;
        }
    }

    override onKey(key: string): void | Thenable<void> {
        if (key === "\n") {
            this.onConfirm();
        } else {
            if (this._singleChar) {
                this._text = key;
                this.onConfirm();
            } else {
                this._text += key;
            }
        }
    }

    onConfirm(): void | Thenable<void> { }
}

export {
    ModalType,
    VisualType,
    SearchDirection,
    SearchRange,
    BaseModal,
    KeymapModal,
    VisualModal,
    SearchModal,
};