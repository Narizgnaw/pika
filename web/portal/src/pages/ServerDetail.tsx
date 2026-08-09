import {memo, type ReactNode, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {
    Activity,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Cpu,
    HardDrive,
    MemoryStick,
    Network,
    RotateCcw,
    Thermometer,
    Zap
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import type {Agent, LatestMetrics} from '../types';
import {
    INTERFACE_COLORS,
    LIVE_INITIAL_RANGE,
    LIVE_RANGE,
    LIVE_WINDOW_MS,
    SERVER_TIME_RANGE_OPTIONS,
    TEMPERATURE_COLORS,
} from '../constants';
import {
    cn,
    formatBytes,
    formatChartTime,
    formatDateTime,
    formatPercentValue,
    formatUptime,
} from '../lib/utils';
import {
    useAgentQuery,
    useLatestMetricsQuery,
    useLiveBuffer,
    useMetricsQuery,
    useIsMobile,
    useNetworkInterfacesQuery,
} from '../hooks';
import {
    Card,
    ChartPlaceholder,
    CustomTooltip,
    EmptyState,
    LoadingSpinner,
    MetricItem,
    StatusBadge,
    TimeRangeSelector
} from '../components';

/* ========================================== 共享工具 ========================================== */

const toMB = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(2));

/* ========================================== ChartContainer ========================================== */

interface ChartContainerProps {
    title: string;
    icon: LucideIcon;
    children: ReactNode;
    action?: ReactNode;
}

const ChartContainer = ({title, icon: Icon, children, action}: ChartContainerProps) => {
    return (
        <section>
            <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-widest text-gray-700 dark:text-cyan-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 dark:bg-cyan-500/10 text-gray-700 dark:text-cyan-500">
            <Icon className="h-4 w-4"/>
          </span>
                    {title}
                </h3>
                {action}
            </div>
            {children}
        </section>
    );
};

/* ========================================== ServerHero ========================================== */

interface ServerHeroProps {
    agent: Agent;
    latestMetrics: LatestMetrics | null;
    onBack: () => void;
}

const ServerHero = ({agent, latestMetrics, onBack}: ServerHeroProps) => {
    const displayName = agent?.name?.trim() ? agent.name : '未命名探针';
    const isOnline = agent?.status === 1;
    const statusDotStyles = isOnline ? 'bg-emerald-500' : 'bg-rose-500';
    const statusText = isOnline ? '在线' : '离线';

    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';

    const networkSummary = latestMetrics?.network
        ? `${formatBytes(latestMetrics.network.totalBytesSentTotal)} ↑ / ${formatBytes(
            latestMetrics.network.totalBytesRecvTotal,
        )} ↓`
        : '—';

    const heroStats = [
        {label: '运行系统', value: platformDisplay || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: '系统进程', value: latestMetrics?.host?.procs || '-'},
        {label: '运行时长', value: uptimeDisplay},
    ];

    return (
        <Card className={'p-6'}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={onBack}
                            className="group inline-flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-[0.3em] dark:text-cyan-500 transition dark:hover:text-cyan-500"
                        >
                            <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5"/>
                            返回概览
                        </button>
                        <div className="flex items-start gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-3xl font-bold dark:text-cyan-100">{displayName}</h1>
                                    <StatusBadge status={agent.status === 1 ? 'up' : 'down'}/>
                                </div>
                                <p className="mt-2 text-sm dark:text-cyan-500 font-mono">
                                    {[agent.hostname].filter(Boolean).join(' · ') || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto lg:min-w-[480px]">
                        {heroStats.map((stat) => (
                            <MetricItem key={stat.label} label={stat.label} value={stat.value}/>
                        ))}
                    </div>
                </div>
                <div
                    className="flex flex-wrap items-center gap-3 text-xs dark:text-cyan-500 font-mono pt-4 border-t border-cyan-900/30">
                    <span>探针 ID：{agent.id}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-cyan-900 sm:inline-block"/>
                    <span>版本：{agent.version || '-'}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-cyan-900 sm:inline-block"/>
                    <span>网络累计：{networkSummary}</span>
                </div>
            </div>
        </Card>
    );
};

/* ========================================== SystemInfoSection ========================================== */

interface SystemInfoSectionProps {
    agent: Agent;
    latestMetrics: LatestMetrics | null;
}

const InfoGrid = ({items}: {items: Array<{label: string; value: ReactNode}>}) => (
    <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        {items.map((item) => (
            <div key={item.label}>
                <dt className="text-xs font-mono uppercase tracking-widest text-gray-600 dark:text-cyan-500">{item.label}</dt>
                <dd className="mt-1 font-medium text-slate-800 dark:text-cyan-100">{item.value}</dd>
            </div>
        ))}
    </dl>
);

type SnapshotCardData = {
    key: string;
    icon: LucideIcon;
    title: string;
    usagePercent: string;
    accent: 'blue' | 'emerald' | 'purple' | 'amber';
    metrics: Array<{label: string; value: ReactNode}>;
};

const snapshotColors = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
};

const SnapshotGrid = ({cards}: {cards: SnapshotCardData[]}) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
            <div
                key={card.key}
                className="rounded-xl border border-slate-200 dark:border-cyan-900/50 bg-slate-50 dark:bg-black/40 p-4 transition hover:border-slate-300 dark:hover:border-cyan-700/50"
            >
                <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 dark:bg-cyan-500/10', snapshotColors[card.accent])}>
                            <card.icon className="h-4 w-4"/>
                        </span>
                        <p className="text-xs font-bold font-mono uppercase tracking-wider text-gray-700 dark:text-cyan-300">{card.title}</p>
                    </div>
                    <span className={cn('text-xl font-bold', snapshotColors[card.accent])}>{card.usagePercent}</span>
                </div>
                <div className="space-y-2">
                    {card.metrics.map((metric) => (
                        <div key={metric.label} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-cyan-500 font-mono uppercase tracking-wider">{metric.label}</span>
                            <span className="ml-2 text-right font-medium text-slate-700 dark:text-cyan-200">{metric.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const SystemInfoSection = ({agent, latestMetrics}: SystemInfoSectionProps) => {
    // 环境信息
    const platformDisplay = latestMetrics?.host?.platform
        ? `${latestMetrics.host.platform} ${latestMetrics.host.platformVersion || ''}`.trim()
        : agent?.os || '-';
    const architectureDisplay = latestMetrics?.host?.kernelArch || agent?.arch || '-';

    const environmentInfo = [
        {label: '操作系统', value: platformDisplay || '-'},
        {label: '内核版本', value: latestMetrics?.host?.kernelVersion || '-'},
        {label: '硬件架构', value: architectureDisplay || '-'},
        {label: 'CPU 型号', value: latestMetrics?.cpu?.modelName || '-'},
        {label: '逻辑核心', value: latestMetrics?.cpu?.logicalCores ?? '-'},
        {label: '物理核心', value: latestMetrics?.cpu?.physicalCores ?? '-'},
    ];

    // 状态信息
    const uptimeDisplay = formatUptime(latestMetrics?.host?.uptime);
    const bootTimeDisplay = latestMetrics?.host?.bootTime
        ? formatDateTime(latestMetrics.host.bootTime * 1000)
        : '-';
    const lastSeenDisplay = agent ? formatDateTime(agent.lastSeenAt) : '-';

    const networkSummary = latestMetrics?.network
        ? `${formatBytes(latestMetrics.network.totalBytesSentTotal)} ↑ / ${formatBytes(
            latestMetrics.network.totalBytesRecvTotal,
        )} ↓`
        : '—';

    const statusInfo = [
        {label: '启动时间', value: bootTimeDisplay},
        {label: '运行时间', value: uptimeDisplay},
        {label: '最近心跳', value: lastSeenDisplay},
        {label: '进程数', value: latestMetrics?.host?.procs ?? '-'},
        {label: '网络累计', value: networkSummary},
        {label: 'Load', value: `${latestMetrics?.host?.load1?.toFixed(2)} / ${latestMetrics?.host?.load5?.toFixed(2)} / ${latestMetrics?.host?.load15?.toFixed(2)}`},
    ];

    // 快照卡片
    const snapshotCards: SnapshotCardData[] = [];

    if (latestMetrics) {
        snapshotCards.push({
            key: 'cpu',
            icon: Cpu,
            title: 'CPU 使用',
            usagePercent: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`,
            accent: 'blue',
            metrics: [
                {label: '当前使用', value: `${formatPercentValue(latestMetrics.cpu?.usagePercent)}%`},
            ],
        });

        snapshotCards.push({
            key: 'memory',
            icon: MemoryStick,
            title: '内存使用',
            usagePercent: `${formatPercentValue(latestMetrics.memory?.usagePercent)}%`,
            accent: 'emerald',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.memory?.used)} / ${formatBytes(latestMetrics.memory?.total)}`
                },
                {
                    label: 'Swap 已用',
                    value: `${formatBytes(latestMetrics.memory?.swapUsed)} / ${formatBytes(latestMetrics.memory?.swapTotal)}`
                },
            ],
        });

        snapshotCards.push({
            key: 'disk',
            icon: HardDrive,
            title: '磁盘使用',
            usagePercent: latestMetrics.disk
                ? `${formatPercentValue(latestMetrics.disk.usagePercent)}%`
                : '—',
            accent: 'purple',
            metrics: [
                {
                    label: '已用 / 总量',
                    value: `${formatBytes(latestMetrics.disk?.used, 1)} / ${formatBytes(latestMetrics.disk?.total, 1)}`
                },
                {label: '磁盘数量', value: latestMetrics.disk?.totalDisks ?? '-'},
            ],
        });

        // 网络流量卡片 - 整合流量统计信息
        const networkMetrics = [
            {
                label: '上行 / 下行',
                value: `${formatBytes(latestMetrics.network?.totalBytesSentRate, 1)}/s ↑ / ${formatBytes(
                    latestMetrics.network?.totalBytesRecvRate, 1,
                )}/s ↓`,
            },
            {
                label: '网络累计',
                value: `${formatBytes(latestMetrics.network?.totalBytesSentTotal, 1)} ↑ / ${formatBytes(
                    latestMetrics.network?.totalBytesRecvTotal, 1,
                )} ↓`,
            },
        ];

        // 如果配置了流量限额，添加流量统计信息到网络卡片
        if (agent?.trafficStats?.enabled && agent.trafficStats.limit > 0) {
            const trafficUsedPercent = (agent.trafficStats.used / agent.trafficStats.limit) * 100;

            networkMetrics.push({
                label: '流量限额',
                value: `${formatBytes(agent.trafficStats.used, 1)} / ${formatBytes(agent.trafficStats.limit, 1)} (${formatPercentValue(trafficUsedPercent)}%)`,
            });

            if (agent.trafficStats.resetDay > 0) {
                networkMetrics.push({
                    label: '重置日期',
                    value: `每月${agent.trafficStats.resetDay}号`,
                });
            }
        }

        snapshotCards.push({
            key: 'network',
            icon: Network,
            title: '网络流量',
            usagePercent: latestMetrics.network
                ? `${formatBytes(latestMetrics.network.totalBytesSentRate)}/s`
                : '—',
            accent: 'amber',
            metrics: networkMetrics,
        });
    }

    return (
        <div>
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className={'p-6'}>
                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-gray-700 dark:text-cyan-500">运行环境</h3>
                        <p className="mt-1 text-xs text-gray-600 dark:text-cyan-500">来自最近一次探针上报的硬件与系统信息</p>
                        <div className="mt-4">
                            <InfoGrid items={environmentInfo}/>
                        </div>
                    </Card>
                    <Card className={'p-6'}>
                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-gray-700 dark:text-cyan-500">运行状态</h3>
                        <p className="mt-1 text-xs text-gray-600 dark:text-cyan-500">关键时间与网络指标，帮助快速判断主机健康状况</p>
                        <div className="mt-4">
                            <InfoGrid items={statusInfo}/>
                        </div>
                    </Card>
                </div>
                {snapshotCards.length > 0 && (
                    <Card className="p-6 space-y-4">
                        <h3 className="text-sm font-bold font-mono uppercase tracking-widest text-gray-600 dark:text-cyan-500">
                            资源快照
                        </h3>
                        <SnapshotGrid cards={snapshotCards}/>
                    </Card>
                )}
            </div>
        </div>
    );
};

/* ========================================== ServerDetailSections ========================================== */

const NetworkAddressSection = ({ipv4, ipv6, deviceIpInterfaces}: {
    ipv4?: string;
    ipv6?: string;
    deviceIpInterfaces: Array<{name: string; addrs: string[]}>;
}) => {
    if (!ipv4 && !ipv6 && deviceIpInterfaces.length === 0) return null;

    return (
        <Card title="网络地址" description="已登录用户可见的公网 IP 及设备网卡地址信息">
            <div className="space-y-6">
                {(ipv4 || ipv6) && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">公网地址</div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {[["IPv4", ipv4], ["IPv6", ipv6]].map(([label, value]) => (
                                <div key={label} className="space-y-2">
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
                                    <div className="font-mono text-sm text-slate-900 dark:text-slate-100">{value || '-'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(ipv4 || ipv6) && deviceIpInterfaces.length > 0 && <div className="border-t border-slate-200 dark:border-slate-700"/>}

                {deviceIpInterfaces.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">网卡地址</div>
                        <div className="space-y-4">
                            {deviceIpInterfaces.map((networkInterface) => (
                                <div key={networkInterface.name} className="space-y-2">
                                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{networkInterface.name}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {networkInterface.addrs.map((address) => (
                                            <span key={address} className="rounded-sm border border-slate-200 bg-white/70 px-2 py-0.5 text-xs font-mono text-slate-600 dark:border-cyan-900/40 dark:bg-cyan-950/40 dark:text-cyan-200">
                                                {address}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

const NetworkConnectionSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    const metrics = latestMetrics?.networkConnection;
    if (!metrics) return null;
    const items = [
        {label: 'Total', value: metrics.total, color: 'text-slate-800 dark:text-cyan-100'},
        {label: 'ESTABLISHED', value: metrics.established, color: 'text-emerald-600 dark:text-emerald-400'},
        {label: 'TIME_WAIT', value: metrics.timeWait, color: 'text-amber-600 dark:text-amber-400'},
        {label: 'LISTEN', value: metrics.listen, color: 'text-blue-600 dark:text-blue-400'},
        {label: 'CLOSE_WAIT', value: metrics.closeWait, color: 'text-rose-600 dark:text-rose-400'},
        {
            label: 'OTHER',
            value: metrics.synSent + metrics.synRecv + metrics.finWait1 + metrics.finWait2 + metrics.close + metrics.lastAck + metrics.closing,
            color: 'text-gray-700 dark:text-cyan-500',
        },
    ];

    return (
        <Card title="网络连接统计" description="TCP 连接各状态的实时统计数据">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {items.map((item) => (
                    <div key={item.label} className="text-center">
                        <div className="text-xs font-mono uppercase tracking-wider text-gray-600 dark:text-cyan-500">{item.label}</div>
                        <div className={`mt-1 text-lg font-semibold ${item.color}`}>{item.value}</div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const GpuMonitorSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    if (!latestMetrics?.gpu?.length) return null;

    return (
        <Card title="GPU 监控" description="显卡使用情况和温度监控">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {latestMetrics.gpu.map((gpu) => (
                    <div key={gpu.index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 backdrop-blur-sm transition hover:border-slate-300 dark:border-cyan-900/50 dark:bg-black/30 dark:hover:border-cyan-700/50">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 text-gray-600 dark:bg-cyan-500/10 dark:text-cyan-500"><Zap className="h-4 w-4"/></span>
                                <div>
                                    <p className="text-sm font-bold font-mono text-gray-700 dark:text-cyan-100">GPU {gpu.index}</p>
                                    <p className="text-xs text-gray-600 dark:text-cyan-500">{gpu.name}</p>
                                </div>
                            </div>
                            <span className="text-2xl font-bold text-orange-600 dark:text-purple-400">{gpu.utilization?.toFixed(1) ?? 0}%</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            {[
                                ['温度', `${gpu.temperature?.toFixed(1)}°C`],
                                ['显存', `${formatBytes(gpu.memoryUsed)} / ${formatBytes(gpu.memoryTotal)}`],
                                ['功耗', `${gpu.powerUsage?.toFixed(1)}W`],
                                ['风扇转速', `${gpu.fanSpeed?.toFixed(0)}%`],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs font-mono uppercase tracking-wider text-gray-600 dark:text-cyan-500">{label}</span>
                                    <span className="font-medium text-gray-900 dark:text-cyan-200">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const TemperatureMonitorSection = ({latestMetrics}: {latestMetrics: LatestMetrics | null}) => {
    if (!latestMetrics?.temperature?.length) return null;

    return (
        <Card title="温度监控" description="系统各部件温度传感器数据">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[...latestMetrics.temperature].sort((a, b) => a.sensorKey.localeCompare(b.sensorKey)).map((temperature) => (
                    <div key={temperature.sensorKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4 backdrop-blur-sm transition hover:border-slate-300 dark:border-cyan-900/50 dark:bg-black/30 dark:hover:border-cyan-700/50">
                        <div className="mb-2 flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-gray-600 dark:text-cyan-500"/>
                            <p className="truncate text-xs font-bold font-mono uppercase tracking-wider text-gray-700 dark:text-cyan-500">{temperature.type}</p>
                        </div>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{temperature.temperature.toFixed(1)}°C</p>
                    </div>
                ))}
            </div>
        </Card>
    );
};

/* ========================================== CpuChart ========================================== */

interface ChartPropsBase {
    agentId: string;
    timeRange: string;
    start?: number;
    end?: number;
    isLive?: boolean;
    latestMetrics?: LatestMetrics | null;
}

interface CpuChartProps extends ChartPropsBase {
}

interface CpuPoint {
    timestamp: number;
    usage: number;
}

const CpuChart = ({agentId, timeRange, start, end, isLive, latestMetrics}: CpuChartProps) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;
    // 数据查询
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'cpu',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
    });

    // 历史数据
    const initialData = useMemo<CpuPoint[]>(() => {
        const cpuSeries = metricsResponse?.series?.find(s => s.name === 'usage');
        if (!cpuSeries) return [];
        return cpuSeries.data.map((point) => ({
            usage: Number(point.value.toFixed(2)),
            timestamp: point.timestamp,
        }));
    }, [metricsResponse]);

    // 实时点
    const livePoint = useMemo<CpuPoint | null>(() => {
        if (!isLive || !latestMetrics?.cpu || !latestMetrics.timestamp) return null;
        const usage = latestMetrics.cpu.usagePercent;
        if (typeof usage !== 'number' || !Number.isFinite(usage)) return null;
        return {timestamp: latestMetrics.timestamp, usage: Number(usage.toFixed(2))};
    }, [isLive, latestMetrics]);

    const chartData = useLiveBuffer(initialData, !!isLive, livePoint, LIVE_WINDOW_MS, agentId);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="CPU 使用率" icon={Cpu}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="CPU 使用率" icon={Cpu}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="cpuAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            angle={-15}
                            textAnchor="end"
                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                        />
                        <YAxis
                            domain={[0, 100]}
                            stroke="currentColor"
                            className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip unit="%" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Area
                            type="monotone"
                            dataKey="usage"
                            name="CPU 使用率"
                            stroke="#2563eb"
                            strokeWidth={2}
                            fill="url(#cpuAreaGradient)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder/>
            )}
        </ChartContainer>
    );
};

/* ========================================== MemoryChart ========================================== */

interface MemoryPoint {
    timestamp: number;
    usage: number;
}

const MemoryChart = ({agentId, timeRange, start, end, isLive, latestMetrics}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;
    // 数据查询
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'memory',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
    });

    // 历史数据
    const initialData = useMemo<MemoryPoint[]>(() => {
        const memorySeries = metricsResponse?.series?.find(s => s.name === 'usage');
        if (!memorySeries) return [];
        return memorySeries.data.map((point) => ({
            usage: Number(point.value.toFixed(2)),
            timestamp: point.timestamp,
        }));
    }, [metricsResponse]);

    // 实时点
    const livePoint = useMemo<MemoryPoint | null>(() => {
        if (!isLive || !latestMetrics?.memory || !latestMetrics.timestamp) return null;
        const usage = latestMetrics.memory.usagePercent;
        if (typeof usage !== 'number' || !Number.isFinite(usage)) return null;
        return {timestamp: latestMetrics.timestamp, usage: Number(usage.toFixed(2))};
    }, [isLive, latestMetrics]);

    const chartData = useLiveBuffer(initialData, !!isLive, livePoint, LIVE_WINDOW_MS, agentId);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="内存使用率" icon={MemoryStick}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="内存使用率" icon={MemoryStick}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="memoryAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            angle={-15}
                            textAnchor="end"
                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                        />
                        <YAxis
                            domain={[0, 100]}
                            stroke="currentColor"
                            className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<CustomTooltip unit="%" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Area
                            type="monotone"
                            dataKey="usage"
                            name="内存使用率"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="url(#memoryAreaGradient)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder/>
            )}
        </ChartContainer>
    );
};

/* ========================================== DiskIOChart ========================================== */

interface DiskIOPoint {
    timestamp: number;
    read: number;
    write: number;
}

const DiskIOChart = ({agentId, timeRange, start, end, isLive, latestMetrics}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;
    // 数据查询
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'disk_io',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
    });

    // 历史数据
    const initialData = useMemo<DiskIOPoint[]>(() => {
        if (!metricsResponse?.series || metricsResponse.series.length === 0) return [];

        const readSeries = metricsResponse.series.find(s => s.name === 'read');
        const writeSeries = metricsResponse.series.find(s => s.name === 'write');

        if (!readSeries || !writeSeries) return [];

        const timeMap = new Map<number, DiskIOPoint>();

        readSeries.data.forEach(point => {
            timeMap.set(point.timestamp, {
                timestamp: point.timestamp,
                read: toMB(point.value),
                write: 0,
            });
        });

        writeSeries.data.forEach(point => {
            const existing = timeMap.get(point.timestamp);
            if (existing) {
                existing.write = toMB(point.value);
            } else {
                timeMap.set(point.timestamp, {
                    timestamp: point.timestamp,
                    read: 0,
                    write: toMB(point.value),
                });
            }
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [metricsResponse]);

    // 实时点：用 latestMetrics.timestamp 作为同批次时间锚
    const livePoint = useMemo<DiskIOPoint | null>(() => {
        if (!isLive || !latestMetrics?.diskIO || !latestMetrics.timestamp) return null;
        return {
            timestamp: latestMetrics.timestamp,
            read: toMB(latestMetrics.diskIO.totalReadBytesRate),
            write: toMB(latestMetrics.diskIO.totalWriteBytesRate),
        };
    }, [isLive, latestMetrics]);

    const chartData = useLiveBuffer(initialData, !!isLive, livePoint, LIVE_WINDOW_MS, agentId);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="磁盘 I/O (MB/s)" icon={HardDrive}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="磁盘 I/O (MB/s)" icon={HardDrive}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorDiskRead" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2C70F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2C70F6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorDiskWrite" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6FD598" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6FD598" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            angle={-15}
                            textAnchor="end"
                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                            height={45}
                        />
                        <YAxis
                            stroke="currentColor"
                            className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                            tickFormatter={(value) => `${value} MB`}
                        />
                        <Tooltip content={<CustomTooltip unit=" MB" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Area
                            type="monotone"
                            dataKey="read"
                            name="读取"
                            stroke="#2C70F6"
                            strokeWidth={2}
                            fill="url(#colorDiskRead)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                        <Area
                            type="monotone"
                            dataKey="write"
                            name="写入"
                            stroke="#6FD598"
                            strokeWidth={2}
                            fill="url(#colorDiskWrite)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="暂无磁盘 I/O 采集数据"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== NetworkChart ========================================== */

interface NetworkPoint {
    timestamp: number;
    upload: number;
    download: number;
}

const NetworkChart = ({agentId, timeRange, start, end, isLive, latestMetrics}: ChartPropsBase) => {
    const [selectedInterface, setSelectedInterface] = useState<string>('all');
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;

    // 查询网卡列表
    const {data: interfacesData} = useNetworkInterfacesQuery(agentId);
    const availableInterfaces = interfacesData?.interfaces || [];

    // 当网卡列表变化时，验证选中的网卡
    useEffect(() => {
        if (selectedInterface !== 'all' && availableInterfaces.length > 0) {
            if (!availableInterfaces.includes(selectedInterface)) {
                setSelectedInterface('all');
            }
        }
    }, [availableInterfaces, selectedInterface]);

    // 查询网络数据
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'network',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
        interfaceName: selectedInterface !== 'all' ? selectedInterface : undefined,
    });

    // 历史数据
    const initialData = useMemo<NetworkPoint[]>(() => {
        if (!metricsResponse?.series || metricsResponse.series.length === 0) return [];

        const uploadSeries = metricsResponse.series.find(s => s.name === 'upload');
        const downloadSeries = metricsResponse.series.find(s => s.name === 'download');

        if (!uploadSeries || !downloadSeries) return [];

        const timeMap = new Map<number, NetworkPoint>();

        uploadSeries.data.forEach(point => {
            timeMap.set(point.timestamp, {
                timestamp: point.timestamp,
                upload: toMB(point.value),
                download: 0,
            });
        });

        downloadSeries.data.forEach(point => {
            const existing = timeMap.get(point.timestamp);
            if (existing) {
                existing.download = toMB(point.value);
            } else {
                timeMap.set(point.timestamp, {
                    timestamp: point.timestamp,
                    upload: 0,
                    download: toMB(point.value),
                });
            }
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [metricsResponse]);

    // 实时点：用 latestMetrics.timestamp 作为采集批次时间锚点
    const livePoint = useMemo<NetworkPoint | null>(() => {
        if (!isLive || !latestMetrics?.timestamp) return null;

        let sentRate = 0;
        let recvRate = 0;
        if (selectedInterface === 'all') {
            const summary = latestMetrics.network;
            if (!summary) return null;
            sentRate = summary.totalBytesSentRate;
            recvRate = summary.totalBytesRecvRate;
        } else {
            const iface = latestMetrics.networkInterfaces?.find(i => i.interface === selectedInterface);
            if (!iface) return null;
            sentRate = iface.bytesSentRate;
            recvRate = iface.bytesRecvRate;
        }
        return {
            timestamp: latestMetrics.timestamp,
            upload: toMB(sentRate),
            download: toMB(recvRate),
        };
    }, [isLive, latestMetrics, selectedInterface]);

    const chartData = useLiveBuffer(initialData, !!isLive, livePoint, LIVE_WINDOW_MS, `${agentId}|${selectedInterface}`);

    // 网卡选择器
    const interfaceSelector = availableInterfaces.length > 0 && (
        <select
            value={selectedInterface}
            onChange={(e) => setSelectedInterface(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-cyan-900/50 bg-white dark:bg-black/40 px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-cyan-300 hover:border-slate-300 dark:hover:border-cyan-700 focus:border-slate-400 dark:focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-cyan-500/20"
        >
            {availableInterfaces.map((iface) => (
                <option key={iface} value={iface}>
                    {iface}
                </option>
            ))}
        </select>
    );

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="网络流量（MB/s）" icon={Network} action={interfaceSelector}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="网络流量（MB/s）" icon={Network} action={interfaceSelector}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="color-upload" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={INTERFACE_COLORS[0].upload} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={INTERFACE_COLORS[0].upload} stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="color-download" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={INTERFACE_COLORS[0].download} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={INTERFACE_COLORS[0].download} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            angle={-15}
                            textAnchor="end"
                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                            height={45}
                        />
                        <YAxis
                            stroke="currentColor"
                            className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                            tickFormatter={(value) => `${value} MB`}
                        />
                        <Tooltip content={<CustomTooltip unit=" MB/s" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Area
                            type="monotone"
                            dataKey="upload"
                            name="上行"
                            stroke={INTERFACE_COLORS[0].upload}
                            strokeWidth={2}
                            fill="url(#color-upload)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                        <Area
                            type="monotone"
                            dataKey="download"
                            name="下行"
                            stroke={INTERFACE_COLORS[0].download}
                            strokeWidth={2}
                            fill="url(#color-download)"
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="稍后再次尝试刷新网络流量"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== NetworkConnectionChart ========================================== */

interface ConnPoint {
    timestamp: number;
    established: number;
    time_wait: number;
    close_wait: number;
    listen: number;
}

const NetworkConnectionChart = ({agentId, timeRange, start, end, isLive, latestMetrics}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'network_connection',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
    });

    // 历史数据
    const initialData = useMemo<ConnPoint[]>(() => {
        if (!metricsResponse?.series || metricsResponse.series.length === 0) return [];

        const timeMap = new Map<number, ConnPoint>();

        metricsResponse.series.forEach(series => {
            const stateName = series.name;
            series.data.forEach(point => {
                if (!timeMap.has(point.timestamp)) {
                    timeMap.set(point.timestamp, {
                        timestamp: point.timestamp,
                        established: 0,
                        time_wait: 0,
                        close_wait: 0,
                        listen: 0,
                    });
                }
                const existing = timeMap.get(point.timestamp)!;
                if (stateName === 'established' || stateName === 'time_wait' || stateName === 'close_wait' || stateName === 'listen') {
                    existing[stateName] = Number(point.value.toFixed(0));
                }
            });
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [metricsResponse]);

    // 实时点
    const livePoint = useMemo<ConnPoint | null>(() => {
        if (!isLive || !latestMetrics?.networkConnection || !latestMetrics.timestamp) return null;
        const c = latestMetrics.networkConnection;
        return {
            timestamp: latestMetrics.timestamp,
            established: c.established ?? 0,
            time_wait: c.timeWait ?? 0,
            close_wait: c.closeWait ?? 0,
            listen: c.listen ?? 0,
        };
    }, [isLive, latestMetrics]);

    const chartData = useLiveBuffer(initialData, !!isLive, livePoint, LIVE_WINDOW_MS, agentId);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="网络连接统计" icon={Network}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="网络连接统计" icon={Network}>
            {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                        <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                            stroke="currentColor"
                            angle={-15}
                            textAnchor="end"
                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                            height={45}
                        />
                        <YAxis
                            stroke="currentColor"
                            className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                        />
                        <Tooltip content={<CustomTooltip unit="" timeFormat={isLive ? 'HH:mm:ss' : undefined}/>}/>
                        <Legend/>
                        <Line
                            type="monotone"
                            dataKey="established"
                            name="ESTABLISHED"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type="monotone"
                            dataKey="time_wait"
                            name="TIME_WAIT"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type="monotone"
                            dataKey="close_wait"
                            name="CLOSE_WAIT"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                        <Line
                            type="monotone"
                            dataKey="listen"
                            name="LISTEN"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{r: 3}}
                            connectNulls
                            isAnimationActive={!isLive}
                        />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <ChartPlaceholder subtitle="暂无网络连接统计数据"/>
            )}
        </ChartContainer>
    );
};

/* ========================================== GpuChart ========================================== */

const GpuChartImpl = ({agentId, timeRange, start, end, isLive}: ChartPropsBase) => {
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;
    // 数据查询
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'gpu',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
        refetchIntervalMs: isLive ? 5000 : undefined,
    });

    // 数据转换
    const chartData = useMemo(() => {
        if (!metricsResponse?.series || metricsResponse.series.length === 0) return [];

        const timeMap = new Map<number, { timestamp: number; utilization?: number; temperature?: number }>();

        const utilizationSeries = metricsResponse.series.find(s => s.name === 'utilization');
        const temperatureSeries = metricsResponse.series.find(s => s.name === 'temperature');

        utilizationSeries?.data.forEach(point => {
            const existing = timeMap.get(point.timestamp);
            if (existing) {
                existing.utilization = Number(point.value.toFixed(2));
            } else {
                timeMap.set(point.timestamp, {
                    timestamp: point.timestamp,
                    utilization: Number(point.value.toFixed(2)),
                });
            }
        });

        temperatureSeries?.data.forEach(point => {
            const existing = timeMap.get(point.timestamp);
            if (existing) {
                existing.temperature = Number(point.value.toFixed(2));
            } else {
                timeMap.set(point.timestamp, {
                    timestamp: point.timestamp,
                    temperature: Number(point.value.toFixed(2)),
                });
            }
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [metricsResponse]);

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="GPU 使用率与温度" icon={Zap}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    // 如果没有 GPU 数据，不渲染组件
    if (chartData.length === 0) {
        return null;
    }

    return (
        <ChartContainer title="GPU 使用率与温度" icon={Zap}>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                    <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                        stroke="currentColor"
                        className="stroke-gray-400 dark:stroke-cyan-600"
                        style={{fontSize: '12px'}}
                    />
                    <YAxis
                        yAxisId="left"
                        stroke="currentColor"
                        className="stroke-gray-400 dark:stroke-cyan-600"
                        style={{fontSize: '12px'}}
                        tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="currentColor"
                        className="stroke-gray-400 dark:stroke-cyan-600"
                        style={{fontSize: '12px'}}
                        tickFormatter={(value) => `${value}°C`}
                    />
                    <Tooltip content={<CustomTooltip unit=""/>}/>
                    <Legend/>
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="utilization"
                        name="使用率 (%)"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{r: 3}}
                        connectNulls
                        isAnimationActive={!isLive}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="temperature"
                        name="温度 (°C)"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{r: 3}}
                        connectNulls
                        isAnimationActive={!isLive}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

const GpuChart = memo(GpuChartImpl);

/* ========================================== TemperatureChart ========================================== */

const TemperatureChartImpl = ({agentId, timeRange, start, end, isLive}: ChartPropsBase) => {
    const [selectedTempType, setSelectedTempType] = useState<string>('all');
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const effectiveRange = isLive ? LIVE_INITIAL_RANGE : timeRange;

    // 数据查询：温度采集 5s 一次，实时模式 5s 重查
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'temperature',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
        refetchIntervalMs: isLive ? 5000 : undefined,
    });

    // 数据转换
    const chartData = useMemo(() => {
        if (!metricsResponse?.series || metricsResponse.series.length === 0) return [];

        const timeMap = new Map<number, any>();

        metricsResponse.series.forEach(series => {
            const sensorName = series.name;
            series.data.forEach(point => {
                if (!timeMap.has(point.timestamp)) {
                    timeMap.set(point.timestamp, {timestamp: point.timestamp});
                }

                const existing = timeMap.get(point.timestamp)!;
                existing[sensorName] = Number(point.value.toFixed(2));
            });
        });

        return Array.from(timeMap.values());
    }, [metricsResponse]);

    // 提取所有唯一的温度类型
    const temperatureTypes = useMemo(() => {
        return metricsResponse?.series?.map(s => s.name).sort() || [];
    }, [metricsResponse]);

    // 根据选中的类型过滤温度数据
    const filteredTemperatureTypes = useMemo(() => {
        if (selectedTempType === 'all') {
            return temperatureTypes;
        }
        return temperatureTypes.filter(type => type === selectedTempType);
    }, [temperatureTypes, selectedTempType]);

    // 当温度类型列表变化时，如果当前选中的类型不在列表中，重置为 'all'
    useEffect(() => {
        if (selectedTempType !== 'all' && temperatureTypes.length > 0) {
            if (!temperatureTypes.includes(selectedTempType)) {
                setSelectedTempType('all');
            }
        }
    }, [temperatureTypes, selectedTempType]);

    // 温度类型选择器
    const tempTypeSelector = temperatureTypes.length > 1 && (
        <select
            value={selectedTempType}
            onChange={(e) => setSelectedTempType(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-cyan-900/50 bg-white dark:bg-black/40 px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-cyan-300 hover:border-slate-300 dark:hover:border-cyan-700 focus:border-slate-400 dark:focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-cyan-500/20"
        >
            <option value="all">所有类型</option>
            {temperatureTypes.map((type) => (
                <option key={type} value={type}>
                    {type}
                </option>
            ))}
        </select>
    );

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="系统温度" icon={Thermometer} action={tempTypeSelector}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    // 如果没有温度数据，不渲染组件
    if (chartData.length === 0 || temperatureTypes.length === 0) {
        return null;
    }

    return (
        <ChartContainer title="系统温度" icon={Thermometer} action={tempTypeSelector}>
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                    <CartesianGrid stroke="currentColor" strokeDasharray="4 4" className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                        stroke="currentColor"
                        angle={-15}
                        textAnchor="end"
                        className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                        height={45}
                    />
                    <YAxis
                        stroke="currentColor"
                        className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                        tickFormatter={(value) => `${value}°C`}
                    />
                    <Tooltip content={<CustomTooltip unit="°C"/>}/>
                    <Legend/>
                    {/* 为选中的温度类型渲染线条 */}
                    {filteredTemperatureTypes.map((type, index) => {
                        const color = TEMPERATURE_COLORS[type] || `hsl(${(index * 60) % 360}, 70%, 50%)`;
                        return (
                            <Line
                                key={type}
                                type="monotone"
                                dataKey={type}
                                name={type}
                                stroke={color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{r: 3}}
                                connectNulls
                                isAnimationActive={!isLive}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
        </ChartContainer>
    );
};

const TemperatureChart = memo(TemperatureChartImpl);

/* ========================================== MonitorChart ========================================== */

/**
 * 降采样算法 - 使用LTTB (Largest Triangle Three Buckets)
 * 确保输出精确的maxPoints个点，保留关键特征
 */
const downsampleData = (data: any[], maxPoints: number): any[] => {
    // 边界检查
    if (!data || data.length === 0) return [];
    if (maxPoints < 2) maxPoints = 2;
    if (data.length <= maxPoints) return [...data];
    
    const result: any[] = [data[0]]; // 保留第一个点
    
    // 桶大小
    const bucketSize = (data.length - 2) / (maxPoints - 2);
    
    for (let i = 0; i < maxPoints - 2; i++) {
        // 计算当前桶的范围
        const start = Math.floor((i + 0) * bucketSize) + 1;
        const end = Math.floor((i + 1) * bucketSize) + 1;
        
        // 计算前一个点和后一个点
        const previousPoint = result[result.length - 1];
        const nextPoint = data[Math.min(end, data.length - 1)];
        
        // 在桶中选择与前后点形成的三角形面积最大的点
        let maxArea = -1;
        let selectedPoint = data[start];
        
        for (let j = start; j < end && j < data.length - 1; j++) {
            // 计算三角形面积
            const area = Math.abs(
                (previousPoint.timestamp - nextPoint.timestamp) * (data[j].value - previousPoint.value) -
                (previousPoint.timestamp - data[j].timestamp) * (nextPoint.value - previousPoint.value)
            );
            
            if (area > maxArea) {
                maxArea = area;
                selectedPoint = data[j];
            }
        }
        
        result.push(selectedPoint);
    }
    
    result.push(data[data.length - 1]); // 保留最后一个点
    
    return result;
};

/**
 * 根据时间范围确定最大数据点数
 */
const getMaxDataPoints = (timeRange: string): number => {
    switch (timeRange) {
        case '15m':
        case '1h':
            return 200; // 短时间：详细数据
        case '12h':
            return 300;
        case '24h':
            return 400;
        case '7d':
            return 500;
        case '30d':
            return 600;
        default:
            return 400;
    }
};

/**
 * 生成不重复的颜色
 * 使用 HSL 色轮均匀分布，支持无限数量的监控项
 */
const generateColors = (count: number): string[] => {
    const colors: string[] = [];
    const hueStep = 360 / count; // 色相间隔
    
    for (let i = 0; i < count; i++) {
        const hue = (i * hueStep) % 360;
        const saturation = 65 + (i % 3) * 10; // 65%, 75%, 85% 循环
        const lightness = 45 + (i % 2) * 10;  // 45%, 55% 循环
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return colors;
};

/**
 * 自定义图例组件
 */
const CustomLegend = ({ onClick, selectedMonitors, allMonitorKeys, colors, collapsed }: any) => {
    if (!allMonitorKeys || allMonitorKeys.length === 0) return null;
    
    if (collapsed) return null;
    
    return (
        <div className="flex flex-wrap justify-center gap-4 pt-4">
            {allMonitorKeys.map((monitorKey: string, index: number) => {
                const isSelected = selectedMonitors.has(monitorKey);
                const color = colors[index];
                
                return (
                    <div
                        key={monitorKey}
                        onClick={() => onClick({ value: monitorKey })}
                        className="flex items-center gap-2 cursor-pointer transition-opacity"
                        style={{
                            opacity: isSelected ? 1 : 0.4,
                        }}
                    >
                        <svg width="32" height="12" className="overflow-visible">
                            <line
                                x1="0"
                                y1="6"
                                x2="32"
                                y2="6"
                                stroke={isSelected ? color : '#9ca3af'}
                                strokeWidth="2"
                            />
                        </svg>
                        <span
                            className="text-xs font-medium"
                            style={{
                                color: isSelected ? color : '#9ca3af',
                            }}
                        >
                            {monitorKey}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const MonitorChartImpl = ({agentId, timeRange, start, end, isLive}: ChartPropsBase) => {
    const isMobile = useIsMobile();
    const rangeMs = start !== undefined && end !== undefined ? end - start : undefined;
    const [selectedMonitors, setSelectedMonitors] = useState<Set<string>>(new Set());
    const [legendCollapsed, setLegendCollapsed] = useState(true); // 移动端默认收起
    // 监控任务由探针自定义周期上报，实时模式下保留 15m 视图，10s 重查
    const effectiveRange = isLive ? '15m' : timeRange;

    // 数据查询
    const {data: metricsResponse, isLoading} = useMetricsQuery({
        agentId,
        type: 'monitor',
        range: start !== undefined && end !== undefined ? undefined : effectiveRange,
        start,
        end,
        refetchIntervalMs: isLive ? 10000 : undefined,
    });

    // 获取所有监控任务的列表（使用名称）
    const allMonitorKeys = useMemo(() => {
        const series = metricsResponse?.series || [];
        return series.map(s => s.labels?.monitor_name || s.labels?.monitor_id || s.name);
    }, [metricsResponse]);

    // 初始化选中所有监控任务
    useEffect(() => {
        if (allMonitorKeys.length > 0 && selectedMonitors.size === 0) {
            setSelectedMonitors(new Set(allMonitorKeys));
        }
    }, [allMonitorKeys, selectedMonitors.size]);

    // 过滤后的监控任务列表
    const monitorKeys = useMemo(() => {
        return allMonitorKeys.filter(key => selectedMonitors.has(key));
    }, [allMonitorKeys, selectedMonitors]);

    // 数据转换 - 支持多个监控任务（统一时间轴 + 线性插值）
    const chartData = useMemo(() => {
        const series = metricsResponse?.series || [];
        if (series.length === 0) return [];

        // 收集所有监控任务的数据
        const seriesDataArray: Array<{ key: string; data: Array<{ timestamp: number; value: number }> }> = [];

        series.forEach((s) => {
            const monitorKey = s.labels?.monitor_name || s.labels?.monitor_id || s.name;
            if (!selectedMonitors.has(monitorKey)) return;
            if (!s.data || s.data.length === 0) return;

            seriesDataArray.push({
                key: monitorKey,
                data: [...s.data].sort((a, b) => a.timestamp - b.timestamp)
            });
        });

        if (seriesDataArray.length === 0) return [];

        // 取所有监控任务时间范围的交集，确保每个时间点所有任务都有数据
        let minTime = -Infinity, maxTime = Infinity;
        seriesDataArray.forEach(s => {
            if (s.data.length > 0) {
                minTime = Math.max(minTime, s.data[0].timestamp);
                maxTime = Math.min(maxTime, s.data[s.data.length - 1].timestamp);
            }
        });

        // 如果没有交集，返回空数组
        if (minTime >= maxTime) return [];

        // 均匀生成目标时间点
        const maxPoints = getMaxDataPoints(timeRange);
        const timeStep = (maxTime - minTime) / (maxPoints - 1);
        const targetTimestamps: number[] = [];
        for (let i = 0; i < maxPoints; i++) {
            targetTimestamps.push(minTime + i * timeStep);
        }

        // 线性插值函数
        const interpolate = (data: Array<{ timestamp: number; value: number }>, targetTime: number): number | null => {
            if (data.length === 0) return null;
            if (data.length === 1) {
                // 单点数据，只有精确匹配才返回
                return data[0].timestamp === targetTime ? data[0].value : null;
            }
            
            // 如果目标时间在数据范围外，返回 null（断开折线）
            if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) {
                return null;
            }
            
            // 二分查找找到 targetTime 前后两个点
            let left = 0, right = data.length - 1;
            while (right - left > 1) {
                const mid = Math.floor((left + right) / 2);
                if (data[mid].timestamp <= targetTime) {
                    left = mid;
                } else {
                    right = mid;
                }
            }
            
            // 线性插值
            const leftPoint = data[left];
            const rightPoint = data[right];
            const ratio = (targetTime - leftPoint.timestamp) / (rightPoint.timestamp - leftPoint.timestamp);
            return leftPoint.value + ratio * (rightPoint.value - leftPoint.value);
        };

        // 对每个时间点，从每个监控任务中插值获取值
        return targetTimestamps.map(timestamp => {
            const dataPoint: any = { timestamp };
            seriesDataArray.forEach(s => {
                const value = interpolate(s.data, timestamp);
                if (value !== null) {
                    dataPoint[s.key] = Number(value.toFixed(2));
                }
            });
            return dataPoint;
        });
    }, [metricsResponse, selectedMonitors, timeRange, start, end]);

    // 动态生成颜色（根据监控项数量）
    const colors = useMemo(() => {
        return generateColors(allMonitorKeys.length);
    }, [allMonitorKeys.length]);

    const toggleMonitor = (monitorKey: string) => {
        setSelectedMonitors((current) => {
            if (current.size === allMonitorKeys.length) return new Set([monitorKey]);
            const next = new Set(current);
            if (next.has(monitorKey)) next.delete(monitorKey);
            else next.add(monitorKey);
            return next;
        });
    };

    const handleAreaClick = (data: unknown) => {
        const key = (data as {dataKey?: string})?.dataKey;
        if (key) toggleMonitor(key);
    };

    const handleLegendClick = (data: {value?: string}) => {
        if (data?.value) toggleMonitor(data.value);
    };

    // 恢复全选
    const handleSelectAll = () => {
        setSelectedMonitors(new Set(allMonitorKeys));
    };

    // 是否有监控项未选中（用于显示恢复按钮）
    const hasUnselected = selectedMonitors.size < allMonitorKeys.length;

    // 切换图例显示/隐藏（仅移动端）
    const toggleLegend = () => setLegendCollapsed((collapsed) => !collapsed);

    // 如果没有数据且不是加载中，不渲染组件
    if (!isLoading && chartData.length === 0) {
        return null;
    }

    // 渲染
    if (isLoading) {
        return (
            <ChartContainer title="监控响应时间" icon={Activity}>
                <ChartPlaceholder/>
            </ChartContainer>
        );
    }

    return (
        <ChartContainer title="监控响应时间" icon={Activity}>
            {chartData.length > 0 ? (
                <>
                    {/* 使用提示和恢复按钮 */}
                    {allMonitorKeys.length > 1 && (
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-xs text-gray-500 dark:text-cyan-600">
                                💡 点击图表线条或图例切换显示
                            </div>
                            {hasUnselected && (
                                <button
                                    onClick={handleSelectAll}
                                    className="p-1.5 rounded
                                        text-gray-500 dark:text-cyan-500 
                                        hover:text-gray-700 dark:hover:text-cyan-400
                                        hover:bg-gray-100 dark:hover:bg-cyan-900/30
                                        transition-colors"
                                    title="恢复全选"
                                >
                                    <RotateCcw size={16} />
                                </button>
                            )}
                        </div>
                    )}
                    
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={chartData}>
                            <defs>
                                {monitorKeys.map((key, index) => {
                                    const originalIndex = allMonitorKeys.indexOf(key);
                                    return (
                                        <linearGradient key={key} id={`monitorAreaGradient-${index}`} x1="0" y1="0" x2="0"
                                                        y2="1">
                                            <stop offset="5%" stopColor={colors[originalIndex]} stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor={colors[originalIndex]} stopOpacity={0}/>
                                        </linearGradient>
                                    );
                                })}
                            </defs>
                            <CartesianGrid stroke="currentColor" strokeDasharray="4 4"
                                           className="stroke-slate-200 dark:stroke-cyan-900/30"/>
                            <XAxis
                                dataKey="timestamp"
                                type="number"
                                scale="time"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                                stroke="currentColor"
                                angle={-15}
                                textAnchor="end"
                                className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                                height={45}
                            />
                            <YAxis
                                stroke="currentColor"
                                className="stroke-gray-400 dark:stroke-cyan-600 text-xs"
                                tickFormatter={(value) => `${value}ms`}
                            />
                            <Tooltip
                                content={<CustomTooltip unit="ms"/>}
                                wrapperStyle={{zIndex: 9999,}}
                            />
                            {monitorKeys.map((key, index) => {
                                const originalIndex = allMonitorKeys.indexOf(key);
                                return (
                                    <Area
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={key}
                                        stroke={colors[originalIndex]}
                                        strokeWidth={2}
                                        fill={`url(#monitorAreaGradient-${index})`}
                                        activeDot={{r: 3}}
                                        connectNulls
                                        onClick={handleAreaClick}
                                        style={{cursor: 'pointer'}}
                                        isAnimationActive={!isLive}
                                    />
                                );
                            })}
                        </AreaChart>
                    </ResponsiveContainer>
                    
                    {/* 桌面端：直接显示图例 */}
                    {!isMobile && allMonitorKeys.length > 0 && (
                        <CustomLegend
                            onClick={handleLegendClick}
                            selectedMonitors={selectedMonitors}
                            allMonitorKeys={allMonitorKeys}
                            colors={colors}
                        />
                    )}
                    
                    {/* 移动端：可折叠图例 */}
                    {isMobile && allMonitorKeys.length > 0 && (
                        <div className="pt-4">
                            <button
                                onClick={toggleLegend}
                                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-600 dark:text-cyan-400 hover:text-gray-900 dark:hover:text-cyan-300"
                            >
                                <span>{legendCollapsed ? '显示图例' : '收起图例'}</span>
                                {legendCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>
                            <CustomLegend
                                onClick={handleLegendClick}
                                selectedMonitors={selectedMonitors}
                                allMonitorKeys={allMonitorKeys}
                                colors={colors}
                                collapsed={legendCollapsed}
                            />
                        </div>
                    )}
                </>
            ) : (
                <ChartPlaceholder/>
            )}
        </ChartContainer>
    );
};

const MonitorChart = memo(MonitorChartImpl);

/* ========================================== ServerDetail ========================================== */

/**
 * 服务器详情页面
 * 显示服务器的详细信息、实时指标和历史趋势图表
 */
const ServerDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<string>(LIVE_RANGE);
    const [customRange, setCustomRange] = useState<{ start: number; end: number } | null>(null);

    const handleCustomRangeApply = (range: { start: number; end: number }) => {
        setCustomRange(range);
    };

    const isLive = timeRange === LIVE_RANGE;
    const customStart = timeRange === 'custom' ? customRange?.start : undefined;
    const customEnd = timeRange === 'custom' ? customRange?.end : undefined;

    // 查询基础数据（用于页面头部和系统信息）
    // 实时模式 1s 拉取最新指标，其余 5s
    const {data: agentResponse, isLoading} = useAgentQuery(id);
    const {data: latestMetricsResponse} = useLatestMetricsQuery(id, isLive ? 1000 : 5000);

    const agent = agentResponse;
    const latestMetrics = latestMetricsResponse || null;

    const deviceIpInterfaces = (latestMetrics?.networkInterfaces || [])
        .map((netInterface) => ({
            name: netInterface.interface,
            addrs: Array.from(new Set((netInterface.addrs || []).map((addr) => addr.trim()).filter(Boolean))),
        }))
        .filter((netInterface) => netInterface.addrs.length > 0);

    if (isLoading) {
        return <LoadingSpinner/>;
    }

    if (!agent) {
        return <EmptyState/>;
    }

    return (
        <div className="bg-[#f0f2f5] dark:bg-[#05050a] min-h-screen">
            <div className="mx-auto flex max-w-7xl flex-col px-4 pb-10 pt-4 sm:pt-6 sm:px-6 lg:px-8">
                {/* 头部区域 */}
                <ServerHero
                    agent={agent}
                    latestMetrics={latestMetrics}
                    onBack={() => navigate('/')}
                />

                {/* 主内容区 */}
                <main className="flex-1 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10">
                    {/* 网络地址信息 */}
                    {(agent.ipv4 || agent.ipv6 || deviceIpInterfaces?.length > 0) && (
                        <NetworkAddressSection
                            ipv4={agent.ipv4}
                            ipv6={agent.ipv6}
                            deviceIpInterfaces={deviceIpInterfaces}
                        />
                    )}

                    {/* 系统信息 */}
                    <SystemInfoSection agent={agent} latestMetrics={latestMetrics}/>

                    {/* 历史趋势图表 */}
                    <Card
                        title="历史趋势"
                        description="针对选定时间范围展示 CPU、内存与网络的变化趋势"
                        action={
                            <div className="flex flex-wrap items-center gap-2">
                                <TimeRangeSelector
                                    value={timeRange}
                                    onChange={setTimeRange}
                                    options={SERVER_TIME_RANGE_OPTIONS}
                                    enableCustom
                                    customRange={customRange}
                                    onCustomRangeApply={handleCustomRangeApply}
                                />
                            </div>
                        }
                    >
                        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                            {/* 核心指标：大屏 2 列，小屏 1 列 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 md:grid-cols-2">
                                <CpuChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                          isLive={isLive} latestMetrics={latestMetrics}/>
                                <MemoryChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                             isLive={isLive} latestMetrics={latestMetrics}/>
                            </div>

                            {/* 网络相关：大屏 2 列，中屏 1 列 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2">
                                <NetworkChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                              isLive={isLive} latestMetrics={latestMetrics}/>
                                <DiskIOChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                             isLive={isLive} latestMetrics={latestMetrics}/>
                            </div>

                            {/* 进阶指标：单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <NetworkConnectionChart agentId={id!} timeRange={timeRange} start={customStart}
                                                        end={customEnd} isLive={isLive}
                                                        latestMetrics={latestMetrics}/>
                            </div>

                            {/* 硬件指标：条件渲染，单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <GpuChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                          isLive={isLive}/>
                                <TemperatureChart agentId={id!} timeRange={timeRange} start={customStart}
                                                  end={customEnd} isLive={isLive}/>
                            </div>

                            {/* 监控指标：单列全宽 */}
                            <div className="grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1">
                                <MonitorChart agentId={id!} timeRange={timeRange} start={customStart} end={customEnd}
                                              isLive={isLive}/>
                            </div>
                        </div>
                    </Card>

                    {/* 网络连接统计 */}
                    <NetworkConnectionSection latestMetrics={latestMetrics}/>

                    {/* GPU 监控 */}
                    <GpuMonitorSection latestMetrics={latestMetrics}/>

                    {/* 温度监控 */}
                    <TemperatureMonitorSection latestMetrics={latestMetrics}/>
                </main>
            </div>
        </div>
    );
};

export default ServerDetail;
