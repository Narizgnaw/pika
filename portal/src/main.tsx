import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {pika} from './api';
import type {PikaRuntimeConfig} from './types';
import PortalApp from './App';
import './index.css';

const fallbackRuntime: PikaRuntimeConfig = {
    apiVersion: 'v1',
    system: {
        nameZh: '皮卡监控',
        nameEn: 'Pika Monitor',
        logo: '/api/logo',
        icpCode: '',
        version: '',
        defaultView: 'grid',
        defaultColorMode: 'system',
    },
    theme: {id: 'default', version: '1.0.0'},
    features: {
        serverList: true,
        serverDetail: true,
        monitorList: true,
        monitorDetail: true,
    },
};

const start = async () => {
    if (!window.PikaRuntime) {
        try {
            window.PikaRuntime = await pika.getConfig();
        } catch (error) {
            window.PikaRuntime = fallbackRuntime;
            console.error(error);
        }
    }

    const queryClient = new QueryClient({
        defaultOptions: {queries: {refetchOnWindowFocus: false, retry: 1}},
    });
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <PortalApp/>
            </QueryClientProvider>
        </StrictMode>,
    );
};

start().catch(console.error);
