import type { FileEntry } from '../../services/FileService';

interface Props {
    entry: FileEntry;
    onConfirm: () => void;
    onCancel: () => void;
}

export function UploadDeleteModal({ entry, onConfirm, onCancel }: Props) {
    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                <i className="bi bi-trash3 confirm-modal-icon" />
                <p className="confirm-modal-title">Delete file?</p>
                <p className="confirm-modal-desc">"{entry.originalName}" will be permanently deleted.</p>
                <div className="confirm-modal-actions">
                    <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="confirm-btn-delete" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}
