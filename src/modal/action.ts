import { BaseModal } from "./modal";

class Action {
    constructor() { }
    async exec(modal: BaseModal, keySeq: string[]) { }
}

class CommandAction extends Action {
    command: string;
    args: object | string | undefined;
    constructor(command: string, args?: object | string) {
        super();
        this.command = command;
        this.args = args;
    }
    async exec(modal: BaseModal, keySeq: string[]) {
        await modal.onExecCommand(this.command, this.args);
    }
}

class FunctionAction extends Action {
    _func: (Modal: BaseModal, keySeq: string[]) => Thenable<void> | void;
    constructor(f: (Modal: BaseModal, keySeq: string[]) => Thenable<void> | void) {
        super();
        this._func = f;
    }
    async exec(modal: BaseModal, keySeq: string[]) {
        await this._func(modal, keySeq);
    }
}

class SeqAction extends Action {
    _seq: Action[];
    constructor(...actions: Action[]) {
        super();
        this._seq = [...actions];
    }
    async exec(modal: BaseModal, keySeq: string[]) {
        for (var action of this._seq) {
            await action.exec(modal, keySeq);
        }
    }
}

export {
    Action,
    CommandAction,
    FunctionAction,
    SeqAction,
};