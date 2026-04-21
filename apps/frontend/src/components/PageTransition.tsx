import { motion } from 'motion/react';

interface Props {
    children: React.ReactNode;
}

export function PageTransition({ children }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
            {children}
        </motion.div>
    );
}
