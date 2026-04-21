import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { Home } from "../pages/Home";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import { About } from "../pages/About";
import { Blog } from "../pages/Blog";
import { Contact } from "../pages/Contact";
import { SecureSpherePage } from "../pages/SecureSpherePage";
import { MailPublicPage } from "../pages/MailPage_Public";
import { DashBoard } from "../pages/Dashboard";
import { Upload } from "../pages/Upload";
import { Download } from "../pages/Download";
import { Recover } from "../pages/Recover";
import { Shortner } from "../pages/Shortner";
import { ShortRedirect } from "../pages/ShortRedirect";
import { Bin } from "../pages/Bin";
import { BinView } from "../pages/BinView";
import { Settings } from "../pages/Settings";
import { MailPage } from "../pages/MailPage";
import { SecureSphere } from "../pages/SecureSphere";
import { ProtectedRoute } from "./ProtectedRoute";
import { SystemNotificationToast } from "../components/notifications/SystemNotificationToast";

const PUBLIC_PATHS = ["/", "/about", "/blog", "/contact", "/about/securesphere", "/about/mail", "/login", "/register", "/recover"];

export function AppRoutes() {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) return null;

    const isPublic = PUBLIC_PATHS.some(p => location.pathname === p);
    const transitionKey = isPublic ? location.pathname : "app";

    return (
        <>
        {isAuthenticated && <SystemNotificationToast />}
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={transitionKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ minHeight: "100%" }}
            >
                <Routes location={location}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about/securesphere" element={<SecureSpherePage />} />
                    <Route path="/about/mail" element={<MailPublicPage />} />
                    <Route
                        path="/login"
                        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
                    />
                    <Route
                        path="/register"
                        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
                    />
                    <Route path="/d/:fileId" element={<Download />} />
                    <Route path="/recover" element={<Recover />} />
                    <Route path="/s/:code" element={<ShortRedirect />} />
                    <Route path="/b/:id" element={<BinView />} />
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<DashBoard />} />
                        <Route path="/upload" element={<Upload />} />
                        <Route path="/shortner" element={<Shortner />} />
                        <Route path="/bin" element={<Bin />} />
                        <Route path="/user/settings" element={<Settings />} />
                        <Route path="/mail" element={<MailPage />} />
                        <Route path="/securesphere" element={<SecureSphere />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </motion.div>
        </AnimatePresence>
        </>
    );
}