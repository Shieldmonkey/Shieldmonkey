import React, { createContext, useContext, useState, ReactNode } from 'react';
import Modal, { ModalType } from '../Modal';

interface ModalConfig {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: React.ReactNode;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

interface ModalContextType {
    showModal: (type: ModalType, title: string, message: React.ReactNode, onConfirm?: () => void, confirmLabel?: string, cancelLabel?: string) => void;
    closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<ModalConfig>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showModal = (type: ModalType, title: string, message: React.ReactNode, onConfirm?: () => void, confirmLabel?: string, cancelLabel?: string) => {
        setConfig({ isOpen: true, type, title, message, onConfirm, confirmLabel, cancelLabel });
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

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within a ModalProvider');
    return context;
};
