import { useState } from "react";
import logoRed from "@/assets/images/logo_red.png";

export function RegisterForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setError("");
        console.log("Registration details:", { username, password, inviteCode });
    };

    return (
        <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-header">
                <img src={logoRed} alt="logo" width="50" height="50" />
                <h2>redbox<span className="dot">.</span></h2>
                <p>Create your private account.</p>
            </div>

            <div className="login-fields">
                <div className="input-group">
                    <label>Username</label>
                    <input 
                        type="text" 
                        placeholder="Choose a username" 
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

                <div className="input-group">
                    <label>Invite Code</label>
                    <input 
                        type="text" 
                        placeholder="Enter your invitation code" 
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        required 
                    />
                </div>
                {error && <p className="validation-error">{error}</p>}
            </div>

            <div className="login-actions">
                <button type="submit" className="login-btn-submit">Register</button>
            </div>

            <div className="login-footer">
                <p>Already have an account? <a href="/login">Login</a></p>
                <div className="legal-links">
                    <a href="#">Terms of Service</a>
                    <span className="separator">|</span>
                    <a href="#">Privacy Policy</a>
                </div>
            </div>
        </form>
    );
}