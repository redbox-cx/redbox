import logoRed from "@/assets/images/logo_red.png";
import { LoginForm } from "../components/LoginForm";

export function Login() {
    return (
        <div className="login-page">
            <a href="/" className="back-home-brand">
                <img src={logoRed} alt="logo" width="32" height="32" />
                <span className="logo-text">redbox<span className="dot">.</span></span>
            </a>

            <div className="login-container">
                <LoginForm />
            </div>
        </div>
    );
}