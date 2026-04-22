export function senderColor(_str: string): string {
    return 'var(--color-primary)';
}

export function senderInitial(from: string): string {
    const name = from.match(/^(.+?)\s*</)?.[1]?.trim().replace(/^"|"$/g, '') ?? from;
    return (name[0] ?? '?').toUpperCase();
}

export function parseSender(from: string): { name: string; email: string } {
    const match = from.match(/^(.+?)\s*<(.+?)>$/);
    if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
    return { name: from, email: from };
}

export function formatShort(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (d.getFullYear() === now.getFullYear())
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatFull(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function attachmentIcon(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'bi-file-earmark-image';
    if (mimetype === 'application/pdf') return 'bi-file-earmark-pdf';
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return 'bi-file-earmark-zip';
    if (mimetype.startsWith('text/')) return 'bi-file-earmark-text';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'bi-file-earmark-word';
    if (mimetype.includes('sheet') || mimetype.includes('excel')) return 'bi-file-earmark-excel';
    return 'bi-file-earmark';
}
