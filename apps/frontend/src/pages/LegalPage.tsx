import { useMemo } from 'react';
import { marked } from 'marked';
import { MainLayout } from '../components/MainLayout';
import { Footer } from '../components/Footer';

interface Props {
    content: string;
}

export function LegalPage({ content }: Props) {
    const html = useMemo(() => marked.parse(content) as string, [content]);

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
