import { motion } from "motion/react"
import logoRed from "@/assets/images/logo_red.png"
import DecryptedText from "@/components/DecryptedText"

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show:   { opacity: 1, y: 0 },
};

export function Hero() {
    return (
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
                    <DecryptedText
                        text="redbox"
                        animateOn="view"
                        sequential
                        revealDirection="start"
                        speed={110}
                        maxIterations={14}
                        characters="abcdefghijklmnopqrstuvwxyz"
                    /><span className="dot">.</span>
                </motion.h1>

                <motion.p
                    className="hero-subtitle"
                    variants={fadeUp}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    Private utility platform
                </motion.p>

                <motion.p
                    className="hero-description"
                    variants={fadeUp}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    Redbox is a small, student-run platform built around privacy and security.
                    Access is limited, and everything is designed to stay private, independent, and simple.
                </motion.p>
            </motion.div>

            <motion.div
                className="hero-visual"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
                <img src={logoRed} alt="levitating logo" className="levitating-logo" />
            </motion.div>
        </section>
    );
}
