import logoRed from "@/assets/images/logo_red.png"

export function Hero() {
    return (
        <section className="hero-section">
            <div className="hero-text">
                <h1 className="hero-title">
                    redbox<span className="dot">.</span>
                </h1>
                <p className="hero-subtitle">Private utility platform</p>
                <p className="hero-description">
                    Redbox is a small, student-run platform built around privacy and security. 
                    Access is limited, and everything is designed to stay private, independent, and simple.
                </p>
            </div>
            <div className="hero-visual">
                <img src={logoRed} alt="levitating logo" className="levitating-logo" />
            </div>
        </section>
    );
}