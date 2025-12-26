import { useState } from "react";
import logoRed from "@/assets/images/logo_red.png"
import "@/styles/global.css"

const menuItems = [
  {
    name: "Services",
    path: "#",
    submenu: [
      { name: "SecureSphere", path: "#", icon: logoRed },
      { name: "Email", path: "#", icon: logoRed },
      { name: "ToolSet", path: "#", icon: logoRed },
      { name: "ToolSet", path: "#", icon: logoRed },
    ],
  },
  { name: "About", path: "#" },
  { name: "Blog", path: "#" },
  { name: "Contact", path: "#" },
  { name: "Donate", path: "#" },
];

function Menu({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
    const [subOpen, setSubOpen] = useState(false);

    return (
        <div className={`menu-wrapper ${isOpen ? "open" : ""}`}>
            <div className="menu-scroll-area">
                <ul className="menu-container">
                    {menuItems.map((item) => (
                        <li key={item.name} className="menu-item">
                            <a 
                                href={item.path} 
                                onClick={(e) => {
                                    if (item.submenu) {
                                        e.preventDefault();
                                        setSubOpen(!subOpen);
                                    } else {
                                        setIsOpen(false);
                                    }
                                }}
                            >
                                {item.name}
                                {item.submenu && (
                                    <span className={`chevron-icon ${subOpen ? "active" : ""}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-chevron-down" viewBox="0 0 16 16">
                                            <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
                                        </svg>
                                    </span>
                                )}
                            </a>
                            {item.submenu && (
                                <div className={`submenu ${subOpen ? "mobile-show" : ""}`}>
                                    {item.submenu.map((sub, index) => (
                                        <a key={index} href={sub.path} className="submenu-card" onClick={() => setIsOpen(false)}>
                                            <div className="submenu-icon">
                                                <img src={sub.icon} alt={sub.name} width="24" height="24" />
                                            </div>
                                            <span className="submenu-text">{sub.name}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
            <button className="mobile-login-btn">Login</button>
        </div>
    );
}

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="navbar">
            <a>
            <div className="nav-group-left">
                <a href="/" className="logo-link">
                    <div className="nav-group-left">
                        <img src={logoRed} alt="logo" width="42" height="42" />
                        <span className="logo-text">redbox<span className="dot">.</span></span>
                    </div>
                </a>
                <Menu isOpen={isOpen} setIsOpen={setIsOpen} />
            </div>
            </a>
            <div className="nav-group-right">
                <button className="login-btn desktop-login">Login</button>

                <button className={`hamburger ${isOpen ? "active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
                    <div className="line"></div>
                    <div className="line"></div>
                    <div className="line"></div>
                </button>
            </div>
        </nav>
    );
}