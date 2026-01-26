import { useState } from "react";
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
                        <li><a href="/">Home</a></li>
                        <li><a href="#">Services</a></li>
                        <li><a href="/about">About</a></li>
                        <li><a href="/blog">Blog</a></li>
                        <li><a href="/contact">Contact</a></li>
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
                        <a href="#"><i className="bi bi-github"></i></a>
                        <a href="#"><i className="bi bi-discord"></i></a>
                        <a href="#"><i className="bi bi-twitter-x"></i></a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} redbox Platform. All rights reserved.</p>
                <div className="footer-legal">
                    <a href="#">Terms of Service</a>
                    <a href="#">Privacy Policy</a>
                </div>
            </div>
        </footer>
    );
}