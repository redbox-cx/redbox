import { useState } from "react";
import { Link } from "react-router-dom";
import logoRed from "@/assets/images/logo_red.png";

/* address shortner */
const formatAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
};

export function Footer() {
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

    const handleCopy = (address: string, label: string) => {
        navigator.clipboard.writeText(address);
        setCopiedLabel(label);
        setTimeout(() => setCopiedLabel(null), 1500); 
    };

    const cryptoAddrs = [
        { label: "BTC", full: "cryptoadreessbitcoin1" },
        { label: "XMR", full: "cryptoadreessmonero1" }
    ];

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <div className="footer-logo">
                        <img src={logoRed} alt="logo" width="35" height="35" />
                        <span className="logo-text">redbox<span className="dot">.</span></span>
                    </div>
                    <p className="footer-bio">
                        A student-run platform dedicated to providing secure, private, and simple utility tools.
                    </p>
                </div>

                <div className="footer-column">
                    <h4>Navigation</h4>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">Services</Link></li>
                        <li><Link to="/about">About</Link></li>
                        <li><Link to="/blog">Blog</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                    </ul>
                </div>

                <div className="footer-column">
                    <h4>Donate (Crypto)</h4>
                    {cryptoAddrs.map((coin) => (
                        <div 
                            key={coin.label} 
                            className="crypto-address" 
                            onClick={() => handleCopy(coin.full, coin.label)}
                            title="Click to copy"
                        >
                            <span>{coin.label}</span>
                            <code>{copiedLabel === coin.label ? "Copied!" : formatAddress(coin.full)}</code>
                        </div>
                    ))}
                    <p className="crypto-note">Support our infrastructure.</p>
                </div>

                <div className="footer-column">
                    <h4>Follow Us</h4>
                    <div className="social-links">
                        <a href="https://github.com/redbox-cx" target="_blank" rel="noreferrer"><i className="bi bi-github"></i></a>
                        <a href="https://github.com/no-e1" target="_blank" rel="noreferrer" className="footer-avatar-link" title="no-e1">
                            <img src="https://avatars.githubusercontent.com/u/133690936" alt="no-e1" className="footer-avatar" />
                        </a>
                        <a href="https://github.com/henryzyy" target="_blank" rel="noreferrer" className="footer-avatar-link" title="henryzyy">
                            <img src="https://avatars.githubusercontent.com/u/99895205" alt="henryzyy" className="footer-avatar" />
                        </a>
                        <a href="https://github.com/maksym981" target="_blank" rel="noreferrer" className="footer-avatar-link" title="maksym981">
                            <img src="https://avatars.githubusercontent.com/u/64797492" alt="maksym981" className="footer-avatar" />
                        </a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} redbox Platform. All rights reserved.</p>
                <div className="footer-legal">
                    <Link to="/terms">Terms of Service</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                </div>
            </div>
        </footer>
    );
}