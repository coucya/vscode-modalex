
import { EventEmitter } from "events";

import { ModalRuntimeError } from "./error";
import { Keymap } from "./keymap";
import { BaseModal, KeymapModal, VisualModal, SearchModal } from "./modal";
import { ModalType, VisualType } from "./modal";

abstract class Editor extends EventEmitter {
    _normalModal: KeymapModal;
    _insertModal: KeymapModal;
    _visualModal: VisualModal;
    _searchModal: SearchModal;

    _currentModal: BaseModal;
    _currentModalType: ModalType;

    constructor(option?: {
        normalModal?: KeymapModal,
        insertModal?: KeymapModal,
        visualModal?: VisualModal,
        searchModal?: SearchModal,
    }) {
        super();
        this._normalModal = option?.normalModal ?? new KeymapModal("normal", this);
        this._insertModal = option?.insertModal ?? new KeymapModal("insert", this);
        this._visualModal = option?.visualModal ?? new VisualModal("visual", this);
        this._searchModal = option?.searchModal ?? new SearchModal("search", this);

        this._currentModal = this._normalModal;
        this._currentModalType = ModalType.normal;
    }

    getCurrentModalType(): ModalType { return this._currentModalType; }
    getCurrentModal(): BaseModal { return this._currentModal; }

    getNormalModal(): KeymapModal { return this._normalModal; }
    getInsertModal(): KeymapModal { return this._insertModal; }
    getVisualModal(): VisualModal { return this._visualModal; }
    getSearchModal(): SearchModal { return this._searchModal; }

    protected setNormalModal(modal: KeymapModal) { this._normalModal = modal; }
    protected setInsertModal(modal: KeymapModal) { this._insertModal = modal; }
    protected setVisualModal(modal: VisualModal) { this._visualModal = modal; }
    protected setSearchModal(modal: SearchModal) { this._searchModal = modal; }

    async _emitkey(key: string) {
        await this._currentModal.onKey(key);
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
        return this._currentModalType === ModalType.visual &&
            (visualType === undefined || this._visualModal.getVisualType() === visualType);
    }
    isSearch() {
        return this._currentModalType === ModalType.search;
    }

    enterMode(modalType: string | ModalType, option?: any,) {
        let modal: BaseModal | null = null;
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


        if (modal && type_) {
            this._currentModal.onWillLeave();

            modal.onWillEnter(option);

            this.resetAll();

            this._currentModal = modal;
            this._currentModalType = type_;
            modal.onDidEnter();

            this.emit("enterMode", type_, this);
        } else {
            throw new ModalRuntimeError(`mode "${modalType}" not found`);
        }
    }
}

export {
    Editor
};