import { useEffect, useState } from "react";
import { FileService } from "../../services/FileService";

export function StorageWidget() {
    const [usedBytes, setUsedBytes] = useState(0);
    const [totalQuota, setTotalQuota] = useState(2 * 1024 * 1024 * 1024);

    useEffect(() => {
        FileService.getFiles().then(result => {
            setUsedBytes(result.totalUsed);
            setTotalQuota(result.quotaLimit);
        }).catch(() => setUsedBytes(0));
    }, []);

    const usedGB = (usedBytes / (1024 ** 3)).toFixed(1);
    const quotaGB = totalQuota / (1024 ** 3);
    const percentage = Math.min((usedBytes / totalQuota) * 100, 100);

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className="bi bi-cloud-arrow-up"></i> Storage</div>
            <div className="glass-panel widget-box">
                <div className="storage-viz">
                    <div className="donut-chart" style={{"--used": percentage} as any}>
                        <div className="donut-inner">
                            <strong>{usedGB} GB</strong>
                            <span>Used of {quotaGB} GB</span>
                        </div>
                    </div>
                    <div className="storage-legend">
                        <div className="legend-item"><span className="dot-used"></span> Used ({percentage.toFixed(0)}%)</div>
                        <div className="legend-item"><span className="dot-free"></span> Free ({(100 - percentage).toFixed(0)}%)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
