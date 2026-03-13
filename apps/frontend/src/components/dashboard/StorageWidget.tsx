import { useEffect, useState } from "react";
import apiClient from "../../api/apiClient";

export function StorageWidget() {
    const [usedBytes, setUsedBytes] = useState(0);
    const totalQuota = 2 * 1024 * 1024 * 1024;

    useEffect(() => {
        apiClient.get('/files').then(res => {
            if (res.data.result) setUsedBytes(res.data.result.totalUsed);
        }).catch(() => setUsedBytes(0));
    }, []);

    const usedGB = (usedBytes / (1024 ** 3)).toFixed(1);
    const percentage = Math.min((usedBytes / totalQuota) * 100, 100);

    return (
        <div className="widget-wrapper">
            <div className="widget-tab"><i className="bi bi-cloud-arrow-up"></i> Storage</div>
            <div className="glass-panel widget-box">
                <div className="storage-viz">
                    <div className="donut-chart" style={{"--used": percentage} as any}>
                        <div className="donut-inner">
                            <strong>{usedGB} GB</strong>
                            <span>Used of 2GB</span>
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