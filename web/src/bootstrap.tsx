import {StrictMode, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './index.css';

dayjs.locale('zh-cn');

export const renderApplication = (application: ReactNode) => {
    const queryClient = new QueryClient({
        defaultOptions: {queries: {refetchOnWindowFocus: false, retry: 1}},
    });
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>{application}</QueryClientProvider>
        </StrictMode>,
    );
};

export const loadRuntimeConfig = async () => {
    if (window.PikaRuntime) return;
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('无法加载 Pika 运行时配置');
    const payload = await response.json();
    window.PikaRuntime = payload;
    window.SystemConfig = payload.legacySystemConfig;
};

export const ensureRuntimeFallback = () => {
    if (window.SystemConfig) return;
    window.SystemConfig = {
        SystemNameZh: '皮卡监控',
        SystemNameEn: 'Pika Monitor',
        ICPCode: '',
        DefaultView: 'grid',
        Version: '',
    };
};
