import {lazy, Suspense} from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {ColorModeProvider} from './contexts/ColorMode';

const PublicLayout = lazy(() => import('./pages/PublicLayout'));
const ServerList = lazy(() => import('./pages/ServerList'));
const ServerDetail = lazy(() => import('./pages/ServerDetail'));
const MonitorList = lazy(() => import('./pages/MonitorList'));
const MonitorDetail = lazy(() => import('./pages/MonitorDetail'));

export default function PortalApp() {
    return (
        <ColorModeProvider>
            <BrowserRouter>
                <Suspense fallback={<div className="flex h-[75vh] items-center justify-center text-gray-500 dark:text-cyan-300">页面加载中...</div>}>
                    <Routes>
                        <Route element={<PublicLayout/>}>
                            <Route path="/" element={<ServerList/>}/>
                            <Route path="/servers/:id" element={<ServerDetail/>}/>
                            <Route path="/monitors" element={<MonitorList/>}/>
                            <Route path="/monitors/:id" element={<MonitorDetail/>}/>
                        </Route>
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </ColorModeProvider>
    );
}
