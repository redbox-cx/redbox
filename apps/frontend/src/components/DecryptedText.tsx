import { useState, useEffect, useRef } from "react";
import { useInView } from "motion/react";

interface DecryptedTextProps {
    text: string;
    speed?: number;
    maxIterations?: number;
    sequential?: boolean;
    revealDirection?: "start" | "end" | "center";
    characters?: string;
    className?: string;
    parentClassName?: string;
    encryptedClassName?: string;
    animateOn?: "hover" | "view";
    useOriginalCharsOnly?: boolean;
}

export default function DecryptedText({
    text,
    speed = 50,
    maxIterations = 10,
    sequential = false,
    revealDirection = "start",
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*",
    className = "",
    parentClassName = "",
    encryptedClassName = "",
    animateOn = "hover",
    useOriginalCharsOnly = false,
}: DecryptedTextProps) {
    const [displayText, setDisplayText] = useState(text.split(""));
    const [isAnimating, setIsAnimating] = useState(false);
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true });

    const getNextIndex = (revealed: Set<number>): number => {
        const total = text.length;
        if (revealDirection === "start") {
            for (let i = 0; i < total; i++) if (!revealed.has(i)) return i;
        } else if (revealDirection === "end") {
            for (let i = total - 1; i >= 0; i--) if (!revealed.has(i)) return i;
        } else {
            const mid = Math.floor(total / 2);
            const order = Array.from({ length: total }, (_, i) =>
                i % 2 === 0 ? mid - Math.floor(i / 2) : mid + Math.ceil(i / 2)
            ).filter((i) => i >= 0 && i < total);
            for (const i of order) if (!revealed.has(i)) return i;
        }
        return -1;
    };

    const startAnimation = () => {
        if (isAnimating) return;
        if (intervalRef.current) clearInterval(intervalRef.current);

        setIsAnimating(true);
        const revealed = new Set<number>();
        let iteration = 0;

        intervalRef.current = setInterval(() => {
            if (sequential && revealed.size < text.length) {
                const next = getNextIndex(revealed);
                if (next !== -1) revealed.add(next);
            }

            setRevealedIndices(new Set(revealed));
            setDisplayText(
                text.split("").map((char, i) => {
                    if (char === " ") return " ";
                    if (revealed.has(i)) return char;
                    if (!sequential && iteration >= maxIterations) return char;
                    const pool = useOriginalCharsOnly
                        ? text.split("").filter((_, j) => !revealed.has(j))
                        : characters.split("");
                    return pool[Math.floor(Math.random() * pool.length)] ?? char;
                })
            );

            iteration++;

            const done = sequential
                ? revealed.size >= text.length
                : iteration > maxIterations;

            if (done) {
                clearInterval(intervalRef.current!);
                setDisplayText(text.split(""));
                setRevealedIndices(new Set(text.split("").map((_, i) => i)));
                setIsAnimating(false);
            }
        }, speed);
    };

    useEffect(() => {
        if (animateOn === "view" && isInView) startAnimation();
    }, [isInView]);

    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

    return (
        <span
            ref={ref}
            className={parentClassName}
            style={{ whiteSpace: 'nowrap' }}
            onMouseEnter={animateOn === "hover" ? startAnimation : undefined}
        >
            {displayText.map((char, i) => (
                <span key={i} className={revealed(i, revealedIndices, isAnimating) ? className : encryptedClassName}>
                    {char}
                </span>
            ))}
        </span>
    );
}

function revealed(i: number, revealedIndices: Set<number>, isAnimating: boolean) {
    return revealedIndices.has(i) || !isAnimating;
}
