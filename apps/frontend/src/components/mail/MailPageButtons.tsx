interface Props {
    page: number;
    total: number;
    onChange: (p: number) => void;
}

export function MailPageButtons({ page, total, onChange }: Props) {
    if (total <= 1) return null;

    const items: (number | '…')[] = [];

    if (total <= 7) {
        for (let i = 0; i < total; i++) items.push(i);
    } else {
        items.push(0);
        if (page > 2) items.push('…');
        const start = Math.max(1, page - 1);
        const end = Math.min(total - 2, page + 1);
        for (let i = start; i <= end; i++) items.push(i);
        if (page < total - 3) items.push('…');
        items.push(total - 1);
    }

    return (
        <>
            {items.map((item, i) =>
                item === '…'
                    ? <span key={`e${i}`} className="mc-page-ellipsis">…</span>
                    : <button key={item} className={`mc-page-btn ${page === item ? 'mc-page-btn--active' : ''}`} onClick={() => onChange(item as number)}>{(item as number) + 1}</button>
            )}
        </>
    );
}
