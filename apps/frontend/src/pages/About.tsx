import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";
import aboutImg1 from "@/assets/images/about.jpg"; 
import aboutImg2 from "@/assets/images/about2.jpg";
import aboutImg3 from "@/assets/images/about3.jpg";

export function About() {
    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="about-container">
                                        <section className="about-zigzag">
                        <div className="about-text">
                            <h2 className="about-title">About the project</h2>
                            <p>
                                The project "redbox" was born from our own need. We wanted to be able to use simple tools that actually worked, without depending on large companies, and without having to sacrifice privacy in the process.
                            </p>
                            <p>
                                Our team is built on people that are interested in technology, information security, and the more pratical side of the internet. The project grew as a set of tools and services designed for direct use, without bureaucracy. The idea has always been to keep things direct and functional.
                            </p>
                            <p>
                                We don't collect data and don't keep usage logs. Whenever possible, control should remain with the user of the tool, not the service provider.
                            </p>
                        </div>
                        <div className="about-visual">
                            <img src={aboutImg1} alt="Project" className="about-image" />
                        </div>
                    </section>
                    <section className="about-zigzag reverse">
                        <div className="about-text">
                            <h2 className="about-title">How we Think</h2>
                            <p className="highlight-text">Privacy isn’t special. It’s essential. <br/> Freedom of use is essential too.</p>
                            <p>
                                We keep the project outside the logic of large platforms and unnecessary controls. Not out of confrontation, but because we believe that technology works best when it's direct, transparent, and doesn't depend on surveillance to exist.
                            </p>
                            <p>
                                Redbox is not a space for radicalism or extremism, regardless of perspective. The idea here is to maintain a technical focus, encourage the exchange of knowledge, and the responsible use of tools.
                            </p>
                        </div>
                        <div className="about-visual">
                            <img src={aboutImg2} alt="Philosophy" className="about-image" />
                        </div>
                    </section>
                    <section className="about-zigzag">
                        <div className="about-text">
                            <h2 className="about-title">Who We Are</h2>
                            <p>
                                The project is maintained by ourselfs, a team of three people with different experiences, backgrounds but the same objective. We are a team with varied skill sets and a multicultural background, with members originating from different countries.
                            </p>
                            <p>
                                Redbox is built continuously, with technical care and attention to the impact of the decisions we make. The project is open to collaborations and contributions that make sense within our principles.
                            </p>
                        </div>
                        <div className="about-visual">
                            <img src={aboutImg3} alt="Team" className="about-image" />
                        </div>
                    </section>
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}