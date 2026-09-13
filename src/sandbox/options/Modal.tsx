import type { ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, BadgeInfo, CheckCircle, X } from 'lucide-react';

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface ModalProps {
    isOpen: boolean;
    type?: ModalType;
    title: string;
    message: ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

const iconFor = (type: ModalType) => type === 'success'
    ? <CheckCircle aria-hidden="true" />
    : type === 'warning' || type === 'error'
        ? <AlertTriangle aria-hidden="true" />
        : <BadgeInfo aria-hidden="true" />;

export default function Modal({ isOpen, type = 'info', title, message, onClose, onConfirm, confirmLabel = 'OK', cancelLabel = 'Cancel' }: ModalProps) {
    if (type === 'confirm') {
        return <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="modal-overlay" />
                <AlertDialog.Content className="modal-content modal-content-confirm">
                    <div className="modal-header"><span className="modal-icon">{iconFor(type)}</span><AlertDialog.Title>{title}</AlertDialog.Title></div>
                    <AlertDialog.Description asChild><div className="modal-body">{message}</div></AlertDialog.Description>
                    <div className="modal-footer">
                        <AlertDialog.Cancel asChild><button className="ui-button ui-button-secondary">{cancelLabel}</button></AlertDialog.Cancel>
                        <AlertDialog.Action asChild><button className="ui-button ui-button-danger" onClick={onConfirm}>{confirmLabel}</button></AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>;
    }

    return <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
        <Dialog.Portal>
            <Dialog.Overlay className="modal-overlay" />
            <Dialog.Content className={`modal-content modal-content-${type}`}>
                <div className="modal-header"><span className="modal-icon">{iconFor(type)}</span><Dialog.Title>{title}</Dialog.Title></div>
                <Dialog.Description asChild><div className="modal-body">{message}</div></Dialog.Description>
                <div className="modal-footer"><button className="ui-button ui-button-primary" onClick={onConfirm || onClose}>{confirmLabel}</button></div>
                <Dialog.Close asChild><button className="modal-close ui-icon-button" aria-label="Close"><X size={18} /></button></Dialog.Close>
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
