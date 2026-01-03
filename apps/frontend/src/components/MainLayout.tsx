import { Navbar } from "./Navbar";

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="page-wrapper">
            <div className="white-sheet">
                <Navbar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}