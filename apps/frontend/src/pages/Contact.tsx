import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import { ContactMethods } from "../components/ContactMethods";

export function Contact() {
    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="contact-container">
                    <section className="contact-intro">
                        <h2 className="contact-title">Get in Touch</h2>
                        <p className="contact-description">
                            We’re always looking for feedback, bug reports, or suggestions.
                            If you’ve encountered an issue or just want to share your thoughts
                            on how we can improve redbox, feel free to reach out through
                            any of the following channels.
                            <br/>
                            For <strong>law enforcement</strong> requests, please use our dedicated request portal.
                        </p>
                    </section>

                    <section className="contact-content">
                        <ContactMethods />
                    </section>
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}