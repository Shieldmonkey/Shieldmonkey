import { createContext, useState, useEffect, useContext, type ReactNode, useCallback } from 'react';
import enMessages from '../../public/_locales/en/messages.json';
import jaMessages from '../../public/_locales/ja/messages.json';

type Locale = 'en' | 'ja' | 'system';
type Messages = Record<string, { message: string, description?: string, placeholders?: Record<string, { content: string }> }>;

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, substitutions?: string | string[]) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const MESSAGES: Record<'en' | 'ja', Messages> = {
    en: enMessages,
    ja: jaMessages
};



export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>('system');
    const activeLang = (locale === 'system'
        ? (navigator.language.split('-')[0] === 'ja' ? 'ja' : 'en')
        : locale) as 'en' | 'ja';

    // Initialize from storage
    useEffect(() => {
        chrome.storage.local.get('locale', (data) => {
            if (data.locale) {
                setLocaleState(data.locale as Locale);
            }
        });
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        chrome.storage.local.set({ locale: newLocale });
    };

    const t = useCallback((key: string, substitutions?: string | string[]) => {
        const messages = MESSAGES[activeLang] || MESSAGES['en'];
        const entry = messages[key];

        if (!entry) {
            // Fallback to English if missing in active lang
            if (activeLang !== 'en') {
                const enEntry = MESSAGES['en'][key];
                if (enEntry) return applySubstitutions(enEntry.message, substitutions);
            }
            return key;
        }

        return applySubstitutions(entry.message, substitutions);
    }, [activeLang]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
};

// Helper for substitutions
function applySubstitutions(message: string, substitutions?: string | string[]): string {
    if (!substitutions) return message;

    if (typeof substitutions === 'string') {
        return message.replace(/\$1/g, substitutions);
    }

    let result = message;
    substitutions.forEach((sub, index) => {
        // Replace $1, $2, etc. (1-indexed)
        const placeholder = new RegExp(`\\$${index + 1}`, 'g');
        result = result.replace(placeholder, sub);
    });
    return result;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTranslation = useI18n;
