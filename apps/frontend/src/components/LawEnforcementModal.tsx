interface Props {
    onClose: () => void;
}

export function LawEnforcementModal({ onClose }: Props) {
    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                <div className="settings-modal-icon">
                    <i className="bi bi-shield-lock-fill" />
                </div>
                <h2 className="settings-modal-title">Law Enforcement Requests</h2>
                <p className="settings-modal-desc">
                    A dedicated law enforcement portal isn't available yet. For legal requests or inquiries, please contact us directly at <strong>support@redbox.cx</strong>.
                </p>
                <div className="settings-modal-actions">
                    <button className="settings-modal-cancel" onClick={onClose}>Cancel</button>
                    <a href="mailto:support@redbox.cx" className="settings-modal-confirm" style={{ textDecoration: 'none' }}>
                        <i className="bi bi-envelope" /> Email us
                    </a>
                </div>
            </div>
        </div>
    );
}
