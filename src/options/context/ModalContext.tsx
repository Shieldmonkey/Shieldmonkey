import React, { useState, type ReactNode } from 'react';
import Modal, { type ModalType } from '../Modal';
import { ModalContext } from './ModalContextDefinition';

interface ModalConfig {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: React.ReactNode;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<ModalConfig>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showModal = (type: ModalType, title: string, message: React.ReactNode, onConfirm?: () => void, confirmLabel?: string, cancelLabel?: string) => {
        const handleConfirm = () => {
            if (onConfirm) onConfirm();
            closeModal();
        };
        setConfig({ isOpen: true, type, title, message, onConfirm: handleConfirm, confirmLabel, cancelLabel });
    };

    const closeModal = () => {
        setConfig(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <ModalContext.Provider value={{ showModal, closeModal }}>
            {children}
            <Modal
                isOpen={config.isOpen}
                type={config.type}
                title={config.title}
                message={config.message}
                onConfirm={config.onConfirm}
                onClose={closeModal}
                confirmLabel={config.confirmLabel}
                cancelLabel={config.cancelLabel}
            />
        </ModalContext.Provider>
    );
};


