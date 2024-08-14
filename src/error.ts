
export class ExtensionError extends Error {
    _origin: any;
    constructor(message: string, origin?: any) {
        super(message);
        this._origin = origin;
    }
}
