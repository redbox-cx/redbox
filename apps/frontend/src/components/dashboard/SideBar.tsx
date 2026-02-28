import { useAuth } from "../../context/AuthContext";

export function SideBar() {
    const { logout } = useAuth();

    return (
        <aside className="dash-sidebar">
            <nav className="sidebar-links">
                <a href="/dashboard" className="active">
                    <i className="bi bi-house-door-fill"></i> Home
                </a>
                <a href="/dashboard/account">
                    <i className="bi bi-person-fill"></i> Account
                </a>
                <a href="/dashboard/friends">
                    <i className="bi bi-people-fill"></i> Friends
                </a>
                <a href="/dashboard/help">
                    <i className="bi bi-info-circle-fill"></i> Help
                </a>
            </nav>
            
            <button className="sidebar-logout" onClick={logout}>
                <i className="bi bi-box-arrow-left"></i> Logout
            </button>
        </aside>
    );
}