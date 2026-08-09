import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import AdminApp from './App';
import './index.css';

dayjs.locale('zh-cn');

// 异步加载运行时配置，不阻塞渲染
fetch('/api/config')
    .then((res) => res.ok ? res.json() : Promise.reject())
    .then((payload) => {
        window.PikaRuntime = payload;
        window.SystemConfig = payload.legacySystemConfig;
    })
    .catch(() => {
        window.SystemConfig = {
            SystemNameZh: '皮卡监控',
            SystemNameEn: 'Pika Monitor',
            ICPCode: '',
            DefaultView: 'grid',
            Version: '',
        };
    })
    .finally(() => {
        const queryClient = new QueryClient({
            defaultOptions: {queries: {refetchOnWindowFocus: false, retry: 1}},
        });
        createRoot(document.getElementById('root')!).render(
            <StrictMode>
                <QueryClientProvider client={queryClient}>
                    <AdminApp/>
                </QueryClientProvider>
            </StrictMode>,
        );
    });
