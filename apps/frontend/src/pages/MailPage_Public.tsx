import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import TiltedCard from "../components/TiltedCard";
import mailIcon from "@/assets/svg/mail-logo.svg";
import mailPreview from "@/assets/images/screenshots/mail-preview.png";

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0 },
};

export function MailPublicPage() {
    useEffect(() => {
        const rows = document.querySelectorAll('.mail-pub-row');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('mail-pub-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        rows.forEach(r => observer.observe(r));
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
                            Mail<span className="dot">.</span>
                        </motion.h1>

                        <motion.p
                            className="hero-subtitle"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            Webmail for Redbox users
                        </motion.p>

                        <motion.p
                            className="hero-description"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            A read-only inbox built into your Redbox account. You can receive and read emails — sending isn't supported yet. Routing is handled through Cloudflare, nothing fancy.
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
                        <img src={mailIcon} alt="Mail" className="mail-pub-hero-logo" />
                    </motion.div>
                </section>

                <div className="mail-pub-container">
                    <section className="mail-pub-row">
                        <div className="mail-pub-text">
                            <h2 className="mail-pub-title">What it is</h2>
                            <p>It's a read-only inbox — you can receive and read emails, but outgoing mail isn't supported yet. Routing goes through Cloudflare, so it's not fully self-hosted either.</p>
                            <p>It's already available inside your Redbox dashboard if you have an account. No extra setup, just open it and it works.</p>
                        </div>
                        <div className="mail-pub-visual">
                            <TiltedCard
                                imageSrc={mailPreview}
                                altText="Mail preview"
                                containerWidth="100%"
                                containerHeight="320px"
                                imageWidth="100%"
                                imageHeight="320px"
                                showMobileWarning={false}
                                showTooltip={false}
                            />
                        </div>
                    </section>
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}
