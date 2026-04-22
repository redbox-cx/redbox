import { useState, useEffect } from "react";
import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import { ContactMethods } from "../components/ContactMethods";
import { BugReportModal } from "../components/BugReportModal";
import { LawEnforcementModal } from "../components/LawEnforcementModal";

export function Contact() {
    const [showBugModal, setShowBugModal] = useState(false);
    const [showLEModal, setShowLEModal] = useState(false);

    useEffect(() => {
        const sections = document.querySelectorAll('.contact-intro, .contact-content');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('page-section-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        sections.forEach(s => observer.observe(s));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="contact-container">
                    <section className="contact-intro">
                        <h2 className="contact-title">Get in Touch</h2>
                        <p className="contact-description">
                            We're always looking for feedback, bug reports, or suggestions.
                            If you've encountered an issue or just want to share your thoughts
                            on how we can improve redbox, feel free to reach out through
                            any of the following channels.
                            <br/>
                            For <strong>law enforcement</strong> requests, please use our dedicated request portal.
                        </p>
                    </section>

                    <section className="contact-content">
                        <ContactMethods onBugReport={() => setShowBugModal(true)} onLawEnforcement={() => setShowLEModal(true)} />
                    </section>
                </div>
            </MainLayout>
            <Footer />

            {showBugModal && <BugReportModal onClose={() => setShowBugModal(false)} />}
            {showLEModal && <LawEnforcementModal onClose={() => setShowLEModal(false)} />}
        </div>
    );
}
