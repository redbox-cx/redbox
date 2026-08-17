import { useLocation, useParams } from 'react-router-dom';
import { DownloadNav } from '../components/download/DownloadNav';
import { DownloadCard } from '../components/download/DownloadCard';

export function Download() {
    const { fileId } = useParams<{ fileId: string }>();
    const location = useLocation();
    const token = new URLSearchParams(location.search).get('token') ?? '';
    const keyHex = location.hash.slice(1);

    return (
        <div className="dl-page">
            <DownloadNav />
            <main className="dl-main">
                <DownloadCard
                    key={`${fileId ?? ''}:${token}:${keyHex}`}
                    fileId={fileId!}
                    token={token}
                    keyHex={keyHex}
                />
            </main>
        </div>
    );
}
