import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../services/AuthService";
import logoRed from "@/assets/images/logo_red.png";

export function Recover() {
    const [username, setUsername] = useState("");
    const [wordInputs, setWordInputs] = useState<string[]>(Array(24).fill(""));
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();

    const setWord = (i: number, value: string) => {
        setWordInputs((prev) => {
            const next = [...prev];
            next[i] = value;
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const missing = wordInputs.findIndex((w) => !w.trim());
        if (missing !== -1) {
            setError(`Word #${missing + 1} is empty.`);
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            setError("Passwords do not match.");
            return;
        }

        const recoveryPhrase = wordInputs.map((w) => w.trim().toLowerCase()).join(" ");

        setIsLoading(true);
        try {
            await AuthService.recoverPassword({
                username,
                recoveryPhrase,
                newPassword,
                newPasswordConfirm,
            });
            setSuccess(true);
        } catch (err: any) {
            const message = err.response?.data?.message;
            if (Array.isArray(message)) setError(message[0]);
            else setError(message || "Recovery failed. Check your phrase and username.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page login-page--phrase">
            <a href="/" className="back-home-brand">
                <img src={logoRed} alt="logo" width="32" height="32" />
                <span className="logo-text">redbox<span className="dot">.</span></span>
            </a>

            <div className="login-container login-container--wide recover-container">
                {success ? (
                    <div className="login-card">
                        <div className="login-header">
                            <img src={logoRed} alt="logo" width="50" height="50" />
                            <h2>redbox<span className="dot">.</span></h2>
                            <p>Password reset successfully.</p>
                        </div>
                        <div className="phrase-warning" style={{ textAlign: "center" }}>
                            <i className="bi bi-check-circle-fill" style={{ fontSize: "1.5rem", display: "block", marginBottom: 8 }} />
                            Your password has been updated. You can now log in with your new password.
                        </div>
                        <div className="login-actions">
                            <button
                                className="login-btn-submit"
                                onClick={() => navigate("/login")}
                            >
                                Go to Login
                            </button>
                        </div>
                    </div>
                ) : (
                    <form className="login-card phrase-card" onSubmit={handleSubmit}>
                        <div className="login-header">
                            <img src={logoRed} alt="logo" width="50" height="50" />
                            <h2>redbox<span className="dot">.</span></h2>
                            <p>Recover your account.</p>
                        </div>

                        <div className="login-fields" style={{ marginBottom: 24 }}>
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
                        </div>

                        <p className="recover-phrase-label">Enter your 24-word recovery phrase:</p>

                        <div className="phrase-grid">
                            {wordInputs.map((word, i) => (
                                <div key={i} className="phrase-word phrase-word--verify">
                                    <span className="phrase-num">{i + 1}</span>
                                    <input
                                        className="phrase-input"
                                        type="text"
                                        value={word}
                                        onChange={(e) => setWord(i, e.target.value)}
                                        placeholder={`word ${i + 1}`}
                                        autoComplete="off"
                                        spellCheck={false}
                                        disabled={isLoading}
                                        required
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="login-fields" style={{ marginTop: 24 }}>
                            <div className="input-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    value={newPasswordConfirm}
                                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
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
                                {isLoading ? "Recovering..." : "Reset Password"}
                            </button>
                        </div>

                        <div className="login-footer">
                            <p>Remembered your password? <a href="/login">Login</a></p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
