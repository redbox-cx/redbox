import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import TiltedCard from "../components/TiltedCard";
import toolsetIcon from "@/assets/svg/toolset-logo.svg";
import uploadPreview from "@/assets/images/screenshots/upload-preview.png";
import binPreview from "@/assets/images/screenshots/bin-preview.png";
import shortnerPreview from "@/assets/images/screenshots/shortner-preview.png";

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0 },
};

const rows = [
    {
        title: "File Upload",
        img: uploadPreview,
        body: [
            "Each account gets 2 GB of storage.",
            "You can set an optional password and pick an expiry (1 hour, 24 hours, 7 days, or 30 days). After expiry the file is deleted. Anyone with the link can download it, no Redbox account needed on their end.",
        ],
    },
    {
        title: "Encrypted Bin",
        img: binPreview,
        body: [
            "Up to 100 bins per account. Each bin is encrypted client-side before it's saved.",
            "You can add a password, set an expiry, or leave it open with no expiry. Anyone with the link can read it. If you set a password they'll need to enter it first.",
        ],
    },
    {
        title: "Link Shortener",
        img: shortnerPreview,
        body: [
            "Up to 25 short links per account. Paste a URL, get a short redbox link.",
            "Links are tied to your account, so you can view and delete them whenever you want.",
        ],
    },
];

export function ToolsetPublicPage() {
    useEffect(() => {
        const items = document.querySelectorAll('.mail-pub-row');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('mail-pub-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        items.forEach(r => observer.observe(r));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="page-wrapper">
            <MainLayout>
                <section className="hero-section">
                    <motion.div
                        className="hero-text"
                        initial="hidden"
                        animate="show"
                        variants={{ show: { transition: { staggerChildren: 0.18 } } }}
                    >
                        <motion.h1
                            className="hero-title"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            Toolset<span className="dot">.</span>
                        </motion.h1>

                        <motion.p
                            className="hero-subtitle"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            A small set of easy to use utilities
                        </motion.p>

                        <motion.p
                            className="hero-description"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            Three utilities built into your Redbox account: file uploads with 2 GB of storage, an encrypted text bin, and a link shortener.
                        </motion.p>

                        <motion.div
                            className="mail-pub-cta-row"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            <Link to="/register" className="mail-pub-cta-btn">Get access</Link>
                            <Link to="/about" className="mail-pub-cta-ghost">Learn about Redbox</Link>
                        </motion.div>
                    </motion.div>

                    <motion.div
                        className="hero-visual"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    >
                        <img src={toolsetIcon} alt="Toolset" className="mail-pub-hero-logo" />
                    </motion.div>
                </section>

                <div className="mail-pub-container">
                    {rows.map((row, i) => (
                        <section
                            key={i}
                            className={`mail-pub-row${i % 2 === 1 ? " mail-pub-row--reverse" : ""}${i < rows.length - 1 ? " mail-pub-row--spaced" : ""}`}
                        >
                            <div className="mail-pub-text">
                                <h2 className="mail-pub-title">{row.title}</h2>
                                {row.body.map((p, j) => <p key={j}>{p}</p>)}
                            </div>
                            <div className="mail-pub-visual">
                                <div className="mail-pub-card-wrapper">
                                    <TiltedCard
                                        imageSrc={row.img}
                                        altText={row.title + " preview"}
                                        containerWidth="100%"
                                        containerHeight="100%"
                                        imageWidth="100%"
                                        imageHeight="100%"
                                        scaleOnHover={1.05}
                                        rotateAmplitude={6}
                                        showMobileWarning={false}
                                        showTooltip={false}
                                    />
                                </div>
                                <img src={row.img} alt={row.title + " preview"} className="mail-pub-preview-img" />
                            </div>
                        </section>
                    ))}
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}
