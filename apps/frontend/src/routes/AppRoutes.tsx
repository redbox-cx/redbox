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
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashBoard />} />
            </Route>
        </Routes>
    );
}