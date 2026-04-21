import { useState } from "react";
import { Link } from "react-router-dom";
import logoRed from "@/assets/images/logo_red.png"
import securesphereIcon from "@/assets/svg/securesphere-logo.svg"
import mailIcon from "@/assets/svg/mail-logo.svg"
import toolsetIcon from "@/assets/svg/toolset-logo.svg"
import "@/styles/global.css"

const menuItems = [
  {
    name: "Services",
    path: "#",
    submenu: [
      { name: "SecureSphere", path: "/about/securesphere", icon: securesphereIcon },
      { name: "Email", path: "/about/mail", icon: mailIcon },
      { name: "ToolSet", path: "#", icon: toolsetIcon },
    ],
  },
  { name: "About", path: "/about" },
  { name: "Blog", path: "/blog" },
  { name: "Contact", path: "/contact" },
];

function Menu({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
    const [subOpen, setSubOpen] = useState(false);

    return (
        <div className={`menu-wrapper ${isOpen ? "open" : ""}`}>
            <div className="menu-scroll-area">
                <ul className="menu-container">
                    {menuItems.map((item) => (
                        <li key={item.name} className="menu-item">
                            {item.submenu ? (
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); setSubOpen(!subOpen); }}
                                >
                                    {item.name}
                                    <span className={`chevron-icon ${subOpen ? "active" : ""}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-chevron-down" viewBox="0 0 16 16">
                                            <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                                        </svg>
                                    </span>
                                </a>
                            ) : (
                                <Link to={item.path} onClick={() => setIsOpen(false)}>{item.name}</Link>
                            )}
                            {item.submenu && (
                                <div className={`submenu ${subOpen ? "mobile-show" : ""}`}>
                                    {item.submenu.map((sub, index) => (
                                        <Link key={index} to={sub.path} className="submenu-card" onClick={() => setIsOpen(false)}>
                                            <div className="submenu-icon">
                                                <img src={sub.icon} alt={sub.name} width="24" height="24" />
                                            </div>
                                            <span className="submenu-text">{sub.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
            <Link to="/login" className="mobile-login-btn" onClick={() => setIsOpen(false)}>Login</Link>
        </div>
    );
}

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const logo = logoRed;

    return (
        <nav className="navbar">
            <div className="nav-group-left">
                <Link to="/" className="logo-link">
                    <div className="nav-group-left">
                        <img src={logo} alt="logo" width="42" height="42" />
                        <span className="logo-text">redbox<span className="dot">.</span></span>
                    </div>
                </Link>
                <Menu isOpen={isOpen} setIsOpen={setIsOpen} />
            </div>
            <div className="nav-group-right">
                    <Link to="/login" className="login-btn desktop-login">Login</Link>

                <button className={`hamburger ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
                    <div className="line"></div>
                    <div className="line"></div>
                    <div className="line"></div>
                </button>
            </div>
        </nav>
    );
}