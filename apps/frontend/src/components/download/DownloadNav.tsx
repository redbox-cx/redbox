import logoRed from '../../assets/images/logo_red.png';

export function DownloadNav() {
    return (
        <nav className="dl-nav">
            <a href="/" className="dl-nav-brand">
                <img src={logoRed} alt="redbox" width="32" />
                <span className="logo-text" style={{ display: 'inline' }}>redbox<span className="dot">.</span></span>
            </a>
        </nav>
    );
}
