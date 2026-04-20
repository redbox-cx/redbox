import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../services/AuthService";
import logoRed from "@/assets/images/logo_red.png";

export function RecoverForm() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [wordInputs, setWordInputs] = useState<string[]>(Array(24).fill(""));
    const [newPassword, setNewPassword] = useState("");
    const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const extracted: string[] = [];
            for (const line of text.split('\n')) {
                const match = line.match(/^\s*\d+\.\s+(\S+)/);
                if (match) extracted.push(match[1]);
            }
            if (extracted.length === 24) {
                setWordInputs(extracted);
                setError('');
            } else {
                setError(`Invalid file: found ${extracted.length} words, expected 24.`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const setWord = (i: number, value: string) => {
        setWordInputs(prev => { const next = [...prev]; next[i] = value; return next; });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const missing = wordInputs.findIndex(w => !w.trim());
        if (missing !== -1) { setError(`Word #${missing + 1} is empty.`); return; }
        if (newPassword !== newPasswordConfirm) { setError("Passwords do not match."); return; }

        const recoveryPhrase = wordInputs.map(w => w.trim().toLowerCase()).join(" ");
        setIsLoading(true);
        try {
            await AuthService.recoverPassword({ username, recoveryPhrase, newPassword, newPasswordConfirm });
            setSuccess(true);
        } catch (err: any) {
            const message = err.response?.data?.message;
            setError(Array.isArray(message) ? message[0] : message || "Recovery failed. Check your phrase and username.");
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
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
                    <button className="login-btn-submit" onClick={() => navigate("/login")}>Go to Login</button>
                </div>
            </div>
        );
    }

    return (
        <form className="login-card phrase-card" onSubmit={handleSubmit}>
            <div className="login-header">
                <img src={logoRed} alt="logo" width="50" height="50" />
                <h2>redbox<span className="dot">.</span></h2>
                <p>Recover your account.</p>
            </div>

            <div className="login-fields" style={{ marginBottom: 24 }}>
                <div className="input-group">
                    <label>Username</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} required />
                </div>
            </div>

            <div className="recover-phrase-header">
                <p className="recover-phrase-label">Enter your 24-word recovery phrase:</p>
                <label className="phrase-btn-outline recover-upload-btn">
                    <i className="bi bi-upload" /> Upload .txt
                    <input type="file" accept=".txt" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isLoading} />
                </label>
            </div>

            <div className="phrase-grid">
                {wordInputs.map((word, i) => (
                    <div key={i} className="phrase-word phrase-word--verify">
                        <span className="phrase-num">{i + 1}</span>
                        <input
                            className="phrase-input"
                            type="text"
                            value={word}
                            onChange={e => setWord(i, e.target.value)}
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
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={isLoading} required />
                </div>
                <div className="input-group">
                    <label>Confirm New Password</label>
                    <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} disabled={isLoading} required />
                </div>
                {error && <p className="validation-error">{error}</p>}
            </div>

            <div className="login-actions">
                <button type="submit" className="login-btn-submit" disabled={isLoading}>
                    {isLoading ? "Recovering..." : "Reset Password"}
                </button>
            </div>

            <div className="login-footer">
                <p>Remembered your password? <a href="/login">Login</a></p>
            </div>
        </form>
    );
}
