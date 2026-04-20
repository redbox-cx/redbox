import { useState, useRef } from 'react';
import { ReportService } from '../services/ReportService';

const MAX_FILES = 5;
const MAX_SIZE_MB = 25;
const ACCEPTED = 'image/*,video/*';

interface Props {
    onClose: () => void;
}

export function BugReportModal({ onClose }: Props) {
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [fileError, setFileError] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        setFileError('');
        const next = [...attachments];
        for (const file of Array.from(incoming)) {
            if (next.length >= MAX_FILES) { setFileError(`Max ${MAX_FILES} files.`); break; }
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                setFileError('Only images and videos are allowed.'); continue;
            }
            if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                setFileError(`Each file must be under ${MAX_SIZE_MB} MB.`); continue;
            }
            next.push(file);
        }
        setAttachments(next);
    };

    const removeFile = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
        setFileError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await ReportService.reportBug({
                description,
                ...(email.trim() ? { contactEmail: email.trim() } : {}),
                ...(attachments.length ? { attachments } : {}),
            });
            setSubmitted(true);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to submit report.');
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                {submitted ? (
                    <>
                        <div className="settings-modal-icon" style={{ color: 'var(--color-primary)' }}>
                            <i className="bi bi-check-circle-fill" />
                        </div>
                        <h2 className="settings-modal-title">Report Submitted</h2>
                        <p className="settings-modal-desc">
                            Thanks for helping us improve. We'll look into it.
                        </p>
                        <div className="settings-modal-actions">
                            <button className="settings-modal-cancel" style={{ width: '100%' }} onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="settings-modal-icon">
                            <i className="bi bi-bug-fill" />
                        </div>
                        <h2 className="settings-modal-title">Report a Bug</h2>
                        <p className="settings-modal-desc">
                            Describe what happened and we'll take a look. Attachments (images / videos) are optional.
                        </p>
                        <form onSubmit={handleSubmit} className="settings-modal-form">
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    className="report-reason-input"
                                    placeholder="Describe the bug…"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    maxLength={2000}
                                    rows={5}
                                    required
                                    disabled={loading}
                                    style={{ paddingBottom: '28px' }}
                                />
                                <span className={`char-counter ${description.length >= 2000 ? 'char-counter--limit' : ''}`}>
                                    {description.length} / 2000
                                </span>
                            </div>

                            <div className="shr-input-wrap">
                                <i className="bi bi-envelope shr-input-icon" />
                                <input
                                    className="shr-input"
                                    type="email"
                                    placeholder="Your email (optional)"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={loading}
                                    maxLength={255}
                                />
                            </div>
                            <div
                                className="bug-attach-zone"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="bi bi-paperclip" />
                                <span>
                                    {attachments.length
                                        ? `${attachments.length} / ${MAX_FILES} file${attachments.length > 1 ? 's' : ''} added`
                                        : 'Attach images or videos'}
                                </span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED}
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={e => addFiles(e.target.files)}
                                    disabled={loading || attachments.length >= MAX_FILES}
                                />
                            </div>

                            {attachments.length > 0 && (
                                <ul className="bug-attach-list">
                                    {attachments.map((f, i) => (
                                        <li key={i} className="bug-attach-item">
                                            <i className={`bi ${f.type.startsWith('video/') ? 'bi-camera-video' : 'bi-image'}`} />
                                            <span className="bug-attach-name">{f.name}</span>
                                            <span className="bug-attach-size">{formatSize(f.size)}</span>
                                            <button
                                                type="button"
                                                className="bug-attach-remove"
                                                onClick={() => removeFile(i)}
                                                disabled={loading}
                                            >
                                                <i className="bi bi-x" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {fileError && (
                                <p className="settings-error">
                                    <i className="bi bi-exclamation-triangle" /> {fileError}
                                </p>
                            )}
                            {error && (
                                <p className="settings-error">
                                    <i className="bi bi-exclamation-triangle" /> {error}
                                </p>
                            )}

                            <div className="settings-modal-actions">
                                <button type="button" className="settings-modal-cancel" onClick={onClose} disabled={loading}>
                                    Cancel
                                </button>
                                <button type="submit" className="settings-modal-confirm" disabled={loading || !description.trim()}>
                                    <i className="bi bi-bug" />
                                    {loading ? 'Submitting…' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
