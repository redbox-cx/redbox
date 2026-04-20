import logoRed from "@/assets/images/logo_red.png";
import { RecoverForm } from "../components/RecoverForm";

export function Recover() {
    return (
        <div className="login-page login-page--phrase">
            <a href="/" className="back-home-brand">
                <img src={logoRed} alt="logo" width="32" height="32" />
                <span className="logo-text">redbox<span className="dot">.</span></span>
            </a>
            <div className="login-container login-container--wide recover-container">
                <RecoverForm />
            </div>
        </div>
    );
}
