import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MailListItem } from "../../services/MailService";

interface Props {
    title: string;
    icon: string;
    count: number;
    storageMb?: number;
    mails?: MailListItem[];
}

function senderInitial(from: string): string {
    const name = from.match(/^(.+?)\s*</)?.[1]?.trim().replace(/^"|"$/g, '') ?? from;
    return (name[0] ?? '?').toUpperCase();
}

function parseSenderName(from: string): string {
    const match = from.match(/^(.+?)\s*<.+?>$/);
    return match ? match[1].trim().replace(/^"|"$/g, '') : from;
}

function formatShort(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function NotificationWidget({ title, icon, count, storageMb, mails }: Props) {
    const [isSlidDown, setIsSlidDown] = useState(false);
    const hasMails = mails && mails.length > 0;
    const navigate = useNavigate();

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className={icon}></i> {title}</div>
            <div className="glass-panel notif-box">
                <div className="widget-header">
                    <h3>{title === "Mail Notifications" ? "Inbox" : "Notifications"}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {storageMb !== undefined && (
                            <span className="notif-storage-label">{storageMb} MB / 500 MB</span>
                        )}
                        <span className={`red-badge ${count === 0 ? 'zero' : ''}`}>{count}</span>
                    </div>
                </div>
                <div className={`content-window${mails !== undefined ? ' content-window--fixed' : ''}`}>
                    <div className={`content-list ${!isSlidDown ? 'is-blurred' : ''}`}>
                        {hasMails ? (
                            <div className="notif-mail-list">
                                {mails!.slice(0, 6).map(mail => (
                                    <div
                                        key={mail.id}
                                        className="notif-mail-item"
                                        onClick={() => navigate('/mail', { state: { openMailId: mail.id } })}
                                    >
                                        <div className="notif-mail-avatar">
                                            {senderInitial(mail.from)}
                                        </div>
                                        <div className="notif-mail-body">
                                            <span className="notif-mail-from">{parseSenderName(mail.from)}</span>
                                            <span className="notif-mail-subject">{mail.subject || '(No subject)'}</span>
                                        </div>
                                        <span className="notif-mail-time">{formatShort(mail.createdAt)}</span>
                                    </div>
                                ))}
                                {mails!.length > 6 ? (
                                    <Link to="/mail" className="notif-mail-more">
                                        +{mails!.length - 6} more unread
                                    </Link>
                                ) : (
                                    <span className="notif-mail-end">You're all caught up</span>
                                )}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon-circle"><i className="bi bi-patch-check"></i></div>
                                <p>No new {title.toLowerCase()} messages</p>
                                <span>Your workspace is up to date</span>
                            </div>
                        )}
                    </div>
                    <div className={`glass-slider ${isSlidDown ? 'slid-down' : ''}`}>
                        <div className="slider-handle" onClick={() => setIsSlidDown(!isSlidDown)}>
                            <div className="handle-track"><div className="handle-dot"></div></div>
                            <button className="slider-toggle-btn" tabIndex={-1}>
                                <i className={`bi bi-chevron-${isSlidDown ? 'up' : 'down'}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
