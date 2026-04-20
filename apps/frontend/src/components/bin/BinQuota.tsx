interface Props {
    used: number;
    limit: number;
}

export function BinQuota({ used, limit }: Props) {
    const pct = Math.min((used / limit) * 100, 100);
    return (
        <div className="upload-quota">
            <div className="upload-quota-labels">
                <span>{used} bins used</span>
                <span>{limit} total</span>
            </div>
            <div className="upload-quota-track">
                <div className="upload-quota-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
