import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthService } from "../services/AuthService";
import logoRed from "@/assets/images/logo_red.png";

type Step = "credentials" | "phrase" | "verify";

const VERIFY_COUNT = 5;

function pickRandom(count: number, max: number): number[] {
    const pool = Array.from({ length: max }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).sort((a, b) => a - b);
}

export function RegisterForm() {
    const [step, setStep] = useState<Step>("credentials");

    // Step 1 fields
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [inviteCode, setInviteCode] = useState("");

    // Phrase state
    const [phrase, setPhrase] = useState("");
    const [words, setWords] = useState<string[]>([]);
    const [saved, setSaved] = useState(false);

    // Verify state
    const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
    const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({});

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const page = document.querySelector('.login-page');
        const container = document.querySelector('.login-container');
        if (step === 'phrase' || step === 'verify') {
            page?.classList.add('login-page--phrase');
            container?.classList.add('login-container--wide');
        } else {
            page?.classList.remove('login-page--phrase');
            container?.classList.remove('login-container--wide');
        }
        return () => {
            page?.classList.remove('login-page--phrase');
            container?.classList.remove('login-container--wide');
        };
    }, [step]);

    const fetchPhrase = async () => {
        setIsLoading(true);
        setSaved(false);
        try {
            const data = await AuthService.generatePhrase();
            setPhrase(data.phrase);
            setWords(data.words);
        } catch {
            setError("Failed to generate recovery phrase. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Step 1
    const handleCredentialsNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (password !== passwordConfirm) {
            setError("Passwords do not match.");
            return;
        }
        setIsLoading(true);
        try {
            await AuthService.preValidate({ username, password, passwordConfirm, inviteCode });
        } catch (err: any) {
            const message = err.response?.data?.message;
            if (Array.isArray(message)) setError(message[0]);
            else setError(message || "Invalid credentials.");
            setIsLoading(false);
            return;
        }
        await fetchPhrase();
        setStep("phrase");
    };

    // Step 2
    const handleSaveTxt = () => {
        const content = `redbox. Recovery Phrase\n${"=".repeat(30)}\n\n` +
            words.map((w, i) => `${String(i + 1).padStart(2, " ")}. ${w}`).join("\n") +
            "\n\nKeep this file safe and offline. Never share it with anyone.";
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "redbox-recovery-phrase.txt";
        a.click();
        URL.revokeObjectURL(url);
        setSaved(true);
    };

    const handlePhraseNext = () => {
        setError("");
        const indices = pickRandom(VERIFY_COUNT, 24);
        setVerifyIndices(indices);
        setVerifyInputs({});
        setStep("verify");
    };

    // Step 3
    const handleVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        for (const idx of verifyIndices) {
            if ((verifyInputs[idx] ?? "").trim().toLowerCase() !== words[idx].toLowerCase()) {
                setError("One of the missing words is incorrect. Please check your phrase.");
                return;
            }
        }

        setIsLoading(true);
        try {
            const data = await AuthService.register({
                username,
                password,
                passwordConfirm,
                inviteCode,
                recoveryPhrase: phrase,
            });
            const { access_token, refresh_token } = data.result;
            localStorage.setItem("access_token", access_token);
            const userData = await AuthService.getMe();
            login(access_token, refresh_token, userData);
            navigate("/dashboard");
        } catch (err: any) {
            const message = err.response?.data?.message;
            if (Array.isArray(message)) setError(message[0]);
            else setError(message || "Registration failed.");
        } finally {
            setIsLoading(false);
        }
    };

    if (step === "credentials") {
        return (
            <form className="login-card" onSubmit={handleCredentialsNext}>
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
                            required
                        />
                    </div>
                    {error && <p className="validation-error">{error}</p>}
                </div>

                <div className="login-actions">
                    <button type="submit" className="login-btn-submit" disabled={isLoading}>
                        {isLoading ? "Generating phrase..." : "Next →"}
                    </button>
                </div>

                <div className="login-footer">
                    <p>Already have an account? <a href="/login">Login</a></p>
                </div>
            </form>
        );
    }

    if (step === "phrase") {
        return (
            <div className="login-card phrase-card">
                <div className="login-header">
                    <img src={logoRed} alt="logo" width="50" height="50" />
                    <h2>redbox<span className="dot">.</span></h2>
                    <p>Write down your recovery phrase.</p>
                </div>

                <div className="phrase-warning">
                    <i className="bi bi-exclamation-triangle-fill" /> These 24 words are the only way to recover your account. Write them down on paper and store them somewhere safe. <strong>Never share them with anyone — not even us.</strong>
                </div>

                <div className="phrase-grid">
                    {words.map((word, i) => (
                        <div key={i} className="phrase-word">
                            <span className="phrase-num">{i + 1}</span>
                            <span className="phrase-text">{word}</span>
                        </div>
                    ))}
                </div>

                {error && <p className="validation-error">{error}</p>}

                <div className="phrase-actions">
                    <button
                        type="button"
                        className="phrase-btn-outline"
                        onClick={handleSaveTxt}
                    >
                        <i className="bi bi-download" /> Save .txt
                    </button>
                    <button
                        type="button"
                        className="phrase-btn-outline"
                        onClick={fetchPhrase}
                        disabled={isLoading}
                    >
                        <i className="bi bi-arrow-clockwise" /> Regenerate
                    </button>
                    <button
                        type="button"
                        className="login-btn-submit phrase-btn-continue"
                        onClick={handlePhraseNext}
                        disabled={isLoading}
                    >
                        I've saved it →
                    </button>
                </div>

                {!saved && (
                    <p className="phrase-save-hint">Tip: save the .txt file or write the words down before continuing.</p>
                )}
            </div>
        );
    }

    return (
        <form className="login-card phrase-card" onSubmit={handleVerifySubmit}>
            <div className="login-header">
                <img src={logoRed} alt="logo" width="50" height="50" />
                <h2>redbox<span className="dot">.</span></h2>
                <p>Confirm your recovery phrase.</p>
            </div>

            <div className="phrase-warning">
                <i className="bi bi-shield-lock-fill" /> Fill in the <strong>{VERIFY_COUNT} missing words</strong> to confirm you saved your phrase.
            </div>

            <div className="phrase-grid">
                {words.map((word, i) => {
                    const isBlank = verifyIndices.includes(i);
                    return (
                        <div key={i} className={`phrase-word ${isBlank ? "phrase-word--verify" : ""}`}>
                            <span className="phrase-num">{i + 1}</span>
                            {isBlank ? (
                                <input
                                    className="phrase-input"
                                    type="text"
                                    placeholder={`word #${i + 1}`}
                                    value={verifyInputs[i] ?? ""}
                                    onChange={(e) =>
                                        setVerifyInputs((prev) => ({ ...prev, [i]: e.target.value }))
                                    }
                                    autoComplete="off"
                                    spellCheck={false}
                                    required
                                />
                            ) : (
                                <span className="phrase-text phrase-text--dim">{word}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && <p className="validation-error">{error}</p>}

            <div className="phrase-actions">
                <button
                    type="button"
                    className="phrase-btn-outline"
                    onClick={() => { setError(""); setStep("phrase"); }}
                    disabled={isLoading}
                >
                    ← Back
                </button>
                <button
                    type="submit"
                    className="login-btn-submit phrase-btn-continue"
                    disabled={isLoading}
                >
                    {isLoading ? "Creating account..." : "Complete Registration"}
                </button>
            </div>
        </form>
    );
}
