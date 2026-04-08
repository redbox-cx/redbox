import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Home } from "../pages/Home";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import { About } from "../pages/About";
import { Blog } from "../pages/Blog";
import { Contact } from "../pages/Contact";
import { Donate } from "../pages/Donate";
import { DashBoard } from "../pages/Dashboard";
import { Upload } from "../pages/Upload";
import { Download } from "../pages/Download";
import { Recover } from "../pages/Recover";
import { Shortner } from "../pages/Shortner";
import { ShortRedirect } from "../pages/ShortRedirect";
import { Bin } from "../pages/Bin";
import { BinView } from "../pages/BinView";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return null;

    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/donate" element={<Donate />} />
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}