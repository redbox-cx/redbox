import { useState } from "react";

interface Props {
    title: string;
    icon: string;
    count: number;
}

export function NotificationWidget({ title, icon, count }: Props) {
    const [isSlidDown, setIsSlidDown] = useState(false);

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className={icon}></i> {title}</div>
            <div className="glass-panel notif-box">
                <div className="widget-header">
                    <h3>{title === "Mail Notifications" ? "Inbox" : "Notifications"}</h3>
                    <span className={`red-badge ${count === 0 ? 'zero' : ''}`}>{count}</span>
                </div>
                <div className="content-window">
                    <div className={`content-list ${!isSlidDown ? 'is-blurred' : ''}`}>
                        <div className="empty-state">
                            <div className="empty-icon-circle"><i className="bi bi-patch-check"></i></div>
                            <p>No new {title.toLowerCase()} messages</p>
                            <span>Your workspace is up to date</span>
                        </div>
                    </div>
                    <div className={`glass-slider ${isSlidDown ? 'slid-down' : ''}`}>
                        <div className="slider-handle">
                            <div className="handle-track"><div className="handle-dot"></div></div>
                            <button className="slider-toggle-btn" onClick={() => setIsSlidDown(!isSlidDown)}>
                                <i className={`bi bi-chevron-${isSlidDown ? 'up' : 'down'}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}