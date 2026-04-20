import logoRed from '@/assets/images/logo_red.png';

export function BinNav() {
    return (
        <nav className="dl-nav">
            <a href="/" className="dl-nav-brand">
                <img src={logoRed} alt="redbox" width="32" />
                <span className="dl-nav-logo-text">redbox<span className="dot">.</span></span>
            </a>
        </nav>
    );
}
