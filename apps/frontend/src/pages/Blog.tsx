import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MainLayout } from '../components/MainLayout';
import { Footer } from '../components/Footer';
import { BlogService, type BlogPostSummary } from '../services/BlogService';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Blog() {
    const [posts, setPosts] = useState<BlogPostSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        BlogService.getAll()
            .then(r => setPosts(r.items))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="blog-feed">
                    <div className="blog-header">
                        <h1 className="hero-title">Blog<span className="dot">.</span></h1>
                        <p>Updates, announcements, and thoughts from the Redbox team.</p>
                    </div>

                    {loading && (
                        <div className="blog-status-message">
                            <i className="bi bi-hourglass-split" />
                            <p>Loading posts…</p>
                        </div>
                    )}

                    {error && (
                        <div className="blog-status-message">
                            <i className="bi bi-wifi-off" />
                            <h2>Could not load posts</h2>
                            <p>Check your connection and try again.</p>
                        </div>
                    )}

                    {!loading && !error && posts.length === 0 && (
                        <div className="blog-status-message">
                            <i className="bi bi-chat-left-dots" />
                            <h2>Nothing here yet</h2>
                            <p>There are no posts published at the moment.<br />Stay tuned for future updates.</p>
                            <Link to="/" className="blog-home-link">Return Home</Link>
                        </div>
                    )}

                    {!loading && !error && posts.length > 0 && (
                        <div className="blog-grid">
                            {posts.map((post, i) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: i * 0.07, ease: 'easeOut' }}
                                >
                                    <Link to={`/blog/${post.id}`} className="blog-card">
                                        <div className="blog-card-cats">
                                            {post.categories.slice(0, 3).map(c => (
                                                <span key={c} className="blog-cat-chip">{c}</span>
                                            ))}
                                        </div>
                                        <h2 className="blog-card-title">{post.title}</h2>
                                        <p className="blog-card-subtitle">{post.subtitle}</p>
                                        <div className="blog-card-meta">
                                            <span className="blog-card-author">Author: {post.author.name}</span>
                                            <span className="blog-card-date">{formatDate(post.publishedAt)}</span>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}
