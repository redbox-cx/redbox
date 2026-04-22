import { useMemo } from 'react';
import { renderSafeMarkdown } from '../utils/safeMarkdown';
import { MainLayout } from '../components/MainLayout';
import { Footer } from '../components/Footer';

interface Props {
    content: string;
}

export function LegalPage({ content }: Props) {
    const html = useMemo(() => renderSafeMarkdown(content), [content]);

    return (
        <div className="page-wrapper">
            <MainLayout>
                <div className="legal-page">
                    <div
                        className="legal-content"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </div>
            </MainLayout>
            <Footer />
        </div>
    );
}
