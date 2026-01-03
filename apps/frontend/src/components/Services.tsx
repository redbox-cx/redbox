import logoRed from "@/assets/images/logo_red.png"

const servicesData = [
    {
        title: "SecureSphere",
        description: "A web-based chat platform for secure and private communication. Using end-to-end encryption, it ensures only intended recipients can read messages with minimal server data storage."
    },
    {
        title: "Email Service",
        description: "Currently providing email routing via Cloudflare, with plans to transition to a fully self-hosted, private email solution in the near future."
    },
    {
        title: "Redbox Toolset",
        description: "A collection of privacy-focused tools: link shortener, secure file upload, and an encrypted bin. Designed to make sharing data safe and simple."
    }
];

export function Services() {
    return (
        <section className="services-section">
            <div className="services-header">
                <h2 className="services-main-title">Our Services</h2>
                <p className="services-main-subtitle">Privacy first. Always.</p>
            </div>
            <div className="services-grid">
                {servicesData.map((service, index) => (
                    <div key={index} className="service-card">
                        <div className="service-icon-box">
                            <img src={logoRed} alt="icon" className="service-icon-img" />
                        </div>
                        <h3 className="service-title">{service.title}</h3>
                        <p className="service-description">{service.description}</p>
                        <button className="service-open-btn">Open</button>
                    </div>
                ))}
            </div>
        </section>
    );
}