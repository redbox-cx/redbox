import type { BinEntry } from '../../services/BinService';

interface Props {
    entry: BinEntry;
    onConfirm: () => void;
    onCancel: () => void;
}

export function BinDeleteModal({ entry, onConfirm, onCancel }: Props) {
    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                <i className="bi bi-trash3 confirm-modal-icon" />
                <p className="confirm-modal-title">Delete bin?</p>
                <p className="confirm-modal-desc">"{entry.title || 'Untitled Bin'}" will be permanently deleted.</p>
                <div className="confirm-modal-actions">
                    <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="confirm-btn-delete" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}
