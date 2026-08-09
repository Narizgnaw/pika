import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle, BarChart3, CheckCircle2, Globe, Loader2, Maximize2, Search, Server, Shield, ShieldCheck, Wifi, Zap} from 'lucide-react';
import {Area, AreaChart, ResponsiveContainer} from 'recharts';
import {pika} from '../api';
import type {MetricsResponse, PublicMonitor} from '../types';
import {cn, formatDateTime} from '../lib/utils';
import {Card, StatBlock, StatusBadge} from '../components';

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

/* ========================================== MonitorCard ========================================== */

export type DisplayMode = 'avg' | 'max';

const MiniChart = ({data, lastValue, id}: {
    data: Array<{timestamp: number; value: number}>;
    lastValue?: number;
    id: string;
}) => {
    const chartData = useMemo(() => [...data].sort((a, b) => a.timestamp - b.timestamp), [data]);
    if (chartData.length === 0) {
        return <div className="flex h-16 w-full items-center justify-center text-xs text-slate-400 dark:text-slate-500">暂无数据</div>;
    }

    const color = lastValue && lastValue <= 200 ? '#22d3ee' : '#fbbf24';
    return (
        <div className="-mb-2 h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id={`colorLatency-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                        <filter id={`glow-${id}`} height="300%" width="300%" x="-75%" y="-75%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={`url(#colorLatency-${id})`}
                        strokeWidth={2}
                        filter={`url(#glow-${id})`}
                        isAnimationActive={false}
                        connectNulls
                        dot={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

const MonitorCard = ({monitor, displayMode}: {
    monitor: PublicMonitor;
    displayMode: DisplayMode;
}) => {
    // 为每个监控卡片查询历史数据
    const {data: historyData} = useQuery<MetricsResponse>({
        queryKey: ['monitorHistory', monitor.id, '12h'], // 对应后端 60 秒步长
        queryFn: async () => {
            return pika.getMonitorHistory(monitor.id, {range: '1h'});
        },
        refetchInterval: 60000,
        staleTime: 30000,
    });

    // 转换时序数据为图表数据 - 使用统一格点对该对齐多探针数据
    const chartData = useMemo(() => {
        if (!historyData?.series || historyData.series.length === 0) {
            return [];
        }

        const validSeries = historyData.series.filter(s => s.data && s.data.length > 0);
        if (validSeries.length === 0) return [];

        // 确定全局时间范围
        let minTime = Infinity, maxTime = -Infinity;
        validSeries.forEach(s => {
            minTime = Math.min(minTime, s.data![0].timestamp);
            maxTime = Math.max(maxTime, s.data![s.data!.length - 1].timestamp);
        });

        if (minTime >= maxTime) return [];

        // 定义目标采集点 (1小时数据，建议 60 个采集点)
        const maxPoints = 60;
        const timeStep = (maxTime - minTime) / (maxPoints - 1);
        const targetTimestamps: number[] = [];
        for (let i = 0; i < maxPoints; i++) {
            targetTimestamps.push(minTime + i * timeStep);
        }

        // 线性插值函数
        const interpolate = (data: Array<{ timestamp: number; value: number }>, targetTime: number): number | null => {
            if (data.length === 0) return null;
            if (data.length === 1) return data[0].timestamp === targetTime ? data[0].value : null;
            if (targetTime < data[0].timestamp || targetTime > data[data.length - 1].timestamp) return null;

            let left = 0, right = data.length - 1;
            while (right - left > 1) {
                const mid = Math.floor((left + right) / 2);
                if (data[mid].timestamp <= targetTime) left = mid;
                else right = mid;
            }
            const leftPoint = data[left];
            const rightPoint = data[right];
            const ratio = (targetTime - leftPoint.timestamp) / (rightPoint.timestamp - leftPoint.timestamp);
            return leftPoint.value + ratio * (rightPoint.value - leftPoint.value);
        };

        // 对每个目标时间点，计算所有探针的聚合值
        return targetTimestamps.map(timestamp => {
            const values: number[] = [];
            validSeries.forEach(s => {
                const val = interpolate(s.data!, timestamp);
                if (val !== null) values.push(val);
            });

            if (values.length === 0) return { timestamp, value: 0 };

            return {
                timestamp,
                value: displayMode === 'avg'
                    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
                    : Math.max(...values),
            };
        });
    }, [historyData, displayMode]);

    const displayValue = displayMode === 'avg' ? monitor.responseTime : monitor.responseTimeMax;
    const displayLabel = displayMode === 'avg' ? '平均延迟' : '最差节点延迟';

    return (
        <Card className={'p-5'} interactive>
            {/* 头部 */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3 flex-1 min-w-0">
                    <div
                        className="p-2.5 bg-gray-100 dark:bg-cyan-950/30 border border-slate-200 dark:border-cyan-500/20 rounded-lg flex-shrink-0">
                        <TypeIcon type={monitor.type}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-cyan-100 tracking-wide truncate group-hover:text-cyan-500 transition-colors">
                            {monitor.name}
                        </h3>
                        <div className="text-xs font-mono text-gray-600 dark:text-cyan-500/80 mb-0.5 tracking-wider truncate">
                            {monitor.target}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 ml-2">
                    <StatusBadge status={monitor.status}/>
                </div>
            </div>

            {/* 指标信息 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-gray-600 dark:text-cyan-500 mb-1 flex items-center gap-1">
                        {displayLabel}
                        {monitor.agentCount > 0 && (
                            <span
                                className="bg-slate-200 dark:bg-slate-700 text-xs px-1.5 rounded-full text-slate-700 dark:text-cyan-300">
                                    {monitor.agentCount} 节点
                                </span>
                        )}
                    </p>
                    <div
                        className={`text-xl font-bold flex items-baseline gap-1 ${displayValue > 200 ? 'text-amber-600 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] dark:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-800 dark:text-white drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'}`}>
                        {displayValue}<span className="text-xs text-gray-600 dark:text-cyan-500 font-normal">ms</span>
                    </div>
                </div>
                <div>
                    {monitor.type === 'https' && monitor.certExpiryTime ? (
                        <>
                            <p className="text-xs text-gray-600 dark:text-cyan-500 mb-1">SSL 证书</p>
                            <CertBadge
                                expiryTime={monitor.certExpiryTime}
                                daysLeft={monitor.certDaysLeft}
                            />
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-gray-600 dark:text-cyan-500 mb-1">上次检测</p>
                            <p className="md:text-sm text-xs text-gray-700 dark:text-cyan-300 font-mono">
                                {formatDateTime(monitor.lastCheckTime)}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* 迷你走势图 */}
            <MiniChart
                data={chartData}
                lastValue={displayValue}
                id={monitor.id}
            />
        </Card>
    );
};

/* ========================================== MonitorList 本地组件 ========================================== */

const MonitorListSpinner = () => (
    <div className="flex min-h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-cyan-500">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-cyan-500"/>
            <span className="text-sm font-mono">加载监控数据中...</span>
        </div>
    </div>
);

const MonitorListEmpty = () => (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-gray-600 dark:text-cyan-500">
        <Shield className="mb-4 h-16 w-16 opacity-20"/>
        <p className="text-lg font-medium font-mono">暂无监控数据</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-cyan-500">请先在管理后台添加监控任务</p>
    </div>
);


interface Stats {
    total: number;
    online: number;
    issues: number;
    avgLatency: number;
}

/* ========================================== MonitorList ========================================== */

const MonitorList = () => {
    const [searchKeyword, setSearchKeyword] = useState('');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('max');

    const {data: monitors = [], isLoading} = useQuery<PublicMonitor[]>({
        queryKey: ['publicMonitors'],
        queryFn: () => pika.listMonitors<PublicMonitor>(),
        refetchInterval: 30000,
    });

    let [stats, setStats] = useState<Stats>();

    // 过滤和搜索
    const filteredMonitors = useMemo(() => {
        let result = [...monitors];

        // 搜索过滤
        if (searchKeyword.trim()) {
            const keyword = searchKeyword.toLowerCase();
            result = result.filter(m =>
                m.name.toLowerCase().includes(keyword) ||
                m.target.toLowerCase().includes(keyword)
            );
        }

        return result.sort((a, b) => Number(a.status !== 'up') - Number(b.status !== 'up'));
    }, [monitors, searchKeyword]);

    // 统计信息
    const calculateStats = (monitors: PublicMonitor[]) => {
        const total = monitors.length;
        const online = monitors.filter(m => m.status === 'up').length;
        const issues = total - online;
        const avgLatency = total > 0
            ? Math.round(monitors.reduce((acc, curr) => acc + curr.responseTime, 0) / total)
            : 0;
        return {total, online, issues, avgLatency};
    }

    useEffect(() => {
        let stats = calculateStats(monitors);
        setStats(stats);
    }, [monitors]);

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <MonitorListSpinner/>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatBlock
                    title="监控服务总数"
                    value={stats?.total}
                    icon={Globe}
                    color="cyan"
                />
                <StatBlock
                    title="系统正常"
                    value={stats?.online}
                    icon={CheckCircle2}
                    color="emerald"
                    glow
                />
                <StatBlock
                    title="异常服务"
                    value={stats?.issues}
                    icon={AlertTriangle}
                    color="rose"
                    alert={stats?.issues > 0}
                />
                <StatBlock
                    title="全局平均延迟"
                    value={stats?.avgLatency}
                    unit={'ms'}
                    icon={Zap}
                    color="blue"
                />
            </div>

            {/* 过滤和搜索 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
                    {/* 显示模式切换 */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-black/40 p-1 rounded-lg border border-slate-200 dark:border-cyan-900/50 items-center">
                        <span className="text-xs text-gray-600 dark:text-cyan-500 px-2 font-mono">卡片指标:</span>
                        <button
                            onClick={() => setDisplayMode('avg')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 font-mono cursor-pointer",
                                displayMode === 'avg'
                                    ? 'bg-gray-200 dark:bg-cyan-500/20 text-gray-800 dark:text-cyan-300 border border-gray-300 dark:border-cyan-500/30'
                                    : 'text-gray-600 dark:text-cyan-500 hover:text-gray-800 dark:hover:text-cyan-400'
                            )}
                        >
                            <BarChart3 className="w-3 h-3"/> 平均
                        </button>
                        <button
                            onClick={() => setDisplayMode('max')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 font-mono cursor-pointer",
                                displayMode === 'max'
                                    ? 'bg-gray-200 dark:bg-cyan-500/20 text-gray-800 dark:text-cyan-300 border border-gray-300 dark:border-cyan-500/30'
                                    : 'text-gray-600 dark:text-cyan-500 hover:text-gray-800 dark:hover:text-cyan-400'
                            )}
                        >
                            <Maximize2 className="w-3 h-3"/> 最差(Max)
                        </button>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full md:w-64 group">
                    <div
                        className="hidden dark:block absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <div className="relative flex items-center bg-white dark:bg-[#0a0b10] rounded-lg border border-slate-200 dark:border-cyan-900">
                        <Search className="w-4 h-4 ml-3 text-gray-500 dark:text-cyan-500"/>
                        <input
                            type="text"
                            placeholder="搜索服务名称或地址..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full bg-transparent border-none text-xs text-gray-800 dark:text-cyan-100 p-2.5 focus:ring-0 placeholder-gray-400 dark:placeholder-cyan-600 font-mono focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* 监控卡片列表 */}
            {filteredMonitors.length === 0 ? (
                <MonitorListEmpty/>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-4 gap-2">
                    {filteredMonitors.map(monitor => (
                        <Link key={monitor.id} to={`/monitors/${monitor.id}`}>
                            <MonitorCard
                                monitor={monitor}
                                displayMode={displayMode}
                            />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MonitorList;
