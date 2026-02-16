import React, { createContext } from 'react';
import { type ModalType } from '../Modal';

export interface ModalContextType {
    showModal: (type: ModalType, title: string, message: React.ReactNode, onConfirm?: () => void, confirmLabel?: string, cancelLabel?: string) => void;
    closeModal: () => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);
