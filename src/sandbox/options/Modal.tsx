import React, { useEffect } from 'react';
import { BadgeInfo, AlertTriangle, CheckCircle, X } from 'lucide-react';
import './App.css'; // Ensure modal styles are available

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface ModalProps {
    isOpen: boolean;
    type?: ModalType;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    type = 'info',
    title,
    message,
    onClose,
    onConfirm,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel'
}) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose();
            if (isOpen && e.key === 'Enter' && type !== 'confirm') onClose(); // Auto-close alerts on Enter
            if (isOpen && e.key === 'Enter' && type === 'confirm' && onConfirm) onConfirm();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, onConfirm, type]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={28} color="#10b981" />;
            case 'warning': return <AlertTriangle size={28} color="#fbbf24" />;
            case 'error': return <AlertTriangle size={28} color="#ef4444" />;
            case 'confirm': return <BadgeInfo size={28} color="#3b82f6" />;
            default: return <BadgeInfo size={28} color="#64748b" />;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header" style={{ paddingBottom: '12px' }}>
                    <div className="modal-icon-wrapper" style={{ marginRight: '12px', display: 'flex' }}>
                        {getIcon()}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
                </header>

                <div className="modal-body" style={{ padding: '16px 24px 24px', fontSize: '1rem', lineHeight: 1.5, color: 'var(--text-color)' }}>
                    {typeof message === 'string' ? <p style={{ margin: 0 }}>{message}</p> : message}
                </div>

                <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    {(type === 'confirm' || onConfirm) && (
                        <button className="btn-secondary" onClick={onClose} style={{ minWidth: '80px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        className="btn-primary"
                        onClick={onConfirm || onClose}
                        style={{
                            minWidth: '80px',
                            backgroundColor: type === 'error' ? '#ef4444' : 'var(--primary-color)',
                            border: '1px solid rgba(0,0,0,0.2)',
                            borderRadius: '6px',
                            justifyContent: 'center'
                        }}
                    >
                        {confirmLabel}
                    </button>
                </footer>

                <button className="modal-close" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default Modal;
