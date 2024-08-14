import { Action } from "./action";

class Keymap {
    _id: string | null;
    _help: string | null;
    _maps: Map<string, Keymap | Action>;

    constructor(options?: { id?: string, help?: string; }) {
        this._id = options?.id ?? null;
        this._help = options?.help ?? null;
        this._maps = new Map();
    }

    getId(): string | undefined {
        return this._id ?? undefined;
    }

    getHelp(): string {
        return this._help ?? "";
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

export {
    Keymap
};
