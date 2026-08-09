/* 主题前端使用的全部类型定义。 */

export type ColorMode = 'light' | 'dark' | 'system';
export type MetricsAggregation = 'avg' | 'max' | 'raw';

export interface PikaRuntimeConfig {
    apiVersion: 'v1';
    system: {
        nameZh: string;
        nameEn: string;
        logo: string;
        icpCode: string;
        version: string;
        defaultView: string;
        defaultColorMode: ColorMode;
    };
    theme: {id: string; version: string};
    features: Record<string, boolean>;
    legacySystemConfig?: LegacySystemConfig;
}

interface LegacySystemConfig {
    SystemNameZh: string;
    SystemNameEn: string;
    ICPCode: string;
    DefaultView: string;
    Version: string;
}

export interface ListAgentParams {tag?: string; page?: number; pageSize?: number; [key: string]: string | number | boolean | undefined}
export interface MetricsParams {
    type?: 'cpu' | 'memory' | 'disk' | 'network' | 'network_connection' | 'disk_io' | 'gpu' | 'temperature' | 'monitor';
    range?: string;
    start?: number;
    end?: number;
    interface?: string;
    aggregation?: MetricsAggregation;
    [key: string]: string | number | boolean | undefined;
}
export interface HistoryParams {
    range?: string;
    start?: number;
    end?: number;
    aggregation?: MetricsAggregation;
    [key: string]: string | number | boolean | undefined;
}
export interface TimeRangeOption {label: string; value: string}

export interface Agent {
    id: string;
    name: string;
    hostname: string;
    ip: string;
    ipv4?: string;
    ipv6?: string;
    os: string;
    arch: string;
    version: string;
    tags?: string[];
    expireTime?: number;
    status: number;
    visibility?: string;
    weight?: number;
    remark?: string;
    lastSeenAt: string | number;
    trafficStats?: {
        enabled: boolean;
        type: string;
        limit: number;
        used: number;
        resetDay: number;
        periodStart: number;
        periodEnd: number;
        daysUntilReset: number;
        baselineRecv: number;
        baselineSend: number;
        alertSent80: boolean;
        alertSent90: boolean;
        alertSent100: boolean;
    };
}

export interface CPUMetric {
    timestamp: number;
    logicalCores: number;
    physicalCores: number;
    modelName: string;
    usagePercent: number;
}

export interface MemoryMetric {
    timestamp: number;
    total: number;
    used: number;
    free: number;
    available: number;
    usagePercent: number;
    swapTotal: number;
    swapUsed: number;
    swapFree: number;
}

export interface DiskSummary {
    usagePercent: number;
    totalDisks: number;
    total: number;
    used: number;
    free: number;
}

export interface DiskIOSummary {
    totalReadBytesRate: number;
    totalWriteBytesRate: number;
    totalDevices: number;
}

export interface NetworkSummary {
    totalBytesSentRate: number;
    totalBytesRecvRate: number;
    totalBytesSentTotal: number;
    totalBytesRecvTotal: number;
    totalInterfaces: number;
}

export interface NetworkInterfaceMetric {
    interface: string;
    macAddress?: string;
    addrs?: string[];
    bytesSentRate: number;
    bytesRecvRate: number;
    bytesSentTotal: number;
    bytesRecvTotal: number;
}

export interface NetworkConnectionMetric {
    established: number;
    synSent: number;
    synRecv: number;
    finWait1: number;
    finWait2: number;
    timeWait: number;
    close: number;
    closeWait: number;
    lastAck: number;
    listen: number;
    closing: number;
    total: number;
}

export interface HostInfo {
    uptime: number;
    bootTime: number;
    procs: number;
    load1: number;
    load5: number;
    load15: number;
    platform: string;
    platformVersion: string;
    kernelVersion: string;
    kernelArch: string;
}

export interface GPUMetric {
    index: number;
    name: string;
    utilization: number;
    memoryTotal: number;
    memoryUsed: number;
    memoryFree: number;
    temperature: number;
    powerUsage: number;
    fanSpeed: number;
}

export interface TemperatureMetric {
    sensorKey: string;
    type: string;
    temperature: number;
}

export interface MonitorData {
    agentId: string;
    agentName: string;
    monitorId: string;
    monitorName?: string;
    type: string;
    target?: string;
    status: string;
    statusCode?: number;
    responseTime: number;
    error?: string;
    checkedAt: number;
    message?: string;
    contentMatch?: boolean;
    certExpiryTime?: number;
    certDaysLeft?: number;
}

export interface LatestMetrics {
    timestamp?: number;
    cpu?: CPUMetric;
    memory?: MemoryMetric;
    disk?: DiskSummary;
    diskIO?: DiskIOSummary;
    network?: NetworkSummary;
    networkInterfaces?: NetworkInterfaceMetric[];
    networkConnection?: NetworkConnectionMetric;
    host?: HostInfo;
    gpu?: GPUMetric[];
    temperature?: TemperatureMetric[];
    monitors?: MonitorData[];
}

export interface PublicMonitor {
    id: string;
    name: string;
    type: 'http' | 'https' | 'tcp' | 'icmp' | 'ping';
    target: string;
    showTargetPublic: boolean;
    description?: string;
    enabled: boolean;
    interval: number;
    agentIds: string[];
    agentCount: number;
    status: string;
    responseTime: number;
    responseTimeMin: number;
    responseTimeMax: number;
    certExpiryTime: number;
    certDaysLeft: number;
    agentStats: {up: number; down: number; unknown: number};
    lastCheckTime: number;
}

export interface AgentMonitorStat {
    agentId: string;
    agentName: string;
    monitorId: string;
    type: string;
    target: string;
    status: string;
    statusCode: number;
    responseTime: number;
    checkedAt: number;
    message: string;
    certExpiryTime: number;
    certDaysLeft: number;
}

export interface MetricPoint {timestamp: number; value: number}
export interface MetricSeries {name: string; labels?: Record<string, string>; data: MetricPoint[]}
export interface MetricsResponse {agentId: string; type: string; range: string; series: MetricSeries[]}
export interface TagsResponse {tags: string[]}
export interface NetworkInterfacesResponse {interfaces: string[]}
export interface CurrentUser {userId: string; username: string}
