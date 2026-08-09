// DNS Provider 配置
export interface DNSProviderConfig {
    provider: 'aliyun' | 'tencentcloud' | 'cloudflare' | 'huaweicloud';
    enabled: boolean;
    config: Record<string, string>; // 已脱敏的配置
}

export interface DDNSConfig {
    id: string;
    agentId: string;
    name: string;
    enabled: boolean;
    provider: 'aliyun' | 'tencentcloud' | 'cloudflare' | 'huaweicloud';
    domainsIpv4: string[] | string;  // IPv4 域名列表
    domainsIpv6: string[] | string;  // IPv6 域名列表
    enableIpv4: boolean;
    enableIpv6: boolean;
    ipv4GetMethod: 'api' | 'interface';
    ipv6GetMethod: 'api' | 'interface';
    ipv4GetValue?: string;
    ipv6GetValue?: string;
    createdAt: number;
    updatedAt: number;
}

export interface DDNSRecord {
    id: string;
    configId: string;
    agentId: string;
    domain: string;
    recordType: 'A' | 'AAAA';
    oldIp?: string;
    newIp: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    createdAt: number;
}

export interface CreateDDNSConfigRequest {
    agentId: string;
    name: string;
    provider: string;
    domainsIpv4: string[];  // IPv4 域名列表
    domainsIpv6: string[];  // IPv6 域名列表
    enableIpv4: boolean;
    enableIpv6: boolean;
    ipv4GetMethod?: string;
    ipv6GetMethod?: string;
    ipv4GetValue?: string;
    ipv6GetValue?: string;
}

export interface UpdateDDNSConfigRequest {
    name?: string;
    provider?: string;
    domainsIpv4?: string[];  // IPv4 域名列表
    domainsIpv6?: string[];  // IPv6 域名列表
    enableIpv4?: boolean;
    enableIpv6?: boolean;
    ipv4GetMethod?: string;
    ipv6GetMethod?: string;
    ipv4GetValue?: string;
    ipv6GetValue?: string;
}

export interface UpsertDNSProviderRequest {
    provider: 'aliyun' | 'tencentcloud' | 'cloudflare' | 'huaweicloud';
    enabled: boolean;
    config: Record<string, string>;
}
