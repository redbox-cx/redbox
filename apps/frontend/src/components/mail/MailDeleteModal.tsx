interface Props {
    count: number;
    subject?: string | null;
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function MailDeleteModal({ count, subject, loading, onConfirm, onCancel }: Props) {
    const isSingle = count === 1;
    const title = isSingle ? 'Delete mail?' : 'Delete mails?';
    const fallbackSubject = subject?.trim() || '(No subject)';
    const description = isSingle
        ? `"${fallbackSubject}" will be permanently deleted.`
        : `${count} selected mails will be permanently deleted.`;

    return (
        <div className="confirm-overlay" onClick={loading ? undefined : onCancel}>
            <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                <i className="bi bi-trash3 confirm-modal-icon" />
                <p className="confirm-modal-title">{title}</p>
                <p className="confirm-modal-desc">{description}</p>
                <div className="confirm-modal-actions">
                    <button className="confirm-btn-cancel" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button className="confirm-btn-delete" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
