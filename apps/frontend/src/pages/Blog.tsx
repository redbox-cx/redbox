import { MainLayout } from "../components/MainLayout";
import { Footer } from "../components/Footer";

export function Blog() {
    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="blog-feed">
                    <div className="blog-status-message">
                        <i className="bi bi-chat-left-dots"></i>
                        <h2>Blog</h2>
                        <p>There are no posts published at the moment. <br/> Stay tuned for future updates.</p>
                        <a href="/" className="blog-home-link">Return Home</a>
                    </div>
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}