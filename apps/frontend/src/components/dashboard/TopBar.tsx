import logoRed from "@/assets/images/logo_red.png";
import { useAuth } from "../../context/AuthContext";

export function TopBar() {
    const { user } = useAuth();

    return (
        <header className="dash-topbar">
            <div className="topbar-left">
                <button className="dash-hamburger">
                    <i className="bi bi-list"></i>
                </button>
                <div className="dash-brand">
                    <img src={logoRed} alt="logo" width="32" height="32" />
                    <span className="logo-text">redbox<span className="dot">.</span></span>
                </div>
            </div>

            <div className="topbar-right">
                <button className="topbar-icon">
                    <i className="bi bi-grid-3x3-gap-fill"></i>
                </button>
                <div className="user-pill">
                    <div className="user-avatar">
                        <i className="bi bi-cloud-fill"></i>
                    </div>
                    <span className="user-name">{user?.username || "username"}</span>
                </div>
            </div>
        </header>
    );
}