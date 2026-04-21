import tosContent from '../assets/terms/ToS.md?raw';
import { LegalPage } from './LegalPage';

export function TermsPage() {
    return <LegalPage content={tosContent} />;
}
