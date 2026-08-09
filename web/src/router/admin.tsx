import {createBrowserRouter, Navigate} from 'react-router-dom';
import {type ComponentType, lazy, type LazyExoticComponent, Suspense} from 'react';
import PrivateRoute from '@/components/PrivateRoute';

const LoginPage = lazy(() => import('@/pages/Login'));
const GitHubCallbackPage = lazy(() => import('@/pages/Login/GitHubCallback'));
const OIDCCallbackPage = lazy(() => import('@/pages/Login/OIDCCallback'));
const AdminLayout = lazy(() => import('@/pages/AdminLayout'));
const AgentListPage = lazy(() => import('@/pages/Agents/AgentList'));
const AgentDetailPage = lazy(() => import('@/pages/Agents/AgentDetail'));
const AgentInstallOneClickPage = lazy(() => import('@/pages/Agents/AgentInstallOneClick'));
const AgentInstallManualPage = lazy(() => import('@/pages/Agents/AgentInstallManual'));
const ApiKeyListPage = lazy(() => import('@/pages/ApiKeys/ApiKeyList'));
const ManageApiKeyListPage = lazy(() => import('@/pages/ManageApiKeys/ManageApiKeyList'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const MonitorListPage = lazy(() => import('@/pages/Monitors/MonitorList'));
const DDNSPage = lazy(() => import('@/pages/DDNS'));
const AlertRecordListPage = lazy(() => import('@/pages/AlertRecords'));

const lazyLoad = (Component: LazyExoticComponent<ComponentType<any>>) => (
    <Suspense fallback={<div className="flex h-[75vh] items-center justify-center text-gray-500">页面加载中...</div>}>
        <Component/>
    </Suspense>
);

export default createBrowserRouter([
    {path: '/admin/login', element: lazyLoad(LoginPage)},
    {path: '/admin/github/callback', element: lazyLoad(GitHubCallbackPage)},
    {path: '/admin/oidc/callback', element: lazyLoad(OIDCCallbackPage)},
    {
        path: '/admin',
        element: <PrivateRoute><AdminLayout/></PrivateRoute>,
        children: [
            {index: true, element: <Navigate to="/admin/agents" replace/>},
            {path: 'agents', element: lazyLoad(AgentListPage)},
            {path: 'agents/:id', element: lazyLoad(AgentDetailPage)},
            {path: 'agents-install', element: <Navigate to="/admin/agents-install/one-click" replace/>},
            {path: 'agents-install/one-click', element: lazyLoad(AgentInstallOneClickPage)},
            {path: 'agents-install/manual', element: lazyLoad(AgentInstallManualPage)},
            {path: 'api-keys', element: lazyLoad(ApiKeyListPage)},
            {path: 'manage-api-keys', element: lazyLoad(ManageApiKeyListPage)},
            {path: 'monitors', element: lazyLoad(MonitorListPage)},
            {path: 'ddns', element: lazyLoad(DDNSPage)},
            {path: 'alert-records', element: lazyLoad(AlertRecordListPage)},
            {path: 'settings', element: lazyLoad(SettingsPage)},
        ],
    },
    {path: '*', element: <Navigate to="/admin" replace/>},
]);
