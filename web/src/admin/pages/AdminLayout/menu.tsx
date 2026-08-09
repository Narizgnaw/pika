import type {JSX} from 'react';
import {Activity, AlertTriangle, Globe, Key, Server, Settings} from 'lucide-react';

export interface NavItem {
    key: string;
    label: string;
    path: string;
    icon: JSX.Element;
}

export const menuItems: NavItem[] = [
    {key: 'agents', label: '探针管理', path: '/admin/agents', icon: <Server className="h-4 w-4" strokeWidth={2}/>},
    {key: 'monitors', label: '服务监控', path: '/admin/monitors', icon: <Activity className="h-4 w-4" strokeWidth={2}/>},
    {key: 'ddns', label: 'DDNS', path: '/admin/ddns', icon: <Globe className="h-4 w-4" strokeWidth={2}/>},
    {key: 'comm-keys', label: '通信密钥', path: '/admin/api-keys', icon: <Key className="h-4 w-4" strokeWidth={2}/>},
    {key: 'api-keys', label: 'API密钥', path: '/admin/manage-api-keys', icon: <Key className="h-4 w-4" strokeWidth={2}/>},
    {key: 'alert-records', label: '告警记录', path: '/admin/alert-records', icon: <AlertTriangle className="h-4 w-4" strokeWidth={2}/>},
    {key: 'settings', label: '系统设置', path: '/admin/settings', icon: <Settings className="h-4 w-4" strokeWidth={2}/>},
];

export const SIDEBAR_WIDTH = 240;
export const HEADER_HEIGHT = 56;
