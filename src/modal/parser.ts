
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
    // TODO: id and target.
    // id: string, 
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

function commandToAction(command: Command): Action {
    if (isString(command))
        return new CommandAction(command);
    else
        return new CommandAction(command.command, command.args);
}

function parseKeymapConfigObject(obj: object): Keymap {
    if (typeof obj !== "object" || !obj)
        throw new ParseKeymapError(`invalid keymaps: ${JSON.stringify(obj)}`);

    let help = (obj as any).help;
    if (typeof help !== "string" && help !== undefined)
        throw new ParseKeymapError(`invalid help: ${JSON.stringify(help)}`);

    let keymap: Keymap = new Keymap(help);

    for (var [k, v] of Object.entries(obj)) {
        if (k === "id" || k === "help")
            continue;
        if (k.length === 0 || k.length > 1)
            continue;

        if (isCommand(v)) {
            // check v not is empty string
            if (v) {
                let action: Action = commandToAction(v);
                keymap.setKey(k, action);
            }
        } else if (isCommandList(v)) {
            let action = new SeqAction(v.map(commandToAction));
            keymap.setKey(k, action);
        } else {
            let subKeymap = parseKeymapConfigObject(v);
            keymap.setKey(k, subKeymap);
        }
    }

    return keymap;
}

export {
    parseKeymapConfigObject
};