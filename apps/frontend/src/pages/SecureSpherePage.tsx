import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import securesphereIcon from "@/assets/svg/securesphere-logo.svg";
import sspImg1 from "@/assets/images/ssp-1.jpg";
import sspImg2 from "@/assets/images/ssp-2.jpg";
import sspImg3 from "@/assets/images/ssp-3.jpg";
import TiltedCard from "../components/TiltedCard";

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0 },
};

export function SecureSpherePage() {
    useEffect(() => {
        document.documentElement.classList.add('ss-dark');
        return () => { document.documentElement.classList.remove('ss-dark'); };
    }, []);

    useEffect(() => {
        const rows = document.querySelectorAll('.ss-detail-row');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('ss-visible');
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
                            SecureSphere<span className="dot">.</span>
                        </motion.h1>

                        <motion.p
                            className="hero-subtitle"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            End-to-end encrypted chat
                        </motion.p>

                        <motion.p
                            className="hero-description"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            Private chatrooms built for anonymity. Messages are encrypted on your device — the server never sees your content. No tracking, no backdoors.
                        </motion.p>

                        <motion.div
                            className="ss-cta-row"
                            variants={fadeUp}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        >
                            <p className="ss-unavailable-note">Not available yet — currently being built.</p>
                            <Link to="/about" className="ss-cta-ghost">Learn about Redbox</Link>
                        </motion.div>
                    </motion.div>

                    <motion.div
                        className="hero-visual"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    >
                        <img src={securesphereIcon} alt="SecureSphere" className="ss-hero-logo" />
                    </motion.div>
                </section>
                <div className="ss-detail-container">
                    <section className="ss-detail-row">
                        <div className="ss-detail-text">
                            <h2 className="ss-detail-title">Encrypted from the start</h2>
                            <p>Messages are encrypted on your device before they ever reach the server. SecureSphere uses end-to-end encryption, meaning only the people in the conversation can read what's being said.</p>
                            <p>The server never has access to the plaintext content of any message. It only sees encrypted blobs it cannot interpret.</p>
                        </div>
                        <div className="ss-detail-visual">
                            <TiltedCard imageSrc={sspImg1} altText="Encryption" containerHeight="300px" containerWidth="100%" imageHeight="300px" imageWidth="100%" showMobileWarning={false} showTooltip={false} rotateAmplitude={10} scaleOnHover={1.05} />
                        </div>
                    </section>

                    <section className="ss-detail-row reverse">
                        <div className="ss-detail-text">
                            <h2 className="ss-detail-title">No accounts, no traces</h2>
                            <p>Registration requires only a username and a password — no email, no phone number, no personal data. We keep the bare minimum to make the platform work.</p>
                            <p>Messages are stored temporarily and deleted automatically after 24 hours. There's no persistent chat history sitting on a server somewhere.</p>
                        </div>
                        <div className="ss-detail-visual">
                            <TiltedCard imageSrc={sspImg2} altText="Privacy" containerHeight="300px" containerWidth="100%" imageHeight="300px" imageWidth="100%" showMobileWarning={false} showTooltip={false} rotateAmplitude={10} scaleOnHover={1.05} />
                        </div>
                    </section>

                    <section className="ss-detail-row">
                        <div className="ss-detail-text">
                            <h2 className="ss-detail-title">Built in the open</h2>
                            <p>Most chat platforms treat privacy as an afterthought. SecureSphere was designed around it from day one — every architectural decision was made with the assumption that the server should never be trusted.</p>
                            <p>The platform isn't public yet. We're still building it, testing it, and making sure the fundamentals are solid before opening it up.</p>
                        </div>
                        <div className="ss-detail-visual">
                            <TiltedCard imageSrc={sspImg3} altText="Development" containerHeight="300px" containerWidth="100%" imageHeight="300px" imageWidth="100%" showMobileWarning={false} showTooltip={false} rotateAmplitude={10} scaleOnHover={1.05} />
                        </div>
                    </section>
                </div>

            </MainLayout>
            <Footer />
        </div>
    );
}
