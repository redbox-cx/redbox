import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MainLayout } from '../components/MainLayout';
import { Footer } from '../components/Footer';
import { BlogService, type BlogPost } from '../services/BlogService';
import { renderSafeMarkdown } from '../utils/safeMarkdown';

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function BlogPostPage() {
    const { id } = useParams<{ id: string }>();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        BlogService.getById(id)
            .then(setPost)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    const html = useMemo(() => post ? renderSafeMarkdown(post.markdown) : '', [post]);

    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="blog-post-page">
                    <Link to="/blog" className="blog-back-link">
                        <i className="bi bi-arrow-left" /> Back to Blog
                    </Link>

                    {loading && (
                        <div className="blog-status-message" style={{ marginTop: '60px' }}>
                            <i className="bi bi-hourglass-split" />
                            <p>Loading…</p>
                        </div>
                    )}

                    {error && (
                        <div className="blog-status-message" style={{ marginTop: '60px' }}>
                            <i className="bi bi-wifi-off" />
                            <h2>Post not found</h2>
                            <p>This post may have been removed or the link is invalid.</p>
                            <Link to="/blog" className="blog-home-link">Back to Blog</Link>
                        </div>
                    )}

                    {post && (
                        <motion.article
                            className="blog-post-article"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                            <div className="blog-post-cats">
                                {post.categories.map(c => (
                                    <span key={c} className="blog-cat-chip">{c}</span>
                                ))}
                            </div>

                            <h1 className="blog-post-title">{post.title}</h1>
                            <p className="blog-post-subtitle">{post.subtitle}</p>

                            <div className="blog-post-meta">
                                <div className="blog-post-author">
                                    <span className="blog-post-author-name">{post.author.name}</span>
                                    <span className="blog-post-author-role">{post.author.title}</span>
                                </div>
                                <span className="blog-post-date">{formatDate(post.publishedAt)}</span>
                            </div>

                            <hr className="blog-post-divider" />

                            <div
                                className="blog-post-content legal-content"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        </motion.article>
                    )}
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}
