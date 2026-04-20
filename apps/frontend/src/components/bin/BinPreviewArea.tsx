type PreviewMode = 'plain' | 'code' | 'markdown';

const PREVIEW_LABELS: Record<PreviewMode, string> = {
    plain: 'Plain text',
    code: 'Source code',
    markdown: 'Markdown',
};

interface Props {
    content: string;
    previewMode: PreviewMode;
    markdownHtml: string;
    onPreviewModeChange: (m: PreviewMode) => void;
}

export function BinPreviewArea({ content, previewMode, markdownHtml, onPreviewModeChange }: Props) {
    return (
        <div className="bin-preview-area">
            <div className="bin-format-bar">
                {(Object.keys(PREVIEW_LABELS) as PreviewMode[]).map(m => (
                    <button key={m} type="button"
                        className={`bin-format-btn ${previewMode === m ? 'active' : ''}`}
                        onClick={() => onPreviewModeChange(m)}
                    >
                        {PREVIEW_LABELS[m]}
                    </button>
                ))}
            </div>
            {content ? (
                previewMode === 'markdown' ? (
                    <div className="bin-preview-markdown" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
                ) : previewMode === 'code' ? (
                    <pre className="bin-preview-code"><code>{content}</code></pre>
                ) : (
                    <pre className="bin-preview-plain">{content}</pre>
                )
            ) : (
                <div className="bin-preview-empty">
                    <i className="bi bi-eye-slash" />
                    <span>Nothing to preview yet. Switch to Write and add some text.</span>
                </div>
            )}
        </div>
    );
}
