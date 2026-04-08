import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { TopBar } from "../components/dashboard/TopBar";
import { LinksWidget } from "../components/dashboard/LinksWidget";
import { StorageWidget } from "../components/dashboard/StorageWidget";
import { NotificationWidget } from "../components/dashboard/NotificationWidget";
import { BinsWidget } from "../components/dashboard/BinsWidget";

export function DashBoard() {
    const { user } = useAuth();

    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => {
            document.documentElement.classList.remove('dash-page');
        };
    }, []);

    return (
        <div className="dash-layout">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            <TopBar />
            <main className="dash-container">
                <h1 className="dash-greeting">Hello, {user?.username || "Guest"}</h1>
                <div className="dash-grid-layout">
                    <div className="dash-left-col">
                        <NotificationWidget title="SecureSphere" icon="bi bi-shield-lock" count={0} />
                    </div>
                    <div className="dash-right-col">
                        <div className="mail-row">
                            <NotificationWidget title="Mail Notifications" icon="bi bi-envelope" count={0} />
                        </div>
                        <div className="dash-bottom-row">
                            <LinksWidget />
                            <StorageWidget />
                            <BinsWidget />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}