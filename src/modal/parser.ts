
import { Action, CommandAction, SeqAction } from "./action";
import { Keymap } from "./keymap";

function isObject(a: unknown): a is object {
    return !!a && typeof a === "object";
}
function isString(a: unknown): a is string {
    return typeof a === "string";
}

class ParseKeymapError extends Error {
    constructor(msg?: string) { super(msg); }
}

interface Parameterized {
    command: string,
    args?: any,
}
type Command = string | Parameterized;
type KeymapTarget = { target: string; };

type KeymapConfigObject = {
    id: string,
    help: string,
    [key: string]: Command | Command[] | KeymapConfigObject,
};

function isParameterized(obj: any): obj is Parameterized {
    return obj && typeof obj === "object" && typeof obj.command === "string";
}
function isCommand(obj: any): obj is Command {
    return (typeof obj === "string" || isParameterized(obj));
}
function isCommandList(obj: any): obj is Command[] {
    return obj && obj instanceof Array && obj.every(isCommand);
}
function isKeymapTarget(obj: any): obj is KeymapTarget {
    return obj && typeof obj === "object" && typeof obj.target === "string";
}
function commandToAction(command: Command): Action {
    if (isString(command))
        return new CommandAction(command);
    else
        return new CommandAction(command.command, command.args);
}

type PaddingResolution = { keymap: Keymap, key: string, target: string; };


function _parseKeymapConfigObject(idKeymaps: Map<string, Keymap>, pending: PaddingResolution[], obj: any): Keymap {
    if (typeof obj !== "object" || !obj)
        throw new ParseKeymapError(`invalid keymaps: ${JSON.stringify(obj)}`);

    let id: string | undefined = obj.id;
    let help: string | undefined = obj.help;
    if (id !== undefined && (typeof id !== "string" || id.length === 0))
        throw new ParseKeymapError(`invalid id: ${JSON.stringify(id)}`);
    if (help !== undefined && typeof help !== "string")
        throw new ParseKeymapError(`invalid help: ${JSON.stringify(help)}`);

    let keymap: Keymap = new Keymap({ id, help });

    if (id) {
        if (idKeymaps.has(id))
            throw new ParseKeymapError(`duplicate id: ${id}`);
        idKeymaps.set(id, keymap);
    }

    for (var [k, v] of Object.entries(obj)) {
        if (k === "id" || k === "help")
            continue;
        if (k.length === 0 || k.length > 1)
            continue;

        if (isCommand(v)) {
            if (v) { // check v not is empty string
                let action: Action = commandToAction(v);
                keymap.setKey(k, action);
            }
        } else if (isCommandList(v)) {
            let action = new SeqAction(v.map(commandToAction));
            keymap.setKey(k, action);
        } else if (isKeymapTarget(v)) {
            pending.push({
                keymap: keymap,
                key: k,
                target: v.target,
            });
        } else {
            let subKeymap = _parseKeymapConfigObject(idKeymaps, pending, v);
            keymap.setKey(k, subKeymap);
        }
    }

    return keymap;
}

function parseKeymapConfigObject(obj: object): Keymap {
    let idKeymaps = new Map<string, Keymap>();
    let pending: PaddingResolution[] = [];

    let keymap = _parseKeymapConfigObject(idKeymaps, pending, obj);

    for (let item of pending) {
        let subKeymap = idKeymaps.get(item.target);
        if (subKeymap) {
            item.keymap.setKey(item.key, subKeymap);
        }
    }

    return keymap;
}

export {
    parseKeymapConfigObject
};