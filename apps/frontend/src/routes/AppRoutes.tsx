import { lazy, Suspense } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

const Home = lazy(() => import("../pages/Home").then(m => ({ default: m.Home })));
const Login = lazy(() => import("../pages/Login").then(m => ({ default: m.Login })));
const Register = lazy(() => import("../pages/Register").then(m => ({ default: m.Register })));
const About = lazy(() => import("../pages/About").then(m => ({ default: m.About })));
const Blog = lazy(() => import("../pages/Blog").then(m => ({ default: m.Blog })));
const BlogPostPage = lazy(() => import("../pages/BlogPostPage").then(m => ({ default: m.BlogPostPage })));
const Contact = lazy(() => import("../pages/Contact").then(m => ({ default: m.Contact })));
const SecureSpherePage = lazy(() => import("../pages/SecureSpherePage").then(m => ({ default: m.SecureSpherePage })));
const MailPublicPage = lazy(() => import("../pages/MailPage_Public").then(m => ({ default: m.MailPublicPage })));
const ToolsetPublicPage = lazy(() => import("../pages/ToolsetPublicPage").then(m => ({ default: m.ToolsetPublicPage })));
const TermsPage = lazy(() => import("../pages/TermsPage").then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("../pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const Download = lazy(() => import("../pages/Download").then(m => ({ default: m.Download })));
const Recover = lazy(() => import("../pages/Recover").then(m => ({ default: m.Recover })));
const ShortRedirect = lazy(() => import("../pages/ShortRedirect").then(m => ({ default: m.ShortRedirect })));
const BinView = lazy(() => import("../pages/BinView").then(m => ({ default: m.BinView })));
const DashBoard = lazy(() => import("../pages/Dashboard").then(m => ({ default: m.DashBoard })));
const Upload = lazy(() => import("../pages/Upload").then(m => ({ default: m.Upload })));
const Shortner = lazy(() => import("../pages/Shortner").then(m => ({ default: m.Shortner })));
const Bin = lazy(() => import("../pages/Bin").then(m => ({ default: m.Bin })));
const Settings = lazy(() => import("../pages/Settings").then(m => ({ default: m.Settings })));
const MailPage = lazy(() => import("../pages/MailPage").then(m => ({ default: m.MailPage })));
const SecureSphere = lazy(() => import("../pages/SecureSphere").then(m => ({ default: m.SecureSphere })));

const PUBLIC_PATHS = ["/", "/about", "/blog", "/contact", "/about/securesphere", "/about/mail", "/about/toolset", "/login", "/register", "/recover", "/terms", "/privacy"];
const isPublicBlogPost = (path: string) => /^\/blog\/.+/.test(path);

export function AppRoutes() {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) return null;

    const isPublic = PUBLIC_PATHS.some(p => location.pathname === p) || isPublicBlogPost(location.pathname);
    const transitionKey = isPublic ? location.pathname : "app";

    return (
        <>
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={transitionKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ minHeight: "100%" }}
            >
                <Suspense fallback={null}>
                    <Routes location={location}>
                        <Route path="/" element={<Home />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:id" element={<BlogPostPage />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/about/securesphere" element={<SecureSpherePage />} />
                        <Route path="/about/mail" element={<MailPublicPage />} />
                        <Route path="/about/toolset" element={<ToolsetPublicPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/privacy" element={<PrivacyPage />} />
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
                </Suspense>
            </motion.div>
        </AnimatePresence>
        </>
    );
}
