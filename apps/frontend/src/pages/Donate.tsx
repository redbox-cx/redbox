import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import { DonationMethods } from "../components/DonationMethods";

export function Donate() {
    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="donation-container">
                    <section className="donation-intro">
                        <h2 className="donation-title">Support Redbox</h2>
                        <p className="donation-description">
                            Redbox is a student-run project maintained out of our own pockets. 
                            We are committed to keeping the platform private, independent, and free of ads/tracking. 
                        </p>
                        <p className="donation-description">
                            If you find our tools useful and would like to help us cover infrastructure 
                            costs and support future development, please consider making a donation. 
                            Every contribution helps us stay online and bureaucracy-free.
                        </p>
                    </section>

                    <section className="donation-content">
                        <DonationMethods />
                        <p className="donation-footer-note">
                            Thank you for supporting us.
                        </p>
                    </section>
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}