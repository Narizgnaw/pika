import {type ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatBytes = (value: number | undefined | null, precision = 2): string => {
    if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** index).toFixed(precision)} ${units[index]}`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
    if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
    const units = ['B/s', 'K/s', 'M/s', 'G/s', 'T/s'];
    const index = Math.min(Math.floor(Math.log(bytesPerSecond) / Math.log(1024)), units.length - 1);
    const value = bytesPerSecond / 1024 ** index;
    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} ${units[index]}`;
};

export const formatTime = (milliseconds: number): string => {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0 ms';
    if (milliseconds < 1000) return `${milliseconds.toFixed(0)} ms`;
    return `${(milliseconds / 1000).toFixed(2)} s`;
};

export const formatDateTime = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const formatPercentValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null || Number.isNaN(value)) return '0.0';
    return value.toFixed(1);
};

export const formatUptime = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null) return '-';
    if (seconds <= 0) return '0 秒';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} 天${hours > 0 ? ` ${hours} 小时` : ''}`;
    if (hours > 0) return `${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ''}`;
    return minutes > 0 ? `${minutes} 分钟` : '不到 1 分钟';
};

export const formatChartTime = (timestamp: number, timeRange: string, rangeMs?: number): string => {
    const date = new Date(timestamp);
    if (timeRange === 'live') {
        return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
    }
    const isLongRange = rangeMs !== undefined
        ? rangeMs >= 24 * 60 * 60 * 1000
        : timeRange === '1d' || timeRange === '24h' || (timeRange.endsWith('d') && Number.parseInt(timeRange) > 1);
    if (isLongRange) {
        const pad = (part: number) => String(part).padStart(2, '0');
        return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    return date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
};

export const isExpired = (expireTime?: number) => {
    return Boolean(expireTime && expireTime > 0 && expireTime - Date.now() < 30 * 24 * 60 * 60 * 1000);
};
