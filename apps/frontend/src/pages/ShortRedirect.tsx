import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';

export function ShortRedirect() {
    const { code } = useParams<{ code: string }>();

    useEffect(() => {
        if (code) {
            window.location.replace(`${import.meta.env.VITE_API_URL}/links/redirect/${code}`);
        }
    }, [code]);

    if (!code) return <Navigate to="/" replace />;
    return null;
}
