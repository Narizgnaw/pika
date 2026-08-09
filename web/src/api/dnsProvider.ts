import {del, get, post} from './request';
import type {DNSProviderConfig, UpsertDNSProviderRequest} from '@/types/ddns';

// 获取所有 DNS Provider 配置
export const getDNSProviders = () => {
    return get<DNSProviderConfig[]>('/admin/dns-providers');
};

// 创建或更新 DNS Provider 配置
export const upsertDNSProvider = (data: UpsertDNSProviderRequest) => {
    return post<{message: string}>('/admin/dns-providers', data);
};

// 删除 DNS Provider 配置
export const deleteDNSProvider = (provider: string) => {
    return del<{message: string}>(`/admin/dns-providers/${provider}`);
};
