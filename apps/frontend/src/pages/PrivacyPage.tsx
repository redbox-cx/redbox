import privacyContent from '../assets/terms/Privacy_Policy.md?raw';
import { LegalPage } from './LegalPage';

export function PrivacyPage() {
    return <LegalPage content={privacyContent} />;
}
