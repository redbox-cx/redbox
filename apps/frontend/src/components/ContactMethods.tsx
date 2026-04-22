interface ContactMethod {
    name: string;
    value: string;
    link?: string;
    icon: string;
    onClick?: () => void;
}

interface Props {
    onBugReport: () => void;
    onLawEnforcement: () => void;
}

export function ContactMethods({ onBugReport, onLawEnforcement }: Props) {
    const contactData: ContactMethod[] = [
        {
            name: "Email",
            value: "support@redbox.cx",
            link: "mailto:support@redbox.cx",
            icon: "bi bi-envelope-fill",
        },
        {
            name: "Bug Report",
            value: "Submit a bug report",
            icon: "bi bi-bug-fill",
            onClick: onBugReport,
        },
        {
            name: "Law Enforcement",
            value: "Law Enforcement Request Portal",
            icon: "bi bi-shield-lock-fill",
            onClick: onLawEnforcement,
        },
    ];

    return (
        <div className="contact-grid">
            {contactData.map((method, index) =>
                method.onClick ? (
                    <button key={index} className="contact-card" onClick={method.onClick}>
                        <div className="contact-icon-box">
                            <i className={method.icon}></i>
                        </div>
                        <div className="contact-info">
                            <h3>{method.name}</h3>
                            <p>{method.value}</p>
                        </div>
                    </button>
                ) : (
                    <a key={index} href={method.link} className="contact-card" target="_blank" rel="noreferrer">
                        <div className="contact-icon-box">
                            <i className={method.icon}></i>
                        </div>
                        <div className="contact-info">
                            <h3>{method.name}</h3>
                            <p>{method.value}</p>
                        </div>
                    </a>
                )
            )}
        </div>
    );
}
