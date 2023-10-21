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

export {
    ModalRuntimeError,
    ParseKeymapError,
    ParseKeysError,
};