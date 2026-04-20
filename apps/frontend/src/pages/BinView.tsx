import { useParams, useSearchParams } from 'react-router-dom';
import { BinNav } from '../components/bin/BinNav';
import { BinViewCard } from '../components/bin/BinViewCard';

export function BinView() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? undefined;
    const keyHex = window.location.hash.slice(1);

    return (
        <div className="dl-page">
            <BinNav />
            <div className="dl-body">
                <BinViewCard id={id!} token={token} keyHex={keyHex} />
            </div>
        </div>
    );
}
