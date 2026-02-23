import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled }) => (
    <label className={`switch ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
        <span className="slider"></span>
    </label>
);

export default ToggleSwitch;
