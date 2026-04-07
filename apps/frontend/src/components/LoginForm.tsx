import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthService } from "../services/AuthService";
import logoRed from "@/assets/images/logo_red.png";

export function LoginForm() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        try {
            const response = await AuthService.login({ username, password });
            const { access_token, refresh_token } = response.result; 

            localStorage.setItem('access_token', access_token);
            const userData = await AuthService.getMe();


            login(access_token, refresh_token, userData);
            navigate("/dashboard");
        } catch (err: any) {
            setError("Invalid credentials.");
            localStorage.removeItem('access_token');
        } finally {
            setIsLoading(false);
        }
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
                        disabled={isLoading}
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
                        disabled={isLoading}
                        required 
                    />
                </div>
                {error && <p className="validation-error">{error}</p>}
            </div>

            <div className="login-actions">
                <button 
                    type="submit" 
                    className="login-btn-submit" 
                    disabled={isLoading}
                >
                    {isLoading ? "Authenticating..." : "Login"}
                </button>
                <div className="help-links">
                    <a href="/recover">Forgot password?</a>
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