interface Props {
    email: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}

export function BlockSenderModal({ email, onConfirm, onCancel, loading }: Props) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title"><i className="bi bi-slash-circle" /> Block Sender</h2>
                    <button className="modal-close-btn" onClick={onCancel} disabled={loading}>
                        <i className="bi bi-x-lg" />
                    </button>
                </div>
                <div className="modal-body">
                    <p className="block-sender-desc">
                        Are you sure you want to block <strong>{email}</strong>?
                        <br />
                        Future emails from this address will be ignored.
                    </p>
                </div>
                <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button className="modal-confirm-btn danger" onClick={onConfirm} disabled={loading}>
                        {loading ? <><i className="bi bi-hourglass-split" /> Blocking…</> : <><i className="bi bi-slash-circle" /> Block</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
