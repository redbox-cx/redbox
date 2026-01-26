import { useState } from "react";

const donationData = [
    {
        name: "Bitcoin",
        symbol: "BTC",
        address: "cryptoaddressbitcoin1",
        qr: "/path-add" 
    },
    {
        name: "Monero",
        symbol: "XMR",
        address: "cryptoaddressmonero1",
        qr: "/path-add" // später adden!
    }
];

export function DonationMethods() {
    const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
    const [activeQR, setActiveQR] = useState<{name: string, img: string} | null>(null);

    const handleCopy = (address: string, symbol: string) => {
        navigator.clipboard.writeText(address);
        setCopiedSymbol(symbol);
        setTimeout(() => setCopiedSymbol(null), 2000);
    };

    const formatAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-8)}`;

    return (
        <div className="donation-grid">
            {donationData.map((coin) => (
                <div 
                    key={coin.symbol} 
                    className="donation-card" 
                    onClick={() => handleCopy(coin.address, coin.symbol)}
                >
                    <div 
                        className="donation-icon-box"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveQR({name: coin.name, img: coin.qr});
                        }}
                        title="Show QR Code"
                    >
                        <i className="bi bi-qr-code"></i>
                    </div>

                    <div className="donation-info">
                        <div className="donation-meta">
                            <h3>{coin.name}</h3>
                            <span className="coin-symbol">{coin.symbol}</span>
                        </div>
                        <code className="donation-address">
                            {copiedSymbol === coin.symbol ? "Address Copied!" : formatAddress(coin.address)}
                        </code>
                    </div>
                    
                    <div className="copy-indicator">
                        <i className={`bi ${copiedSymbol === coin.symbol ? "bi-check-lg" : "bi-copy"}`}></i>
                    </div>
                </div>
            ))}

            {activeQR && (
                <div className="qr-modal-overlay" onClick={() => setActiveQR(null)}>
                    <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="qr-modal-header">
                            <h3>{activeQR.name} QR Code</h3>
                            <button onClick={() => setActiveQR(null)}><i className="bi bi-x-lg"></i></button>
                        </div>
                        <div className="qr-image-container">
                            <img src={activeQR.img} alt="QR Code" />
                        </div>
                        <p>Scan with your mobile phone</p>
                    </div>
                </div>
            )}
        </div>
    );
}