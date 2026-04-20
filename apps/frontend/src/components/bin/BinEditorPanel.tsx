import { useState } from 'react';
import { marked } from 'marked';
import { BinWriteForm } from './BinWriteForm';
import { BinPreviewArea } from './BinPreviewArea';
import { BinQuota } from './BinQuota';

type PreviewMode = 'plain' | 'code' | 'markdown';

interface SaveFields {
    title: string;
    content: string;
    password: string;
    expiresIn: string;
}

interface Props {
    binCount: number;
    onSave: (fields: SaveFields) => Promise<void>;
}

const BIN_LIMIT = 100;

export function BinEditorPanel({ binCount, onSave }: Props) {
    const [isPreview, setIsPreview] = useState(false);
    const [previewMode, setPreviewMode] = useState<PreviewMode>('plain');

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [expiresIn, setExpiresIn] = useState('30d');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const markdownHtml = isPreview && previewMode === 'markdown'
        ? marked.parse(content, { async: false }) as string : '';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setCreating(true);
        try {
            await onSave({ title, content, password, expiresIn });
            setTitle(''); setContent(''); setPassword('');
            setShowPassword(false); setExpiresIn('30d'); setIsPreview(false);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to create bin.');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="upload-drive-left">
            <div className="bin-tab-row">
                <button
                    type="button"
                    className={`widget-tab bin-mode-tab ${!isPreview ? 'bin-tab-active' : ''}`}
                    onClick={() => setIsPreview(false)}
                >
                    <i className="bi bi-pencil" /> Write
                </button>
                <button
                    type="button"
                    className={`widget-tab bin-mode-tab ${isPreview ? 'bin-tab-active' : ''}`}
                    onClick={() => setIsPreview(true)}
                >
                    <i className="bi bi-eye" /> Preview
                </button>
            </div>

            <div className="glass-panel upload-panel bin-create-panel">
                {!isPreview ? (
                    <BinWriteForm
                        title={title}
                        content={content}
                        password={password}
                        showPassword={showPassword}
                        expiresIn={expiresIn}
                        creating={creating}
                        error={error}
                        binCount={binCount}
                        onTitleChange={setTitle}
                        onContentChange={setContent}
                        onPasswordChange={setPassword}
                        onShowPasswordToggle={() => setShowPassword(v => !v)}
                        onExpiresInChange={setExpiresIn}
                        onSubmit={handleSubmit}
                    />
                ) : (
                    <BinPreviewArea
                        content={content}
                        previewMode={previewMode}
                        markdownHtml={markdownHtml}
                        onPreviewModeChange={setPreviewMode}
                    />
                )}
                <BinQuota used={binCount} limit={BIN_LIMIT} />
            </div>
        </div>
    );
}
