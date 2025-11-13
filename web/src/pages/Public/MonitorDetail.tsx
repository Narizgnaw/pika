import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Globe,
    Loader2,
    Server as ServerIcon,
    Shield,
    TrendingUp
} from 'lucide-react';
import type {TooltipProps} from 'recharts';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {getMonitorStatsByName, getMonitorHistory, type AggregatedMonitorMetric} from '../../api/monitor';
import type {MonitorStats} from '../../types';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';

const formatTime = (ms: number): string => {
    if (!ms || ms <= 0) return '0 ms';
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
};

const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

const formatDateTime = (timestamp: number): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatPercentValue = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : '0.00');

const LoadingSpinner = () => (
    <div className="flex min-h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="h-8 w-8 animate-spin"/>
            <span className="text-sm">加载监控数据中...</span>
        </div>
    </div>
);

const StatusBadge = ({status}: { status: string }) => {
    const isUp = status === 'up';
    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
            isUp
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
        }`}>
            {isUp ? (
                <CheckCircle2 className="h-4 w-4"/>
            ) : (
                <AlertCircle className="h-4 w-4"/>
            )}
            {isUp ? '正常' : '异常'}
        </div>
    );
};

const UptimeBar = ({uptime}: { uptime: number }) => {
    const percentage = Math.min(Math.max(uptime, 0), 100);
    const colorClass = percentage >= 99 ? 'bg-emerald-500' : percentage >= 95 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="flex items-center gap-2">
            <div className="relative h-3 w-full overflow-hidden rounded-lg bg-slate-100">
                <div
                    className={`absolute inset-y-0 left-0 ${colorClass} transition-all duration-500`}
                    style={{width: `${percentage}%`}}
                />
            </div>
            <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                {formatPercentValue(percentage)}%
            </span>
        </div>
    );
};

const StatCard = ({icon, label, value, color = 'blue'}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: string;
}) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        red: 'bg-red-50 text-red-600',
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm text-slate-600">{label}</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
                </div>
            </div>
        </div>
    );
};

const CustomTooltip = ({active, payload, label, unit = ' ms'}: TooltipProps<number, string> & { unit?: string; label?: string; payload?: any[] }) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-slate-700">{label}</p>
            <div className="mt-1 space-y-1">
                {payload.map((entry, index) => {
                    if (!entry) {
                        return null;
                    }

                    const dotColor = entry.color ?? '#6366f1';
                    const title = entry.name ?? entry.dataKey ?? `系列 ${index + 1}`;
                    const value =
                        typeof entry.value === 'number'
                            ? Number.isFinite(entry.value)
                                ? entry.value.toFixed(2)
                                : '-'
                            : entry.value;

                    return (
                        <p key={`${entry.dataKey ?? index}`} className="flex items-center gap-2 text-slate-600">
                            <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{backgroundColor: dotColor}}
                            />
                            <span>
                                {title}: {value}{unit}
                            </span>
                        </p>
                    );
                })}
            </div>
        </div>
    );
};

// 预定义的颜色方案
const AGENT_COLORS = [
    '#2563eb', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
];

const timeRangeOptions = [
    {label: '5分钟', value: '5m'},
    {label: '15分钟', value: '15m'},
    {label: '30分钟', value: '30m'},
    {label: '1小时', value: '1h'},
] as const;

type TimeRange = typeof timeRangeOptions[number]['value'];

const MonitorDetail = () => {
    const navigate = useNavigate();
    const {name} = useParams<{ name: string }>();
    const [selectedAgent, setSelectedAgent] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<TimeRange>('5m');

    const {data: monitorStats = [], isLoading} = useQuery<MonitorStats[]>({
        queryKey: ['monitorStats', name],
        queryFn: async () => {
            if (!name) return [];
            const response = await getMonitorStatsByName(name);
            return response.data || [];
        },
        refetchInterval: 30000,
        enabled: !!name,
    });

    // 获取历史数据
    const {data: historyData = []} = useQuery<AggregatedMonitorMetric[]>({
        queryKey: ['monitorHistory', name, timeRange],
        queryFn: async () => {
            if (!name) return [];
            const response = await getMonitorHistory(name, timeRange);
            return response.data || [];
        },
        refetchInterval: 30000,
        enabled: !!name,
    });

    // 获取所有可用的探针列表
    const availableAgents = useMemo(() => {
        if (monitorStats.length === 0) return [];
        return monitorStats.map(stat => ({
            id: stat.agentId,
            label: stat.agentId.substring(0, 8),
        }));
    }, [monitorStats]);

    // 当可用探针列表变化时，检查当前选择的探针是否还存在
    useEffect(() => {
        if (selectedAgent === 'all') {
            return;
        }
        if (!availableAgents.find(agent => agent.id === selectedAgent)) {
            setSelectedAgent('all');
        }
    }, [availableAgents, selectedAgent]);

    // 生成图表数据
    const chartData = useMemo(() => {
        if (historyData.length === 0) return [];

        // 按时间戳分组数据
        const grouped = historyData.reduce((acc, item) => {
            const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });

            if (!acc[time]) {
                acc[time] = {time};
            }

            // 根据选择的探针过滤
            if (selectedAgent === 'all' || item.agentId === selectedAgent) {
                const agentKey = `agent_${item.agentId}`;
                acc[time][agentKey] = item.avgResponse;
            }

            return acc;
        }, {} as Record<string, any>);

        return Object.values(grouped);
    }, [historyData, selectedAgent]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-white text-slate-900 flex flex-col">
                <PublicHeader title="监控详情"/>
                <main className="flex-1 bg-white">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                        <LoadingSpinner/>
                    </div>
                </main>
                <PublicFooter/>
            </div>
        );
    }

    if (monitorStats.length === 0) {
        return (
            <div className="min-h-screen bg-white text-slate-900 flex flex-col">
                <PublicHeader title="监控详情"/>
                <main className="flex-1 bg-white">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex min-h-[400px] flex-col items-center justify-center text-slate-500">
                            <Shield className="mb-4 h-16 w-16 opacity-20"/>
                            <p className="text-lg font-medium">监控数据不存在</p>
                            <button
                                onClick={() => navigate('/monitors')}
                                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                            >
                                返回监控列表
                            </button>
                        </div>
                    </div>
                </main>
                <PublicFooter/>
            </div>
        );
    }

    const firstStat = monitorStats[0];
    const avgUptime24h = monitorStats.reduce((sum, s) => sum + s.uptime24h, 0) / monitorStats.length;
    const avgUptime30d = monitorStats.reduce((sum, s) => sum + s.uptime30d, 0) / monitorStats.length;
    const hasCert = firstStat.certExpiryDate > 0;
    const certExpiringSoon = hasCert && firstStat.certExpiryDays < 30;

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col">
            <PublicHeader title={`监控详情 - ${name}`}/>

            <main className="flex-1 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* 返回按钮 */}
                <button
                    onClick={() => navigate('/monitors')}
                    className="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
                >
                    <ArrowLeft className="h-4 w-4"/>
                    返回列表
                </button>

                {/* 监控信息卡片 */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50">
                                {firstStat.type === 'tcp' ? (
                                    <ServerIcon className="h-8 w-8 text-blue-600"/>
                                ) : (
                                    <Globe className="h-8 w-8 text-blue-600"/>
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{firstStat.name}</h2>
                                <p className="mt-1 text-slate-600">{firstStat.target}</p>
                                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                    <span>类型: {firstStat.type.toUpperCase()}</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{monitorStats.length} 个探针</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 汇总统计卡片 */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={<Clock className="h-6 w-6"/>}
                        label="当前响应"
                        value={formatTime(firstStat.currentResponse)}
                        color="blue"
                    />
                    <StatCard
                        icon={<Clock className="h-6 w-6"/>}
                        label="24h 平均响应"
                        value={formatTime(firstStat.avgResponse24h)}
                        color="blue"
                    />
                    <StatCard
                        icon={<CheckCircle2 className="h-6 w-6"/>}
                        label="24h 在线率"
                        value={`${formatPercentValue(avgUptime24h)}%`}
                        color={avgUptime24h >= 99 ? 'green' : avgUptime24h >= 95 ? 'yellow' : 'red'}
                    />
                    <StatCard
                        icon={<CheckCircle2 className="h-6 w-6"/>}
                        label="30d 在线率"
                        value={`${formatPercentValue(avgUptime30d)}%`}
                        color={avgUptime30d >= 99 ? 'green' : avgUptime30d >= 95 ? 'yellow' : 'red'}
                    />
                </div>

                {/* 证书信息 */}
                {hasCert && (
                    <div className={`rounded-xl border p-6 ${
                        certExpiringSoon
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-slate-200 bg-white'
                    }`}>
                        <div className="flex items-center gap-3">
                            <Shield className={`h-6 w-6 ${certExpiringSoon ? 'text-yellow-600' : 'text-slate-600'}`}/>
                            <div>
                                <h3 className={`text-lg font-semibold ${certExpiringSoon ? 'text-yellow-900' : 'text-slate-900'}`}>
                                    TLS 证书信息
                                </h3>
                                <p className={`mt-1 text-sm ${certExpiringSoon ? 'text-yellow-700' : 'text-slate-600'}`}>
                                    证书到期时间: {formatDate(firstStat.certExpiryDate)} (剩余 {firstStat.certExpiryDays} 天)
                                </p>
                                {certExpiringSoon && (
                                    <p className="mt-2 text-sm font-medium text-yellow-700">
                                        ⚠️ 证书即将过期，请及时更新
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 响应时间趋势图表 */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-600"/>
                                    响应时间趋势
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">监控各探针的响应时间变化</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {/* 时间范围选择器 */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {timeRangeOptions.map((option) => {
                                        const isActive = option.value === timeRange;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setTimeRange(option.value)}
                                                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                                                    isActive
                                                        ? 'border-blue-200 bg-blue-600 text-white'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* 探针选择器 */}
                                {availableAgents.length > 0 && (
                                    <select
                                        value={selectedAgent}
                                        onChange={(e) => setSelectedAgent(e.target.value)}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    >
                                        <option value="all">所有探针</option>
                                        {availableAgents.map((agent) => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.label}...
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        {monitorStats.map((stat, index) => {
                                            const agentKey = `agent_${stat.agentId}`;
                                            const color = AGENT_COLORS[index % AGENT_COLORS.length];
                                            return (
                                                <linearGradient key={agentKey} id={`gradient_${agentKey}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                                </linearGradient>
                                            );
                                        })}
                                    </defs>
                                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4"/>
                                    <XAxis
                                        dataKey="time"
                                        stroke="#94a3b8"
                                        style={{fontSize: '12px'}}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        style={{fontSize: '12px'}}
                                        tickFormatter={(value) => `${value} ms`}
                                    />
                                    <Tooltip content={<CustomTooltip unit=" ms"/>}/>
                                    <Legend/>
                                    {monitorStats
                                        .filter(stat => selectedAgent === 'all' || stat.agentId === selectedAgent)
                                        .map((stat) => {
                                            // 使用原始索引保持颜色一致性
                                            const originalIndex = monitorStats.findIndex(s => s.agentId === stat.agentId);
                                            const agentKey = `agent_${stat.agentId}`;
                                            const color = AGENT_COLORS[originalIndex % AGENT_COLORS.length];
                                            const agentLabel = stat.agentId.substring(0, 8);
                                            return (
                                                <Area
                                                    key={agentKey}
                                                    type="monotone"
                                                    dataKey={agentKey}
                                                    name={`探针 ${agentLabel}`}
                                                    stroke={color}
                                                    strokeWidth={2}
                                                    fill={`url(#gradient_${agentKey})`}
                                                    activeDot={{r: 4}}
                                                />
                                            );
                                        })}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                                <div className="text-center">
                                    <TrendingUp className="mx-auto h-12 w-12 text-slate-300 mb-3"/>
                                    <p>正在收集数据，请稍候...</p>
                                    <p className="text-xs text-slate-400 mt-1">图表将在数据采集后显示</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 各探针详细数据 */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-slate-900">探针监控详情</h3>
                        <p className="mt-1 text-sm text-slate-500">各探针的当前状态和统计数据</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    探针 ID
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    状态
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    当前响应
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    24h 在线率
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    30d 在线率
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    24h 检测
                                </th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                    最后检测
                                </th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {monitorStats.map((stats, index) => {
                                const color = AGENT_COLORS[index % AGENT_COLORS.length];
                                return (
                                    <tr key={stats.id} className="transition-colors hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-block h-3 w-3 rounded-full"
                                                    style={{backgroundColor: color}}
                                                />
                                                <span className="font-mono text-sm text-slate-700">
                                                    {stats.agentId.substring(0, 8)}...
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={stats.lastCheckStatus}/>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-slate-400"/>
                                                <span className="text-sm font-medium text-slate-900">
                                                    {formatTime(stats.currentResponse)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-32">
                                                <UptimeBar uptime={stats.uptime24h}/>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-32">
                                                <UptimeBar uptime={stats.uptime30d}/>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-700">
                                                {stats.successChecks24h} / {stats.totalChecks24h}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-700">
                                                {formatDateTime(stats.lastCheckTime)}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
            </main>

            <PublicFooter/>
        </div>
    );
};

export default MonitorDetail;
