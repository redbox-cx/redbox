import { motion } from "motion/react"
import securesphereIcon from "@/assets/svg/securesphere-logo.svg"
import mailIcon from "@/assets/svg/mail-logo.svg"
import toolsetIcon from "@/assets/svg/toolset-logo.svg"

const servicesData = [
    {
        title: "SecureSphere",
        icon: securesphereIcon,
        description: "A web-based chat platform for secure and private communication. Using end-to-end encryption, it ensures only intended recipients can read messages with minimal server data storage."
    },
    {
        title: "Email Service",
        icon: mailIcon,
        description: "Currently providing email routing via Cloudflare, with plans to transition to a fully self-hosted, private email solution in the near future."
    },
    {
        title: "Redbox Toolset",
        icon: toolsetIcon,
        description: "A collection of privacy-focused tools: link shortener, secure file upload, and an encrypted bin. Designed to make sharing data safe and simple."
    }
];

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0 },
};

export function Services() {
    return (
        <section className="services-section">
            <motion.div
                className="services-header"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.5 }}
                variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            >
                <motion.h2
                    className="services-main-title"
                    variants={fadeUp}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    Our Services
                </motion.h2>
                <motion.p
                    className="services-main-subtitle"
                    variants={fadeUp}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    Privacy first. Always.
                </motion.p>
            </motion.div>

            <motion.div
                className="services-grid"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            >
                {servicesData.map((service, index) => (
                    <motion.div
                        key={index}
                        className="service-card"
                        variants={fadeUp}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                    >
                        <div className="service-icon-box">
                            <img src={service.icon} alt={service.title} className="service-icon-img" />
                        </div>
                        <h3 className="service-title">{service.title}</h3>
                        <p className="service-description">{service.description}</p>
                        <button className="service-open-btn">Open</button>
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
}
