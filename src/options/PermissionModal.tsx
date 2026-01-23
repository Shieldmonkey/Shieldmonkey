
import React from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';

interface PermissionModalProps {
    isOpen: boolean;
    scriptName: string;
    permissions: string[];
    onConfirm: () => void;
    onCancel: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({
    isOpen,
    scriptName,
    permissions,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <header className="modal-header">
                    <ShieldAlert className="modal-icon" size={24} />
                    <h3>Permission Request</h3>
                </header>

                <div className="modal-body">
                    <p className="modal-warning">
                        The script <strong>{scriptName}</strong> is requesting the following permissions.
                        Allowing these may affect your browser security.
                    </p>

                    <ul className="permission-list">
                        {permissions.map((perm) => (
                            <li key={perm}>
                                <code>{perm}</code>
                            </li>
                        ))}
                    </ul>

                    <p className="modal-warning" style={{ fontSize: '0.85rem', color: '#888' }}>
                        Only allow if you trust the author of this script.
                    </p>
                </div>

                <footer className="modal-footer">
                    <button className="btn-secondary" onClick={onCancel}>
                        <X size={16} /> Deny
                    </button>
                    <button className="btn-primary" onClick={onConfirm} style={{ backgroundColor: '#22c55e' }}>
                        <Check size={16} /> Allow
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default PermissionModal;
