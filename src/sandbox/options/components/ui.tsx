import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
    return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
    return <button className={`ui-icon-button ${className}`} aria-label={label} title={label} {...props} />;
}

export function Badge({ tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
    return <span className={`ui-badge ui-badge-${tone} ${className}`} {...props} />;
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={`ui-card ${className}`} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return <label className="ui-field"><span className="ui-field-label">{label}</span>{children}{hint && <span className="ui-field-hint">{hint}</span>}</label>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
    return <input className="ui-input" {...props} />;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
    return <div className="ui-empty"><div className="ui-empty-icon">{icon}</div><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
    return <span className={`ui-skeleton ${className}`} aria-hidden="true" />;
}

export function InlineNotice({ tone = 'info', children, onDismiss }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode; onDismiss?: () => void }) {
    return <div className={`inline-notice inline-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite"><span>{children}</span>{onDismiss && <IconButton label="Dismiss" onClick={onDismiss}>×</IconButton>}</div>;
}
