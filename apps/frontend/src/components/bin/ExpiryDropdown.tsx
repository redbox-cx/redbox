import { useState, useEffect, useRef } from 'react';

const EXPIRY_OPTIONS = [
    { label: '1 hour',   value: '1h' },
    { label: '24 hours', value: '24h' },
    { label: '7 days',   value: '7d' },
    { label: '30 days',  value: '30d' },
    { label: 'Never',    value: 'never' },
];

interface Props {
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
    allowNever?: boolean;
}

export function ExpiryDropdown({ value, onChange, disabled, allowNever = true }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const options = allowNever ? EXPIRY_OPTIONS : EXPIRY_OPTIONS.filter(o => o.value !== 'never');
    const selected = options.find(o => o.value === value) ?? options[3];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="bin-dropdown" ref={ref}>
            <button type="button" className="bin-dropdown-btn" onClick={() => !disabled && setOpen(v => !v)} disabled={disabled}>
                <i className="bi bi-clock" />
                <span>{selected.label}</span>
                <i className={`bi bi-chevron-${open ? 'up' : 'down'} bin-dropdown-chevron`} />
            </button>
            {open && (
                <div className="bin-dropdown-menu">
                    {options.map(o => (
                        <button key={o.value} type="button"
                            className={`bin-dropdown-item ${o.value === value ? 'active' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.label}
                            {o.value === value && <i className="bi bi-check-lg" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
