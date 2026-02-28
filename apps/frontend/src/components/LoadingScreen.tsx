import logoRed from "@/assets/images/logo_red.png";

export function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <img src={logoRed} alt="logo" className="loading-logo" />
                <div className="loading-text">
                    redbox<span className="dot">.</span>
                    <div className="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        </div>
    );
}