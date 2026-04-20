import { useRef } from 'react';
import type { MailDetail, MailFolder, MailAttachment } from '../../services/MailService';
import { senderColor, senderInitial, parseSender, formatFull, formatBytes, attachmentIcon } from './mailUtils';

interface Props {
    selected: MailDetail | null;
    loadingDetail: boolean;
    downloadingId: string | null;
    mobileView: 'list' | 'detail';
    onBack: () => void;
    onReadStatus: (id: string, isRead: boolean) => void;
    onMove: (id: string, dest: MailFolder) => void;
    onBlockSender: (email: string) => void;
    onDelete: (id: string) => void;
    onDownloadAttachment: (att: MailAttachment) => void;
}

export function MailDetailPanel({
    selected, loadingDetail, downloadingId, mobileView,
    onBack, onReadStatus, onMove, onBlockSender, onDelete, onDownloadAttachment,
}: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const handleIframeLoad = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        try {
            const body = iframe.contentDocument?.body;
            if (body) iframe.style.height = `${body.scrollHeight + 32}px`;
        } catch {}
    };

    return (
        <div className={`upload-drive-right ${mobileView === 'list' ? 'mc-hidden-mobile' : ''}`}>
            <div className="bin-tab-row">
                <div className="widget-tab bin-mode-tab bin-tab-active mc-tab-label">
                    <i className="bi bi-envelope-open" /> View
                </div>
            </div>

            <div className="mc-right glass-panel">
                <div className="mc-view-toolbar">
                    <button className="mc-view-back-btn" disabled={!selected}
                        onClick={() => { onBack(); }}>
                        <i className="bi bi-arrow-left" />
                    </button>
                    <div className="mc-view-pill">
                        <button className="mc-view-btn" disabled={!selected}
                            onClick={() => selected && onReadStatus(selected.id, !selected.isRead)}>
                            <i className={`bi bi-envelope${selected?.isRead ? '' : '-open'}`} />
                            <span className="mc-view-tooltip">{selected?.isRead ? 'Mark unread' : 'Mark read'}</span>
                        </button>
                        <button className="mc-view-btn" disabled={!selected}
                            onClick={() => selected && onMove(selected.id, 'archive')}>
                            <i className="bi bi-archive" />
                            <span className="mc-view-tooltip">Archive</span>
                        </button>
                        <button className="mc-view-btn" disabled={!selected}
                            onClick={() => { if (selected) { const s = parseSender(selected.from); onBlockSender(s.email); } }}>
                            <i className="bi bi-slash-circle" />
                            <span className="mc-view-tooltip">Block sender</span>
                        </button>
                        <button className="mc-view-btn danger" disabled={!selected}
                            onClick={() => selected && onDelete(selected.id)}>
                            <i className="bi bi-trash3" />
                            <span className="mc-view-tooltip">Delete</span>
                        </button>
                    </div>
                </div>

                {loadingDetail ? (
                    <div className="empty-bins"><i className="bi bi-hourglass-split" /><span>Loading…</span></div>
                ) : selected ? (
                    <div className="mc-detail-content">
                        <div className="mc-detail-header">
                            <h2 className="mc-detail-subject">{selected.subject || '(No subject)'}</h2>
                            <div className="mc-detail-sender-row">
                                <div className="mc-detail-avatar" style={{ background: senderColor(selected.from) }}>
                                    {senderInitial(selected.from)}
                                </div>
                                <div className="mc-detail-sender-info">
                                    {(() => {
                                        const s = parseSender(selected.from);
                                        return (
                                            <>
                                                {s.name !== s.email && <span className="mc-detail-sender-name">{s.name}</span>}
                                                <span className="mc-detail-sender-email">{s.email}</span>
                                            </>
                                        );
                                    })()}
                                </div>
                                <span className="mc-detail-ts">{formatFull(selected.createdAt)}</span>
                            </div>
                        </div>

                        {selected.attachments?.length > 0 && (
                            <div className="mc-attachments">
                                <p className="mc-attachments-label">
                                    <i className="bi bi-paperclip" /> {selected.attachments.length} attachment{selected.attachments.length !== 1 ? 's' : ''}
                                </p>
                                <div className="mc-attachments-list">
                                    {selected.attachments.map(att => (
                                        <button
                                            key={att.id}
                                            className={`mc-attachment-item ${downloadingId === att.id ? 'mc-attachment-item--loading' : ''}`}
                                            onClick={() => onDownloadAttachment(att)}
                                            disabled={downloadingId === att.id}
                                            title={att.filename}
                                        >
                                            <i className={`bi ${attachmentIcon(att.mimetype)} mc-attachment-icon`} />
                                            <span className="mc-attachment-name">{att.filename}</span>
                                            <span className="mc-attachment-size">{formatBytes(att.size)}</span>
                                            <i className={`bi bi-${downloadingId === att.id ? 'hourglass-split' : 'download'} mc-attachment-dl`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mc-iframe-wrap">
                            <iframe
                                ref={iframeRef}
                                className="mc-iframe"
                                srcDoc={`<style>body{font-family:'Montserrat',sans-serif;margin:0;padding:0;}</style>${selected.content}`}
                                sandbox="allow-same-origin"
                                onLoad={handleIframeLoad}
                                title="Mail content"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="empty-bins">
                        <i className="bi bi-envelope-open" />
                        <span>Select a message to read</span>
                    </div>
                )}
            </div>
        </div>
    );
}
