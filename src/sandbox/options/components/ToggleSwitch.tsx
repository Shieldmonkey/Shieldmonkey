import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, disabled, ariaLabel = 'Toggle setting' }) => (
    <label className={`switch ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} data-state={checked ? 'on' : 'off'}>
        <input type="checkbox" role="switch" aria-label={ariaLabel} aria-checked={checked} checked={checked} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
        <span className="slider" aria-hidden="true"><span className="switch-state">{checked ? 'ON' : 'OFF'}</span></span>
    </label>
);

export default ToggleSwitch;
