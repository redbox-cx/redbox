import { useState } from "react";
import logoRed from "../../assets/images/logo_red.png";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";

export function TopBar() {
    const { user, logout } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    return (
        <nav className="dash-top-nav">
            <div className="nav-left">
                <Link to="/"><img src={logoRed} alt="logo" width="35" /></Link>
                <span className="logo-text">redbox<span className="dot">.</span></span>
            </div>
            
            <div className="nav-center">
                <Link to="/dashboard" className="active">Dashboard</Link>
                <Link to="/dashboard/securesphere">SecureSphere</Link>
                <Link to="/dashboard/mail">Mail</Link>
                <Link to="/dashboard/upload">Upload</Link>
                <Link to="/dashboard/shortner">Shortner</Link>
                <Link to="/dashboard/bin">Bin</Link>
            </div>

            <div className="nav-right">
                <div className="user-dropdown-wrapper" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <div className="user-avatar-dash">
                        <i className="bi bi-cloud-fill"></i>
                    </div>
                    <span className="user-name-text">{user?.username || "username"}</span>
                    <i className={`bi bi-chevron-down dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}></i>
                    
                    {isDropdownOpen && (
                        <div className="profile-dropdown-menu">
                            <Link to="/settings"><i className="bi bi-gear"></i> Settings</Link>
                            <button onClick={logout}><i className="bi bi-box-arrow-right"></i> Logout</button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}