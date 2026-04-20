import { useParams } from 'react-router-dom';
import { DownloadNav } from '../components/download/DownloadNav';
import { DownloadCard } from '../components/download/DownloadCard';

export function Download() {
    const { fileId } = useParams<{ fileId: string }>();
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const keyHex = window.location.hash.slice(1);

    return (
        <div className="dl-page">
            <DownloadNav />
            <main className="dl-main">
                <DownloadCard fileId={fileId!} token={token} keyHex={keyHex} />
            </main>
        </div>
    );
}
