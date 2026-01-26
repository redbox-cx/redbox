const contactData = [
    {
        name: "Email",
        value: "support@redbox.cx",
        link: "mailto:support@redbox.cx",
        icon: "bi bi-envelope-fill",
    },
    {
        name: "Discord",
        value: "Our discord community",
        link: "#",
        icon: "bi bi-discord",
    },
    {
        name: "Law Enforcement",
        value: "Law Enforcement Request Portal",
        link: "#",
        icon: "bi bi-arrow-right",
    }
];

export function ContactMethods() {
    return (
        <div className="contact-grid">
            {contactData.map((method, index) => (
                <a key={index} href={method.link} className="contact-card" target="_blank" rel="noreferrer">
                    <div className="contact-icon-box">
                        <i className={method.icon}></i>
                    </div>
                    <div className="contact-info">
                        <h3>{method.name}</h3>
                        <p>{method.value}</p>
                    </div>
                </a>
            ))}
        </div>
    );
}