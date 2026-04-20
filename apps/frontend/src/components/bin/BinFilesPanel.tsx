import type { BinEntry } from '../../services/BinService';
import { BinList } from './BinList';

interface Props {
    bins: BinEntry[];
    loading: boolean;
    copiedId: string | null;
    deletingId: string | null;
    onOpen: (bin: BinEntry) => void;
    onCopyLink: (bin: BinEntry) => void;
    onDelete: (bin: BinEntry) => void;
}

export function BinFilesPanel({ bins, loading, copiedId, deletingId, onOpen, onCopyLink, onDelete }: Props) {
    return (
        <div className="upload-drive-right">
            <div className="widget-tab"><i className="bi bi-collection" /> Your Bins</div>
            <div className="glass-panel upload-files-panel">
                <BinList
                    bins={bins}
                    loading={loading}
                    copiedId={copiedId}
                    deletingId={deletingId}
                    onOpen={onOpen}
                    onCopyLink={onCopyLink}
                    onDelete={onDelete}
                />
            </div>
        </div>
    );
}
