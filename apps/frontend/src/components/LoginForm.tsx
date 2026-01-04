import { useState } from "react";
import logoRed from "@/assets/images/logo_red.png";

export function LoginForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!username || !password) {
            setError("Please fill in all fields.");
            return;
        }

        setError("");
        console.log("Login details:", { username, password });
        // auth logic
    };

    return (
        <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-header">
                <img src={logoRed} alt="logo" width="50" height="50" />
                <h2>redbox<span className="dot">.</span></h2>
                <p>Welcome back! Please login to your account.</p>
            </div>

            <div className="login-fields">
                <div className="input-group">
                    <label>Username</label>
                    <input 
                        type="text"
                        placeholder="Username" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required 
                    />
                </div>

                <div className="input-group">
                    <label>Password</label>
                    <input 
                        type="password" 
                        placeholder="••••••••••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                    />
                </div>
                {error && <p className="validation-error">{error}</p>}
            </div>

            <div className="login-actions">
                <button type="submit" className="login-btn-submit">Login</button>
                <div className="help-links">
                    <a href="#">Trouble signing in?</a>
                </div>
            </div>

            <div className="login-footer">
                <p>Don't have an account? <a href="/register">Register</a></p>
                <div className="legal-links">
                    <a href="#">Terms of Service</a>
                    <span className="separator">|</span>
                    <a href="#">Privacy Policy</a>
                </div>
            </div>
        </form>
    );
}