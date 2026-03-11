import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

interface PlatformContextData {
    platformName: string;
    platformLogo: string;
}

const PlatformContext = createContext<PlatformContextData>({
    platformName: 'Meu Ateliê',
    platformLogo: '/logo.png',
});

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [platformName, setPlatformName] = useState('Meu Ateliê');
    const [platformLogo, setPlatformLogo] = useState('/logo.png');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('plan_config')
                    .select('platform_name, platform_logo_url')
                    .maybeSingle();

                if (error) {
                    console.error('[PlatformContext] Supabase error:', error.message);
                    return;
                }

                if (data) {
                    if (data.platform_name) {
                        setPlatformName(data.platform_name);
                        document.title = `${data.platform_name} - Dashboard`;
                    }
                    if (data.platform_logo_url) {
                        console.log('[PlatformContext] Logo URL loaded:', data.platform_logo_url.substring(0, 60));
                        setPlatformLogo(data.platform_logo_url);
                    } else {
                        console.warn('[PlatformContext] platform_logo_url is empty, using fallback /logo.png');
                    }
                } else {
                    console.warn('[PlatformContext] No row found in plan_config');
                }
            } catch (err) {
                console.error('[PlatformContext] Unexpected error:', err);
            }
        };

        fetchConfig();

        // Re-busca quando o admin salvar configurações
        window.addEventListener('platform-config-updated', fetchConfig);
        return () => window.removeEventListener('platform-config-updated', fetchConfig);
    }, []);

    return (
        <PlatformContext.Provider value={{ platformName, platformLogo }}>
            {children}
        </PlatformContext.Provider>
    );
};

export const usePlatform = () => useContext(PlatformContext);
