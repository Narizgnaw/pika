/* Pika 公开 API 客户端。自动拼接 /api 前缀并从 localStorage 读取登录 token。 */

import type {
    PikaRuntimeConfig, ColorMode,
    Agent, LatestMetrics, PublicMonitor, AgentMonitorStat,
    MetricsResponse, MetricsParams, HistoryParams,
    TagsResponse, NetworkInterfacesResponse, ListAgentParams, CurrentUser,
} from './types';

export class PikaAPIError extends Error {
    constructor(public status: number, message: string, public data?: unknown) {
        super(message);
        this.name = 'PikaAPIError';
    }
}

type Query = Record<string, string | number | boolean | undefined>;

const request = async <T>(path: string, query?: Query): Promise<T> => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined) search.set(key, String(value));
    }
    const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('token');
    const response = await fetch('/api' + path + (search.size ? '?' + search : ''), {
        headers: token ? {Authorization: 'Bearer ' + token} : {},
    });
    const contentType = response.headers.get('content-type') || '';
    const data: unknown = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
            ? data.message
            : 'Pika API 请求失败';
        throw new PikaAPIError(response.status, message, data);
    }
    return data as T;
};

export const pika = {
    getConfig: () => request<PikaRuntimeConfig>('/config'),
    listAgents: <T = Agent>(params: ListAgentParams = {}) => request<T[]>('/agents', params),
    getAgent: <T = Agent>(id: string) => request<T>('/agents/' + encodeURIComponent(id)),
    getLatestMetrics: <T = LatestMetrics>(id: string) =>
        request<T>('/agents/' + encodeURIComponent(id) + '/metrics/latest'),
    getMetrics: <T = MetricsResponse>(id: string, params: MetricsParams = {}) =>
        request<T>('/agents/' + encodeURIComponent(id) + '/metrics', params),
    getTags: <T = TagsResponse>() => request<T>('/agents/tags'),
    getNetworkInterfaces: <T = NetworkInterfacesResponse>(id: string) =>
        request<T>('/agents/' + encodeURIComponent(id) + '/network-interfaces'),
    listMonitors: <T = PublicMonitor>() => request<T[]>('/monitors'),
    getMonitorStats: <T = Record<string, unknown>>(id: string) =>
        request<T>('/monitors/' + encodeURIComponent(id) + '/stats'),
    getMonitorAgents: <T = AgentMonitorStat[]>(id: string) =>
        request<T[]>('/monitors/' + encodeURIComponent(id) + '/agents'),
    getMonitorHistory: <T = MetricsResponse>(id: string, params: HistoryParams = {}) =>
        request<T>('/monitors/' + encodeURIComponent(id) + '/history', params),
    getCurrentUser: <T = CurrentUser>() => request<T>('/admin/account/info'),
};

/* 运行时配置（后端在入口 HTML 注入 window.PikaRuntime） */

declare global {
    interface Window {PikaRuntime?: PikaRuntimeConfig}
}

export const getRuntimeConfig = (): PikaRuntimeConfig => {
    if (typeof window === 'undefined' || !window.PikaRuntime) {
        throw new Error('PikaRuntime 尚未注入');
    }
    return window.PikaRuntime;
};

export const resolveColorMode = (mode: ColorMode): Exclude<ColorMode, 'system'> => {
    if (mode !== 'system') return mode;
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
