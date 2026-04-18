import { useState, useEffect } from "react";
import logoRed from "../../assets/images/logo_red.png";
import { useAuth } from "../../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { getAvatarSrc } from "../../config/avatars";

const navLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "SecureSphere", to: "/dashboard/securesphere" },
    { label: "Mail", to: "/dashboard/mail" },
    { label: "Upload", to: "/upload" },
    { label: "Shortner", to: "/shortner" },
    { label: "Bin", to: "/bin" },
];

export function TopBar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('menu-open', isMobileMenuOpen);
        return () => { document.documentElement.classList.remove('menu-open'); };
    }, [isMobileMenuOpen]);

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <>
            <nav className="dash-top-nav">
                <div className="nav-left">
                    <Link to="/dashboard" className="nav-brand-link">
                        <img src={logoRed} alt="logo" width="35" />
                        <span className="logo-text">redbox<span className="dot">.</span></span>
                    </Link>
                </div>

                <div className="nav-center">
                    {navLinks.map(link => (
                        <Link key={link.to} to={link.to} className={location.pathname === link.to ? "active" : ""}>{link.label}</Link>
                    ))}
                </div>

                <div className="nav-right">
                    <div className="user-dropdown-wrapper" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                        <div className="user-avatar-dash">
                            {user?.avatar
                                ? <img src={getAvatarSrc(user.avatar)} alt="avatar" className="topbar-avatar-img" />
                                : <i className="bi bi-person-fill"></i>}
                        </div>
                        <span className="user-name-text">{user?.username || "username"}</span>
                        <i className={`bi bi-chevron-down dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}></i>

                        {isDropdownOpen && (
                            <div className="profile-dropdown-menu">
                                <Link to="/user/settings"><i className="bi bi-gear"></i> Settings</Link>
                                <button onClick={logout}><i className="bi bi-box-arrow-right"></i> Logout</button>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    className={`dash-hamburger ${isMobileMenuOpen ? "active" : ""}`}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <div className="line"></div>
                    <div className="line"></div>
                    <div className="line"></div>
                </button>
            </nav>
            <div className={`dash-mobile-menu ${isMobileMenuOpen ? "open" : ""}`}>
                <div className="dash-mobile-header">
                    <div className="nav-left">
                        <img src={logoRed} alt="logo" width="30" />
                        <span className="logo-text">redbox<span className="dot">.</span></span>
                    </div>
                    <button className="dash-mobile-close" onClick={closeMobileMenu}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                <nav className="dash-mobile-links">
                    {navLinks.map(link => (
                        <Link key={link.to} to={link.to} onClick={closeMobileMenu}>
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="dash-mobile-user">
                    <div className="user-avatar-dash">
                        {user?.avatar
                            ? <img src={getAvatarSrc(user.avatar)} alt="avatar" className="topbar-avatar-img" />
                            : <i className="bi bi-person-fill"></i>}
                    </div>
                    <span>{user?.username || "username"}</span>
                </div>
                <div className="dash-mobile-actions">
                    <Link to="/user/settings" onClick={closeMobileMenu}>
                        <i className="bi bi-gear"></i> Settings
                    </Link>
                    <button onClick={() => { closeMobileMenu(); logout(); }}>
                        <i className="bi bi-box-arrow-right"></i> Logout
                    </button>
                </div>
            </div>
        </>
    );
}
