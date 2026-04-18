import { useEffect } from 'react';
import { TopBar } from '../components/dashboard/TopBar';

export function SecureSphere() {
    useEffect(() => {
        document.documentElement.classList.add('dash-page');
        return () => { document.documentElement.classList.remove('dash-page'); };
    }, []);

    return (
        <div className="dash-layout">
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <TopBar />
            <div className="blog-feed">
                <div className="blog-status-message">
                    <i className="bi bi-shield-lock" />
                    <h2>SecureSphere</h2>
                    <p>This feature is not available yet.<br />Stay tuned for future updates.</p>
                </div>
            </div>
        </div>
    );
}
