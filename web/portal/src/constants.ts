import type {TimeRangeOption} from './types';

export const LIVE_RANGE = 'live';
export const LIVE_INITIAL_RANGE = '2m';
export const LIVE_WINDOW_MS = 2 * 60 * 1000;

export const SERVER_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    {label: '实时', value: LIVE_RANGE},
    {label: '15分钟', value: '15m'},
    {label: '30分钟', value: '30m'},
    {label: '1小时', value: '1h'},
    {label: '3小时', value: '3h'},
    {label: '6小时', value: '6h'},
    {label: '12小时', value: '12h'},
    {label: '1天', value: '1d'},
    {label: '3天', value: '3d'},
    {label: '7天', value: '7d'},
];

export const MONITOR_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    {label: '12小时', value: '12h'},
    {label: '1天', value: '1d'},
    {label: '3天', value: '3d'},
    {label: '7天', value: '7d'},
];

export const AGENT_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6',
];

export const INTERFACE_COLORS = [
    {upload: '#6FD598', download: '#2C70F6'},
    {upload: '#f59e0b', download: '#8b5cf6'},
    {upload: '#ec4899', download: '#06b6d4'},
    {upload: '#10b981', download: '#f97316'},
    {upload: '#14b8a6', download: '#2563eb'},
];

export const TEMPERATURE_COLORS: Record<string, string> = {
    'CPU': '#f97316', 'GPU': '#8b5cf6', 'DISK': '#06b6d4', 'BATTERY': '#10b981',
    'CHIPSET': '#f59e0b', 'SYSTEM': '#6366f1', 'PSU': '#ec4899',
};

export const ACCENT_THEMES: Record<'blue' | 'emerald' | 'purple' | 'amber', { icon: string; badge: string; highlight: string }> = {
    blue: {icon: 'text-blue-400', badge: 'text-blue-400', highlight: 'text-blue-400'},
    emerald: {icon: 'text-emerald-400', badge: 'text-emerald-400', highlight: 'text-emerald-400'},
    purple: {icon: 'text-purple-400', badge: 'text-purple-400', highlight: 'text-purple-400'},
    amber: {icon: 'text-amber-400', badge: 'text-amber-400', highlight: 'text-amber-400'},
};
