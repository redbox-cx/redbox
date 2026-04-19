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
    const [pendingDeletion, setPendingDeletion] = useState<{ deleteAfterAt: string; reactivationToken: string } | null>(null);
    const [reactivating, setReactivating] = useState(false);
    const [reactivated, setReactivated] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setPendingDeletion(null);

        try {
            const response = await AuthService.login({ username, password });

            if (response.result?.loginState === 'pending_deletion') {
                setPendingDeletion({
                    deleteAfterAt: response.result.deleteAfterAt,
                    reactivationToken: response.result.reactivationToken,
                });
                return;
            }

            const { access_token, refresh_token } = response.result;
            localStorage.setItem('access_token', access_token);
            const userData = await AuthService.getMe();
            login(access_token, refresh_token, userData);
            navigate("/dashboard");
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Invalid credentials.');
            localStorage.removeItem('access_token');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReactivate = async () => {
        if (!pendingDeletion) return;
        setReactivating(true);
        setError('');
        try {
            await AuthService.reactivateAccount(pendingDeletion.reactivationToken);
            setReactivated(true);
            setPendingDeletion(null);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to reactivate account.');
        } finally {
            setReactivating(false);
        }
    };

    const daysLeft = pendingDeletion
        ? Math.max(0, Math.ceil((new Date(pendingDeletion.deleteAfterAt).getTime() - Date.now()) / 86400000))
        : 0;

    if (reactivated) {
        return (
            <div className="login-card">
                <div className="login-header">
                    <img src={logoRed} alt="logo" width="50" height="50" />
                    <h2>redbox<span className="dot">.</span></h2>
                    <p>Account reactivated.</p>
                </div>
                <div className="phrase-warning" style={{ textAlign: 'center' }}>
                    <i className="bi bi-check-circle-fill" style={{ fontSize: '1.5rem', display: 'block', marginBottom: 8 }} />
                    Your account has been reactivated. You can now log in normally.
                </div>
                <div className="login-actions">
                    <button className="login-btn-submit" onClick={() => { setReactivated(false); setUsername(''); setPassword(''); }}>
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    if (pendingDeletion) {
        return (
            <div className="login-card">
                <div className="login-header">
                    <img src={logoRed} alt="logo" width="50" height="50" />
                    <h2>redbox<span className="dot">.</span></h2>
                    <p>Account pending deletion.</p>
                </div>
                <div className="phrase-warning">
                    <i className="bi bi-exclamation-triangle-fill" /> Your account is scheduled for deletion in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>. Reactivate now to cancel the deletion and keep your account.
                </div>
                {error && <p className="validation-error">{error}</p>}
                <div className="login-actions">
                    <button className="login-btn-submit" onClick={handleReactivate} disabled={reactivating}>
                        {reactivating ? 'Reactivating…' : 'Reactivate Account'}
                    </button>
                    <button type="button" className="phrase-btn-outline" style={{ width: '100%', marginTop: 8 }}
                        onClick={() => { setPendingDeletion(null); setError(''); }}
                        disabled={reactivating}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

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