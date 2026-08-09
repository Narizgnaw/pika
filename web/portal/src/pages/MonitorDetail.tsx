import {useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {AlertCircle, ArrowLeft, ChevronDown, ChevronUp, Clock, Globe, MapPin, RotateCcw, Server, ShieldCheck, Wifi} from 'lucide-react';
import {pika} from '../api';
import type {AgentMonitorStat, MetricsResponse, PublicMonitor} from '../types';
import {AGENT_COLORS, MONITOR_TIME_RANGE_OPTIONS} from '../constants';
import {cn, formatChartTime, formatDateTime, formatTime} from '../lib/utils';
import {useIsMobile} from '../hooks';
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

/* ========================================== TypeIcon ========================================== */

const TypeIcon = ({type}: {type: string}) => {
    switch (type.toLowerCase()) {
        case 'https':
            return <ShieldCheck className="w-4 h-4 text-purple-500 dark:text-purple-400"/>;
        case 'http':
            return <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400"/>;
        case 'tcp':
            return <Server className="w-4 h-4 text-orange-500 dark:text-orange-400"/>;
        case 'icmp':
        case 'ping':
            return <Wifi className="w-4 h-4 text-cyan-500 dark:text-cyan-500"/>;
        default:
            return <Server className="w-4 h-4 text-slate-500 dark:text-slate-400"/>;
    }
};

/* ========================================== CertBadge ========================================== */

const CertBadge = ({expiryTime, daysLeft}: {expiryTime: number; daysLeft: number}) => {
    if (!expiryTime || daysLeft === undefined) return null;

    const isExpired = daysLeft < 0;
    let colorClass = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";

    if (isExpired) {
        colorClass = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20";
    } else if (daysLeft < 30) {
        colorClass = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20";
    }

    return (
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs border", colorClass)}>
            <ShieldCheck className="w-3 h-3"/>
            <span>{isExpired ? "已过期" : `${daysLeft} 天后过期`}</span>
        </div>
    );
};

/* ========================================== MonitorHero ========================================== */

interface MonitorHeroProps {
    monitor: PublicMonitor;
    onBack: () => void;
}

const MonitorHero = ({monitor, onBack}: MonitorHeroProps) => {
    return (
        <Card className={'p-6 space-y-6'}>
            {/* 返回按钮 */}
            <button
                type="button"
                onClick={onBack}
                className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-cyan-500 hover:text-gray-800 dark:hover:text-cyan-400 transition font-mono"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1"/>
                返回监控列表
            </button>

            {/* 监控信息 */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="p-3 bg-gray-100 dark:bg-cyan-950/30 border border-slate-200 dark:border-cyan-500/20 rounded-lg flex-shrink-0">
                        <TypeIcon type={monitor.type}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h1 className="text-2xl sm:text-3xl font-bold truncate text-slate-800 dark:text-cyan-100 tracking-wide">{monitor.name}</h1>
                            <StatusBadge status={monitor.status}/>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-cyan-500/80 font-mono truncate">
                            {monitor.showTargetPublic ? monitor.target : '******'}
                        </p>
                    </div>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto lg:min-w-[480px]">
                    <MetricItem
                        label="监控类型"
                        value={monitor.type.toUpperCase()}
                    />
                    <MetricItem
                        label="探针数量"
                        value={monitor.agentCount}
                    />
                    <MetricItem
                        label="平均响应"
                        value={`${monitor.responseTime}ms`}
                    />
                    <MetricItem
                        label="最慢响应"
                        value={`${monitor.responseTimeMax}ms`}
                    />
                </div>
            </div>

            {/* 证书信息（如果存在证书数据）*/}
            {monitor.certExpiryTime > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-slate-200 dark:border-cyan-900/50">
                    <span className="text-xs text-gray-600 dark:text-cyan-500 font-mono">SSL 证书:</span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <CertBadge
                            expiryTime={monitor.certExpiryTime}
                            daysLeft={monitor.certDaysLeft}
                        />
                        <span className="text-xs text-gray-500 dark:text-cyan-600 font-mono break-all sm:break-normal">
                            到期时间: {formatDateTime(monitor.certExpiryTime)}
                        </span>
                    </div>
                </div>
            )}
        </Card>
    );
};

/* ========================================== AgentStatsTable ========================================== */

interface AgentStatsTableProps {
    monitorStats: AgentMonitorStat[];
    monitorType: string;
}

const AgentStatsTable = ({monitorStats, monitorType}: AgentStatsTableProps) => {
    if (monitorStats.length === 0) {
        return (
            <div className="text-center py-12 text-gray-600 dark:text-cyan-500">
                <p className="text-sm font-mono">暂无探针数据</p>
            </div>
        );
    }

    return (
        <Card className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-bold tracking-wide text-slate-800 dark:text-cyan-100 uppercase">探针监控详情</h3>
                <p className="text-xs text-gray-600 dark:text-cyan-500 mt-1 font-mono">各探针的当前状态和统计数据</p>
            </div>

            {/* 移动端卡片布局 */}
            <div className="block lg:hidden space-y-3">
                {monitorStats.map((stat, index) => {
                    const color = AGENT_COLORS[index % AGENT_COLORS.length];
                    return (
                        <div
                            key={stat.agentId}
                            className="p-4 bg-slate-50 dark:bg-cyan-950/20 border border-slate-200 dark:border-cyan-900/50 rounded-lg space-y-3"
                        >
                            {/* 探针名称和状态 */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span
                                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                                        style={{backgroundColor: color}}
                                    />
                                    <MapPin className="h-3.5 w-3.5 text-gray-600 dark:text-cyan-500 flex-shrink-0"/>
                                    <span className="font-mono text-sm text-slate-800 dark:text-cyan-200 truncate">
                                        {stat.agentName || stat.agentId.substring(0, 8)}
                                    </span>
                                </div>
                                <StatusBadge status={stat.status}/>
                            </div>

                            {/* 响应时间和最后检测 */}
                            <div className="flex items-center justify-between gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-600 dark:text-cyan-500"/>
                                    <span className="font-semibold text-slate-800 dark:text-cyan-100 font-mono">
                                        {formatTime(stat.responseTime)}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-600 dark:text-cyan-500 font-mono">
                                    {formatDateTime(stat.checkedAt)}
                                </span>
                            </div>

                            {/* 证书信息 */}
                            {monitorType === 'https' && stat.certExpiryTime && (
                                <div className="pt-2 border-t border-slate-200 dark:border-cyan-900/30">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-xs text-gray-600 dark:text-cyan-500 font-mono">证书:</span>
                                        <CertBadge
                                            expiryTime={stat.certExpiryTime}
                                            daysLeft={stat.certDaysLeft}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 错误信息 */}
                            {stat.status === 'down' && stat.message && (
                                <div className="pt-2 border-t border-slate-200 dark:border-cyan-900/30">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5"/>
                                        <span className="text-xs text-rose-300 break-words font-mono">
                                            {stat.message}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 桌面端表格布局 */}
            <div className="hidden lg:block overflow-x-auto -mx-6 px-6">
                <table className="min-w-full">
                    <thead>
                    <tr className="border-b border-slate-200 dark:border-cyan-900/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono">
                            探针名称
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono">
                            状态
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono">
                            响应时间
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono">
                            最后检测
                        </th>
                        {monitorType === 'https' && (
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono hidden xl:table-cell">
                                证书信息
                            </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-cyan-500 font-mono hidden xl:table-cell">
                            错误信息
                        </th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-cyan-900/30">
                    {monitorStats.map((stat, index) => {
                        const color = AGENT_COLORS[index % AGENT_COLORS.length];
                        return (
                            <tr key={stat.agentId}
                                className="hover:bg-slate-100 dark:hover:bg-cyan-950/20 transition-colors">
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                            <span
                                                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                                                style={{backgroundColor: color}}
                                            />
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-gray-600 dark:text-cyan-500"/>
                                            <span className="font-mono text-sm text-slate-800 dark:text-cyan-200">
                                                    {stat.agentName || stat.agentId.substring(0, 8)}
                                                </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <StatusBadge status={stat.status}/>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-gray-600 dark:text-cyan-500"/>
                                        <span
                                            className="text-sm font-semibold text-slate-800 dark:text-cyan-100 font-mono">
                                                {formatTime(stat.responseTime)}
                                            </span>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-cyan-500 font-mono">
                                    {formatDateTime(stat.checkedAt)}
                                </td>
                                {monitorType === 'https' && (
                                    <td className="px-4 py-4 hidden xl:table-cell">
                                        {stat.certExpiryTime ? (
                                            <CertBadge
                                                expiryTime={stat.certExpiryTime}
                                                daysLeft={stat.certDaysLeft}
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-600 dark:text-cyan-500">-</span>
                                        )}
                                    </td>
                                )}
                                <td className="px-4 py-4 hidden xl:table-cell">
                                    {stat.status === 'down' && stat.message ? (
                                        <div className="flex items-start gap-2 max-w-xs">
                                            <AlertCircle
                                                className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5"/>
                                            <span
                                                className="text-xs text-rose-300 break-words line-clamp-2 font-mono">
                                                    {stat.message}
                                                </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-600 dark:text-cyan-500">-</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

/* ========================================== ResponseTimeChart ========================================== */

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
 * 使用 HSL 色轮均匀分布，支持无限数量的探针
 */
const generateColors = (count: number): string[] => {
    const colors: string[] = [];
    const hueStep = 360 / count;
    
    for (let i = 0; i < count; i++) {
        const hue = (i * hueStep) % 360;
        const saturation = 65 + (i % 3) * 10;
        const lightness = 45 + (i % 2) * 10;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return colors;
};

/**
 * 自定义图例组件
 */
const CustomLegend = ({onClick, selectedAgents, allAgents, colors, collapsed}: any) => {
    if (!allAgents || allAgents.length === 0) return null;

    if (collapsed) return null;

    return (
        <div className="flex flex-wrap justify-center gap-4 pt-4">
            {allAgents.map((agent: {id: string; name: string}, index: number) => {
                const isSelected = selectedAgents.has(agent.id);
                const color = colors[index];

                return (
                    <div
                        key={agent.id}
                        onClick={() => onClick(agent.id)}
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
                            {agent.name}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

interface ResponseTimeChartProps {
    monitorId: string;
    monitorStats: AgentMonitorStat[];
}

const ResponseTimeChart = ({monitorId, monitorStats}: ResponseTimeChartProps) => {
    const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
    const [timeRange, setTimeRange] = useState<string>('12h');
    const [customRange, setCustomRange] = useState<{start: number; end: number} | null>(null);
    const [legendCollapsed, setLegendCollapsed] = useState(true); // 移动端默认收起
    const isMobile = useIsMobile();
    const customStart = timeRange === 'custom' ? customRange?.start : undefined;
    const customEnd = timeRange === 'custom' ? customRange?.end : undefined;
    const rangeMs = customStart !== undefined && customEnd !== undefined ? customEnd - customStart : undefined;

    // 获取历史数据
    const {data: historyData} = useQuery<MetricsResponse>({
        queryKey: ['monitorHistory', monitorId, timeRange, customStart, customEnd],
        queryFn: async () => {
            if (!monitorId) throw new Error('Monitor ID is required');
            return pika.getMonitorHistory(monitorId, {
                range: timeRange,
                start: customStart,
                end: customEnd,
            });
        },
        refetchInterval: 30000,
        enabled: !!monitorId,
    });

    // 获取所有可用的探针列表
    const availableAgents = useMemo(() => {
        if (monitorStats.length === 0) return [];
        return monitorStats.map(stat => ({
            id: stat.agentId,
            name: stat.agentName || stat.agentId.substring(0, 8),
        }));
    }, [monitorStats]);

    // 初始化选中所有探针
    useEffect(() => {
        if (availableAgents.length > 0 && selectedAgents.size === 0) {
            setSelectedAgents(new Set(availableAgents.map(a => a.id)));
        }
    }, [availableAgents, selectedAgents.size]);

    // 动态生成颜色
    const colors = useMemo(() => {
        return generateColors(availableAgents.length);
    }, [availableAgents.length]);

    const toggleAgent = (agentId: string) => {
        setSelectedAgents((current) => {
            if (current.size === availableAgents.length) return new Set([agentId]);
            const next = new Set(current);
            if (next.has(agentId)) next.delete(agentId);
            else next.add(agentId);
            return next;
        });
    };

    const handleAreaClick = (data: unknown) => {
        const key = (data as {dataKey?: string})?.dataKey;
        if (key) toggleAgent(key.replace('agent_', ''));
    };

    // 恢复全选
    const handleSelectAll = () => {
        setSelectedAgents(new Set(availableAgents.map(a => a.id)));
    };

    // 是否有探针未选中
    const hasUnselected = selectedAgents.size < availableAgents.length;

    // 切换图例显示/隐藏（仅移动端）
    const toggleLegend = () => setLegendCollapsed((collapsed) => !collapsed);

    // 生成图表数据 - 使用统一时间网格对齐
    const chartData = useMemo(() => {
        if (!historyData?.series) return [];

        const seriesList = historyData.series.filter(s => s.name === 'response_time');
        if (seriesList.length === 0) return [];

        // 收集所有选中探针的数据
        const selectedSeriesData: Array<{key: string; data: Array<{timestamp: number; value: number}>}> = [];

        seriesList.forEach((s) => {
            const agentId = s.labels?.agent_id || 'unknown';
            if (!selectedAgents.has(agentId)) return;
            if (!s.data || s.data.length === 0) return;

            selectedSeriesData.push({
                key: `agent_${agentId}`,
                data: [...s.data].sort((a, b) => a.timestamp - b.timestamp)
            });
        });

        if (selectedSeriesData.length === 0) return [];

        // 确定全局时间范围
        let minTime = Infinity, maxTime = -Infinity;
        selectedSeriesData.forEach(s => {
            minTime = Math.min(minTime, s.data[0].timestamp);
            maxTime = Math.max(maxTime, s.data[s.data.length - 1].timestamp);
        });

        if (minTime >= maxTime) return [];

        // 生成均匀的目标时间点
        const maxPoints = getMaxDataPoints(timeRange);
        const timeStep = (maxTime - minTime) / (maxPoints - 1);
        const targetTimestamps: number[] = [];
        for (let i = 0; i < maxPoints; i++) {
            targetTimestamps.push(minTime + i * timeStep);
        }

        // 线性插值函数
        const interpolate = (data: Array<{timestamp: number; value: number}>, targetTime: number): number | null => {
            if (data.length === 0) return null;
            if (data.length === 1) return data[0].timestamp === targetTime ? data[0].value : null;

            // 超出范围不插值（防止产生虚假连线）
            if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) {
                // 如果距离最近的点足够近（比如小于两个采样间隔），可以考虑保留，否则返回null
                return null;
            }

            // 二分查找
            let left = 0, right = data.length - 1;
            while (right - left > 1) {
                const mid = Math.floor((left + right) / 2);
                if (data[mid].timestamp <= targetTime) {
                    left = mid;
                } else {
                    right = mid;
                }
            }

            const leftPoint = data[left];
            const rightPoint = data[right];
            const ratio = (targetTime - leftPoint.timestamp) / (rightPoint.timestamp - leftPoint.timestamp);
            return leftPoint.value + ratio * (rightPoint.value - leftPoint.value);
        };

        // 对齐所有探针数据
        return targetTimestamps.map(timestamp => {
            const dataPoint: any = {timestamp};
            selectedSeriesData.forEach(s => {
                const value = interpolate(s.data, timestamp);
                if (value !== null) {
                    dataPoint[s.key] = Number(value.toFixed(2));
                }
            });
            return dataPoint;
        });
    }, [historyData, selectedAgents, timeRange, customStart, customEnd]);

    return (
        <Card className={'p-6'}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold tracking-wide text-slate-800 dark:text-cyan-100 uppercase">响应时间趋势</h3>
                    <p className="text-xs text-gray-600 dark:text-cyan-500 mt-1 font-mono">监控各探针的响应时间变化</p>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                    <TimeRangeSelector
                        value={timeRange}
                        onChange={setTimeRange}
                        options={MONITOR_TIME_RANGE_OPTIONS}
                        enableCustom
                        customRange={customRange}
                        onCustomRangeApply={(range) => {
                            setCustomRange(range);
                        }}
                    />
                </div>
            </div>

            {/* 使用提示和恢复按钮 */}
            {availableAgents.length > 0 && (
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
                            <RotateCcw size={16}/>
                        </button>
                    )}
                </div>
            )}

            {chartData.length > 0 ? (
                <div>
                    <ResponsiveContainer width="100%" height={360}>
                        <AreaChart data={chartData}>
                            <defs>
                                {Array.from(selectedAgents).map((agentId, index) => {
                                    const originalIndex = availableAgents.findIndex(a => a.id === agentId);
                                    const agentKey = `agent_${agentId}`;
                                    return (
                                        <linearGradient key={agentKey} id={`gradient_${agentKey}`} x1="0" y1="0"
                                                        x2="0" y2="1">
                                            <stop offset="5%" stopColor={colors[originalIndex]} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={colors[originalIndex]} stopOpacity={0}/>
                                        </linearGradient>
                                    );
                                })}
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                className="stroke-slate-200 dark:stroke-cyan-900/30"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="timestamp"
                                type="number"
                                scale="time"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(value) => formatChartTime(Number(value), timeRange, rangeMs)}
                                className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                                stroke="currentColor"
                                tickLine={false}
                                axisLine={false}
                                angle={-15}
                                textAnchor="end"
                            />
                            <YAxis
                                className="text-xs text-gray-600 dark:text-cyan-500 font-mono"
                                stroke="currentColor"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}ms`}
                            />
                            <Tooltip
                                content={<CustomTooltip unit={'ms'}/>}
                                wrapperStyle={{zIndex: 9999}}
                            />
                            {Array.from(selectedAgents).map((agentId) => {
                                const originalIndex = availableAgents.findIndex(a => a.id === agentId);
                                const agentKey = `agent_${agentId}`;
                                const agent = availableAgents.find(a => a.id === agentId);
                                return (
                                    <Area
                                        key={agentKey}
                                        type="monotone"
                                        dataKey={agentKey}
                                        name={agent?.name || agentId.substring(0, 8)}
                                        stroke={colors[originalIndex]}
                                        strokeWidth={2}
                                        fill={`url(#gradient_${agentKey})`}
                                        activeDot={{r: 5, strokeWidth: 0}}
                                        dot={false}
                                        connectNulls
                                        onClick={handleAreaClick}
                                        style={{cursor: 'pointer'}}
                                    />
                                );
                            })}
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* 桌面端：直接显示图例 */}
                    {!isMobile && availableAgents.length > 0 && (
                        <CustomLegend
                            onClick={toggleAgent}
                            selectedAgents={selectedAgents}
                            allAgents={availableAgents}
                            colors={colors}
                        />
                    )}

                    {/* 移动端：可折叠图例 */}
                    {isMobile && availableAgents.length > 0 && (
                        <div className="pt-4">
                            <button
                                onClick={toggleLegend}
                                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-600 dark:text-cyan-400 hover:text-gray-900 dark:hover:text-cyan-300"
                            >
                                <span>{legendCollapsed ? '显示图例' : '收起图例'}</span>
                                {legendCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                            </button>
                            <CustomLegend
                                onClick={toggleAgent}
                                selectedAgents={selectedAgents}
                                allAgents={availableAgents}
                                colors={colors}
                                collapsed={legendCollapsed}
                            />
                        </div>
                    )}
                </div>
            ) : (
                <ChartPlaceholder
                    subtitle="正在收集数据，请稍后查看历史趋势"
                    heightClass="h-80"
                />
            )}
        </Card>
    );
};

/* ========================================== MonitorDetail ========================================== */

/**
 * 监控详情页面
 * 显示监控的详细信息、响应时间趋势和各探针统计
 */
const MonitorDetail = () => {
    const navigate = useNavigate();
    const {id} = useParams<{id: string}>();

    // 获取监控详情（聚合数据）
    const {data: monitorDetail, isLoading} = useQuery<PublicMonitor>({
        queryKey: ['monitorDetail', id],
        queryFn: async () => {
            if (!id) throw new Error('Monitor ID is required');
            return pika.getMonitorStats<PublicMonitor>(id);
        },
        refetchInterval: 30000,
        enabled: !!id,
    });

    // 获取各探针的统计数据
    const {data: monitorStats = []} = useQuery<AgentMonitorStat[]>({
        queryKey: ['monitorAgentStats', id],
        queryFn: async () => {
            if (!id) return [];
            return pika.getMonitorAgents<AgentMonitorStat>(id);
        },
        refetchInterval: 30000,
        enabled: !!id,
    });

    if (isLoading) {
        return <LoadingSpinner/>;
    }

    if (!monitorDetail) {
        return <EmptyState/>;
    }

    return (
        <div className="bg-[#f0f2f5] dark:bg-[#05050a] min-h-screen">
            <div className="mx-auto flex max-w-7xl flex-col px-4 pb-10 pt-4 sm:pt-6 sm:px-6 lg:px-8">
                {/* 头部区域 */}
                <MonitorHero
                    monitor={monitorDetail}
                    onBack={() => navigate('/monitors')}
                />

                {/* 主内容区 */}
                <main className="flex-1 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10">
                    {/* 响应时间趋势图表 */}
                    <ResponseTimeChart
                        monitorId={id!}
                        monitorStats={monitorStats}
                    />

                    {/* 各探针详细数据 */}
                    <AgentStatsTable
                        monitorStats={monitorStats}
                        monitorType={monitorDetail.type}
                    />
                </main>
            </div>
        </div>
    );
};

export default MonitorDetail;
