import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthService } from "../services/AuthService";
import logoRed from "@/assets/images/logo_red.png";

export function RegisterForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== passwordConfirm) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            const data = await AuthService.register({ 
                username, 
                password, 
                passwordConfirm,
                inviteCode 
            });
            
            login(data.access_token, data.user);
            navigate("/dashboard");
        } catch (err: any) {
            const message = err.response?.data?.message;
            
            if (Array.isArray(message)) {
                setError(message[0]);
            } else {
                setError(message || "Registration failed.");
            }
        } finally {
            setIsLoading(false);
        }
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
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                        required 
                    />
                </div>

                <div className="input-group">
                    <label>Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required 
                    />
                </div>
                
                <div className="input-group">
                    <label>Confirm Password</label>
                    <input 
                        type="password" 
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        disabled={isLoading}
                        required 
                    />
                </div>

                <div className="input-group">
                    <label>Invite Code</label>
                    <input 
                        type="text" 
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        disabled={isLoading}
                    />
                </div>
                {error && <p className="validation-error">{error}</p>}
            </div>

            <div className="login-actions">
                <button type="submit" className="login-btn-submit" disabled={isLoading}>
                    {isLoading ? "Registering..." : "Register"}
                </button>
            </div>

            <div className="login-footer">
                <p>Already have an account? <a href="/login">Login</a></p>
            </div>
        </form>
    );
}