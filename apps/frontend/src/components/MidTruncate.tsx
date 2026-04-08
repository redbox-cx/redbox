import { useEffect, useRef, useState } from 'react';

function midTruncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const half = Math.floor((maxLen - 1) / 2);
    return text.slice(0, half) + '…' + text.slice(text.length - (maxLen - 1 - half));
}

export function MidTruncate({ text, className }: { text: string; className?: string }) {
    const spanRef = useRef<HTMLSpanElement>(null);
    const [display, setDisplay] = useState(text);

    useEffect(() => {
        const el = spanRef.current;
        if (!el) return;

        const compute = () => {
            const availW = el.clientWidth;
            if (!availW) return;

            const font = getComputedStyle(el).font;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            ctx.font = font;

            if (ctx.measureText(text).width <= availW) {
                setDisplay(text);
                return;
            }

            let lo = 3, hi = text.length - 1;
            while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                if (ctx.measureText(midTruncate(text, mid)).width <= availW) {
                    lo = mid;
                } else {
                    hi = mid - 1;
                }
            }
            setDisplay(midTruncate(text, lo));
        };

        const ro = new ResizeObserver(compute);
        ro.observe(el);
        const raf = requestAnimationFrame(compute);
        return () => { ro.disconnect(); cancelAnimationFrame(raf); };
    }, [text]);

    return (
        <span
            ref={spanRef}
            className={className}
            title={text}
            style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
            {display}
        </span>
    );
}
