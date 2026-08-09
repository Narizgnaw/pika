export {};

declare global {
    interface AdminRuntimeConfig {
        apiVersion: 'v1';
        system: {
            nameZh: string;
            nameEn: string;
            logo: string;
            icpCode: string;
            version: string;
            defaultView: string;
            defaultColorMode: 'light' | 'dark' | 'system';
        };
        theme: {id: string; version: string};
        features: Record<string, boolean>;
        legacySystemConfig: Window['SystemConfig'];
    }

    interface Window {
        PikaRuntime: AdminRuntimeConfig;
        SystemConfig: {
            SystemNameZh: string;
            SystemNameEn: string;
            ICPCode: string;
            DefaultView: string;
            Version: string;
        };
    }
}
