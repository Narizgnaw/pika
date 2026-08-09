import {type FC, type ReactNode, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
    Activity,
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Calendar,
    Clock,
    Cpu,
    Filter,
    Globe,
    HardDrive,
    LinkIcon,
    MemoryStick,
    Network,
    Thermometer,
    UnlinkIcon
} from 'lucide-react';
import {pika} from '../api';
import type {Agent, LatestMetrics, TagsResponse} from '../types';
import {cn, formatBytes, formatSpeed, formatTime, formatUptime, isExpired} from '../lib/utils';
import {Card, LoadingSpinner, StatBlock} from '../components';

interface AgentWithMetrics extends Agent {
    metrics?: LatestMetrics;
}

/* ========================================== CompactResourceBar ========================================== */

// 紧凑型资源条组件
const CompactResourceBar = ({value, label, subtext, icon: Icon, color = "bg-cyan-500"}: {
    value: number;
    label: string;
    subtext?: string;
    icon: any;
    color?: string;
}) => {
    const isCritical = value > 90;
    const isWarning = value > 75;

    // 颜色定义 (Hex codes for precise control)
    let barColor = "";
    let iconClass = "";
    let textClass = "dark:text-cyan-50"; // 默认高亮白/青

    if (isCritical) {
        barColor = "bg-rose-500";
        iconClass = "text-rose-600 dark:text-rose-500";
        textClass = "text-rose-400";
    } else if (isWarning) {
        barColor = "bg-amber-500";
        iconClass = "text-amber-600 dark:text-amber-400";
        textClass = "text-amber-400";
    } else if (color.includes("purple")) {
        barColor = "bg-purple-500";
        iconClass = "text-purple-600 dark:text-purple-400";
    } else if (color.includes("blue")) {
        barColor = "bg-blue-500";
        iconClass = "text-blue-600 dark:text-blue-400";
    } else {
        barColor = "bg-cyan-500";
        iconClass = "text-cyan-600 dark:text-cyan-400";
    }

    return (
        <div>
            <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <div className="flex items-center w-full h-5 gap-2 text-xs font-mono">
                            {/* Icon & Label */}
                            <div className={`flex items-center gap-2 w-10 flex-shrink-0 ${iconClass}`}>
                                <Icon className="w-3.5 h-3.5" strokeWidth={2}/>
                                <span className="text-xs font-bold tracking-wider opacity-80">{label}</span>
                            </div>

                            {/* Track Container */}
                            <div className="w-[100px] h-2 dark:bg-[#121217] bg-[#e2e8f0] relative border border-white/5 overflow-hidden">

                                {/* Scale Marks Background (The "Ruler" effect) */}
                                <div
                                    className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0"
                                    style={{
                                        backgroundImage: 'linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
                                        backgroundSize: '10% 100%'
                                    }}
                                ></div>

                                <div
                                    className={`h-full relative transition-all duration-500 ease-out z-10 ${barColor}`}
                                    style={{
                                        width: `${Math.min(value, 100)}%`,
                                        backgroundImage: 'linear-gradient(45deg,rgba(0,0,0,.2) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.2) 50%,rgba(0,0,0,.2) 75%,transparent 75%,transparent)',
                                        backgroundSize: '4px 4px'
                                    }}
                                >
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-red-500 shadow-[0_0_8px_red-500] dark:bg-white dark:shadow-[0_0_8px_white]"></div>
                                </div>
                            </div>
                            <div
                                className={cn(`w-10 font-medium text-xs cursor-pointer`, textClass)}>
                                {value.toFixed(1)}%
                            </div>
                        </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="px-2 py-1 bg-slate-800/95 text-slate-200 text-xs rounded border border-white/10 whitespace-nowrap shadow-lg z-50 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                            sideOffset={8}
                            side="top"
                        >
                            {subtext}
                            <Tooltip.Arrow className="fill-slate-800/95"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </Tooltip.Provider>
        </div>
    );
};

/* ========================================== 共享辅助函数 ========================================== */

const calculateNetworkSpeed = (metrics?: LatestMetrics) => {
    if (!metrics?.network) {
        return {upload: 0, download: 0};
    }
    return {
        upload: metrics.network.totalBytesSentRate,
        download: metrics.network.totalBytesRecvRate
    };
};

const calculateDiskUsage = (metrics?: LatestMetrics) => {
    if (!metrics?.disk) {
        return 0;
    }
    return metrics.disk.usagePercent;
};

const getTemperatures = (metrics?: LatestMetrics) => {
    if (!metrics?.temperature || metrics.temperature.length === 0) {
        return [];
    }
    // 返回所有温度数据
    return metrics.temperature.sort((a, b) => a.type.localeCompare(b.type));
};

const getTrafficProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 90) return 'bg-orange-500';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-emerald-500';
};

/* ========================================== ServerCard ========================================== */

interface ServerCardProps {
    server: AgentWithMetrics;
}

const ServerCard: FC<ServerCardProps> = ({server}) => {
    const isOnline = server.status === 1;
    const cpuUsage = server.metrics?.cpu?.usagePercent ?? 0;
    const memoryUsage = server.metrics?.memory?.usagePercent ?? 0;
    const memoryTotal = server.metrics?.memory?.total ?? 0;
    const memoryUsed = server.metrics?.memory?.used ?? 0;
    const diskUsage = calculateDiskUsage(server.metrics);
    const diskTotal = server.metrics?.disk?.total ?? 0;
    const diskUsed = server.metrics?.disk?.used ?? 0;
    const {upload, download} = calculateNetworkSpeed(server.metrics);
    const temperatures = getTemperatures(server.metrics);
    const netConn = server.metrics?.networkConnection;
    const traffic = server.trafficStats;
    const trafficUsagePercent = traffic?.enabled && traffic.limit > 0
        ? Math.min(100, (traffic.used / traffic.limit) * 100)
        : 0;

    return (
        <Link to={`/servers/${server.id.substring(0, 8)}`}>
            <Card>
                <div className="relative z-10 p-5 space-y-2">
                    {/* 顶部：名称和状态 */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className={cn(
                                'font-bold text-slate-800 dark:text-cyan-100 font-mono text-base truncate',
                                isExpired(server.expireTime) ? 'text-red-600 dark:text-red-400' : ''
                            )}>
                                {server.name || server.hostname}
                            </div>
                            <div
                                className="flex items-center gap-2 text-xs text-gray-600 dark:text-cyan-500 mt-1 font-mono uppercase">
                                <span>{server.os}</span>
                                <span className="w-px h-2 bg-gray-400 dark:bg-cyan-800"></span>
                                <span>{server.arch}</span>
                            </div>
                        </div>
                        {server.tags && server.tags.length > 0 && (
                            <div className="flex gap-1 flex-wrap justify-end">
                                {server.tags.slice(0, 2).map(tag => (
                                    <span
                                        key={tag}
                                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-cyan-900/40 text-gray-700 dark:text-cyan-500 border border-gray-300 dark:border-cyan-700/50 text-xs font-mono rounded-sm whitespace-nowrap"
                                    >
                                #{tag}
                            </span>
                                ))}
                                {server.tags.length > 2 && (
                                    <span
                                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-cyan-900/40 text-gray-700 dark:text-cyan-500 border border-gray-300 dark:border-cyan-700/50 text-xs font-mono rounded-sm">
                                +{server.tags.length - 2}
                            </span>
                                )}
                            </div>
                        )}
                    </div>

                    {isOnline && server.metrics?.host && (
                        <div className="flex items-center gap-2 text-xs font-mono mt-1.5">
                            <div className="flex items-center gap-1 text-gray-500 dark:text-cyan-500">
                                <Clock className="w-3 h-3"/>
                                <span>{formatUptime(server.metrics.host.uptime)}</span>
                            </div>
                            <span className="w-px h-2 bg-gray-400 dark:bg-cyan-800"></span>
                            <div className="flex items-center gap-1 text-gray-500 dark:text-cyan-500">
                                <Activity className="w-3 h-3"/>
                                <span>{server.metrics.host.procs} 进程</span>
                            </div>
                        </div>
                    )}

                    {/* 资源使用情况 */}
                    {isOnline ? (
                        <div className="space-y-1">
                            <CompactResourceBar
                                value={cpuUsage}
                                label="CPU"
                                icon={Cpu}
                                subtext={server.metrics?.cpu ? `${server.metrics.cpu.physicalCores}核` : null}
                                color="bg-blue-500"
                            />
                            <CompactResourceBar
                                value={memoryUsage}
                                label="RAM"
                                icon={MemoryStick}
                                subtext={`${formatBytes(memoryUsed, 0)}/${formatBytes(memoryTotal, 0)}`}
                                color="bg-purple-500"
                            />
                            <CompactResourceBar
                                value={diskUsage}
                                label="DSK"
                                icon={HardDrive}
                                subtext={`${formatBytes(diskUsed, 0)}/${formatBytes(diskTotal, 0)}`}
                                color="bg-emerald-500"
                            />
                            {temperatures.length > 0 && (
                                <div className="flex items-center gap-2 mt-1 text-xs font-mono pt-1 flex-wrap">
                                    <Thermometer className="w-3 h-3 text-orange-400"/>
                                    {temperatures.map((temp, index) => (
                                        <span key={index} className="flex items-center gap-1">
                                        <span className="text-orange-400">{temp.temperature?.toFixed(1)}°C</span>
                                        <span className="text-gray-500 dark:text-cyan-500">{temp.type}</span>
                                            {index < temperatures.length - 1 &&
                                                <span className="text-gray-400 dark:text-cyan-900">|</span>}
                                    </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-rose-500 font-mono flex items-center gap-2 py-2">
                            <AlertTriangle className="w-4 h-4"/>
                            <span>离线</span>
                        </div>
                    )}

                    {/* 网络和流量 */}
                    <div className="pt-2 border-t border-slate-200 dark:border-cyan-900/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-3 text-xs font-mono">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400/80">
                                <ArrowDown className="w-3 h-3"/>
                                {formatSpeed(download)}
                            </span>
                                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400/80">
                                <ArrowUp className="w-3 h-3"/>
                                    {formatSpeed(upload)}
                            </span>
                            </div>
                            {server.expireTime > 0 && (
                                <div
                                    className={cn(
                                        `text-xs font-mono flex items-center gap-1 text-gray-600 dark:text-cyan-500`,
                                        // 剩余时间小于 30 天时显示为红色
                                        isExpired(server.expireTime) ? 'text-red-600 dark:text-red-400' : ''
                                    )}>
                                    <Calendar className="w-3 h-3"/>
                                    {new Date(server.expireTime).toLocaleDateString('zh-CN')}
                                </div>
                            )}
                        </div>
                        {isOnline && netConn && (
                            <div className="flex gap-3 text-xs font-mono">
                            <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 text-emerald-600 dark:text-emerald-400"/>
                                <span
                                    className="text-emerald-600 dark:text-emerald-400">{netConn.established || 0}</span>
                                <span className="text-gray-600 dark:text-cyan-500">ESTABLISHED</span>
                            </span>
                                <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 text-blue-600 dark:text-blue-400"/>
                                <span className="text-blue-600 dark:text-blue-400">{netConn.listen || 0}</span>
                                <span className="text-gray-600 dark:text-cyan-500">LISTEN</span>
                            </span>
                                <span className="flex items-center gap-1">
                                <Network className="w-3 h-3 text-rose-600 dark:text-rose-400"/>
                                <span className="text-rose-600 dark:text-rose-400">{netConn.closeWait || 0}</span>
                                <span className="text-gray-600 dark:text-cyan-500">CLOSE_WAIT</span>
                            </span>
                            </div>
                        )}
                        {traffic?.enabled && (
                            <div className="pt-2 border-t border-slate-200 dark:border-cyan-900/30 space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                    <Activity className="w-3 h-3"/>
                                    <span>{traffic.type === 'recv' ? '进站' : traffic.type === 'send' ? '出站' : '全部'}流量</span>
                                </div>
                                {traffic.limit > 0 ? (
                                    <>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-xs text-gray-600 dark:text-cyan-500 font-mono">
                                                {formatBytes(traffic.used, 1)} / {formatBytes(traffic.limit, 1)}
                                            </span>
                                            <span className="text-xs font-bold text-gray-700 dark:text-cyan-400 font-mono">
                                                {trafficUsagePercent.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 dark:bg-cyan-900/50 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${getTrafficProgressColor(trafficUsagePercent)}`}
                                                style={{width: `${trafficUsagePercent}%`}}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                            重置日期: 每月 {traffic.resetDay} 号
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                        已使用: {formatBytes(traffic.used, 1)}
                                        <div className="text-xs text-gray-400 dark:text-cyan-700 mt-1">仅统计模式</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </Link>
    );
};

/* ========================================== ServerList 本地组件 ========================================== */

const NetworkStatCard = ({uploadRate, downloadRate, uploadTotal, downloadTotal}: {
    uploadRate: number;
    downloadRate: number;
    uploadTotal: number;
    downloadTotal: number;
}) => (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-blue-500/30 dark:bg-blue-500/5 dark:text-blue-400">
        <Network className="absolute -right-4 -bottom-4 h-16 w-16 rotate-[-15deg] opacity-10 sm:h-24 sm:w-24"/>
        <div className="relative z-10 flex items-start justify-between">
            <div className="min-w-0 flex-1">
                <div className="mb-3 text-xs font-bold font-mono uppercase tracking-widest opacity-70">网络统计</div>
                <div className="space-y-0.5 text-xs font-mono">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ArrowUp className="h-3 w-3 flex-shrink-0 text-blue-600 dark:text-blue-400"/>
                        <span className="truncate dark:text-cyan-300">{formatSpeed(uploadRate)}</span>
                        <span className="hidden text-gray-700 dark:text-cyan-500 sm:inline">({formatBytes(uploadTotal)})</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ArrowDown className="h-3 w-3 flex-shrink-0 text-green-600 dark:text-emerald-400"/>
                        <span className="truncate dark:text-cyan-300">{formatSpeed(downloadRate)}</span>
                        <span className="hidden text-gray-700 dark:text-cyan-500 sm:inline">({formatBytes(downloadTotal)})</span>
                    </div>
                </div>
            </div>
            <Network className="m-3 h-6 w-6"/>
        </div>
    </div>
);

interface ServerListEmptyProps {
    title: string;
    description: string;
    extra?: ReactNode;
}

const ServerListEmpty = ({title, description, extra}: ServerListEmptyProps) => (
    <div
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-cyan-500/30 bg-white/90 dark:bg-[#0a0b10]/90 p-12 text-center backdrop-blur">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
            <HardDrive className="h-7 w-7"/>
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800 dark:text-cyan-100 font-mono">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-cyan-500">{description}</p>
        {extra ? <div className="mt-4">{extra}</div> : null}
    </div>
);

/* ========================================== ServerList ========================================== */

const ServerList = () => {
    const navigate = useNavigate();
    const [selectedTag, setSelectedTag] = useState<string>('');

    const {data: agents = [], isLoading} = useQuery<AgentWithMetrics[]>({
        queryKey: ['agents', 'online'],
        queryFn: () => pika.listAgents<AgentWithMetrics>(),
        refetchInterval: 3000,
    });

    // 获取标签列表
    const {data: tagsData} = useQuery({
        queryKey: ['tags', 'public'],
        queryFn: async () => {
            const response = await pika.getTags<TagsResponse>();
            return response.tags || [];
        },
        refetchInterval: 30000,
    });

    // 计算所有标签（包括ALL和ONLINE/OFFLINE）
    const allTags = useMemo(() => {
        const tags = ['ALL', 'ONLINE', 'OFFLINE'];
        if (tagsData && tagsData.length > 0) {
            tagsData.forEach((tag: string) => {
                if (!tags.includes(tag.toUpperCase())) {
                    tags.push(tag.toUpperCase());
                }
            });
        }
        return tags;
    }, [tagsData]);

    // 过滤逻辑
    const displayAgents = useMemo(() => {
        if (selectedTag === 'ONLINE') {
            return agents.filter(a => a.status === 1);
        } else if (selectedTag === 'OFFLINE') {
            return agents.filter(a => a.status !== 1);
        } else if (selectedTag && selectedTag !== 'ALL') {
            return agents.filter(a => a.tags?.map(t => t.toUpperCase()).includes(selectedTag));
        }
        return agents;
    }, [agents, selectedTag]);

    // 计算统计数据（基于过滤后的 displayAgents）
    const stats = useMemo(() => {
        const total = displayAgents.length;
        const online = displayAgents.filter(a => a.status === 1).length;
        const offline = total - online;

        // 计算网络统计
        let totalUploadRate = 0;
        let totalDownloadRate = 0;
        let totalUploadTotal = 0;
        let totalDownloadTotal = 0;

        displayAgents.forEach(agent => {
            if (agent.status === 1 && agent.metrics?.network) {
                totalUploadRate += agent.metrics.network.totalBytesSentRate || 0;
                totalDownloadRate += agent.metrics.network.totalBytesRecvRate || 0;
                totalUploadTotal += agent.metrics.network.totalBytesSentTotal || 0;
                totalDownloadTotal += agent.metrics.network.totalBytesRecvTotal || 0;
            }
        });

        return {
            total,
            online,
            offline,
            uploadRate: totalUploadRate,
            downloadRate: totalDownloadRate,
            uploadTotal: totalUploadTotal,
            downloadTotal: totalDownloadTotal
        };
    }, [displayAgents]);

    const handleNavigate = (agentId: string) => {
        navigate(`/servers/${agentId.substring(0, 8)}`);
    };

    if (isLoading) {
        return <LoadingSpinner/>;
    }

    // debug
    // displayAgents = Array.from({length:10}, ()=>displayAgents).flat();

    return (
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatBlock
                    title="设备总数"
                    value={stats?.total}
                    icon={Globe}
                    color="cyan"
                />
                <StatBlock
                    title="在线设备"
                    value={stats?.online}
                    icon={LinkIcon}
                    color="emerald"
                    glow
                />
                <StatBlock
                    title="离线设备"
                    value={stats.offline}
                    icon={UnlinkIcon}
                    color="rose"
                    alert={stats?.offline > 0}
                />
                <NetworkStatCard
                    uploadRate={stats?.uploadRate}
                    downloadRate={stats?.downloadRate}
                    uploadTotal={stats?.uploadTotal}
                    downloadTotal={stats?.downloadTotal}
                />
            </div>

            {/* 标签过滤器 */}
            {allTags.length > 1 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                    <div
                        className="text-sm sm:text-xs font-mono text-gray-700 dark:text-cyan-500 flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2 font-bold">
                        <Filter className="w-4 h-4"/>
                        <span className="hidden sm:inline">FILTERS:</span>
                    </div>
                    {allTags.map(tag => {
                        const tagKey = tag === 'ALL' ? '' : tag;
                        let count = 0;
                        if (tag === 'ALL') count = agents.length;
                        else if (tag === 'ONLINE') count = agents?.filter(a => a.status === 1).length;
                        else if (tag === 'OFFLINE') count = agents?.filter(a => a.status !== 1).length;
                        else count = agents?.filter(a => a.tags?.map(t => t.toUpperCase()).includes(tag)).length;

                        if (count === 0 && tag !== 'ALL') return null;

                        return (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tagKey)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-xs font-bold font-mono tracking-wider transition-all border cursor-pointer uppercase",
                                    selectedTag === tagKey
                                        ? 'bg-gray-100 dark:bg-cyan-500 dark:text-white border-gray-600 dark:border-cyan-600 shadow-md'
                                        : 'bg-transparent text-slate-600 dark:text-cyan-500 border-slate-200 dark:border-cyan-900/30 hover:bg-gray-100 hover:border-cyan-900/30 dark:hover:text-cyan-500 dark:hover:border-cyan-500'
                                )}
                            >
                                {tag} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 服务器列表 */}
            {displayAgents.length === 0 ? (
                <ServerListEmpty
                    title={selectedTag ? '没有匹配的服务器' : '暂无在线服务器'}
                    description={selectedTag ? `标签 "${selectedTag}" 下暂无服务器` : '当前没有任何探针在线，请稍后再试。'}
                />
            ) : (
                <>
                    {/* 桌面端表格布局 */}
                    <div
                        className="hidden md:block bg-white/80 dark:bg-[#0a0b10]/90 border border-slate-200 dark:border-cyan-900/50 rounded-xl overflow-hidden shadow-sm dark:shadow-2xl backdrop-blur-md">
                        <table className="w-full text-left border-collapse">
                            <thead>
                            <tr className="bg-slate-50 dark:bg-black/40 text-xs font-mono uppercase tracking-widest text-slate-400 dark:text-cyan-500 border-b border-slate-200 dark:border-cyan-900/50 font-bold">
                                <th className="p-5 font-bold w-[250px]">Identity</th>
                                <th className="p-5 font-bold">Telemetry</th>
                                <th className="p-5 font-bold w-[220px]">I/O Rate</th>
                                <th className="p-5 font-bold w-[240px]">Traffic</th>
                                <th className="p-5 font-bold w-[150px]">Network</th>
                                <th className="p-5 font-bold w-[200px]">Meta / Tags</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-cyan-900/50">
                            {displayAgents.map(server => {
                                const isOnline = server.status === 1;
                                const cpuUsage = server.metrics?.cpu?.usagePercent ?? 0;
                                const memoryUsage = server.metrics?.memory?.usagePercent ?? 0;
                                const memoryTotal = server.metrics?.memory?.total ?? 0;
                                const memoryUsed = server.metrics?.memory?.used ?? 0;
                                const diskUsage = calculateDiskUsage(server.metrics);
                                const diskTotal = server.metrics?.disk?.total ?? 0;
                                const diskUsed = server.metrics?.disk?.used ?? 0;
                                const {upload, download} = calculateNetworkSpeed(server.metrics);
                                const temperatures = getTemperatures(server.metrics);
                                const netConn = server.metrics?.networkConnection;
                                const traffic = server.trafficStats;
                                const trafficUsagePercent = traffic?.enabled && traffic.limit > 0
                                    ? Math.min(100, (traffic.used / traffic.limit) * 100)
                                    : 0;

                                return (
                                    <tr
                                        key={server.id}
                                        tabIndex={0}
                                        onClick={() => handleNavigate(server.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handleNavigate(server.id);
                                            }
                                        }}
                                        className="group hover:bg-gray-500/5 dark:hover:bg-cyan-500/5 transition-colors cursor-pointer"
                                    >
                                        {/* Identity */}
                                        <td className="p-4 align-top">
                                            <div className="flex items-center gap-4">
                                                <div className="space-y-1">
                                                    <div
                                                        className={cn(
                                                            'font-bold text-slate-800 dark:text-cyan-100 font-mono text-sm transition-colors',
                                                            isExpired(server.expireTime) ? 'text-red-600 dark:text-red-400' : ''
                                                        )}>
                                                        {server.name}
                                                    </div>
                                                    <div
                                                        className="flex items-center gap-2 text-xs text-gray-600 dark:text-cyan-400 mt-1 font-mono uppercase">
                                                        <span>{server.os}</span>
                                                        <span className="w-px h-2 bg-gray-400 dark:bg-cyan-800"></span>
                                                        <span>{server.arch}</span>
                                                    </div>
                                                    {isOnline && server.metrics?.host && (
                                                        <div className="flex items-center gap-3 text-xs font-mono mt-1">
                                                            <div
                                                                className="flex items-center gap-1 text-gray-500 dark:text-cyan-600">
                                                                <Clock className="w-3 h-3"/>
                                                                <span>{formatUptime(server.metrics.host.uptime)}</span>
                                                            </div>
                                                            <div
                                                                className="flex items-center gap-1 text-gray-500 dark:text-cyan-600">
                                                                <Activity className="w-3 h-3"/>
                                                                <span>{server.metrics.host.procs} 进程</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Resources */}
                                        <td className="p-4 align-top">
                                            {isOnline ? (
                                                <div className="flex flex-col justify-center h-full gap-0.5">
                                                    <CompactResourceBar
                                                        value={cpuUsage}
                                                        label="CPU"
                                                        icon={Cpu}
                                                        subtext={server.metrics?.cpu ? `${server.metrics.cpu.modelName} (${server.metrics.cpu.physicalCores}核)` : undefined}
                                                        color="bg-blue-500"
                                                    />
                                                    <CompactResourceBar
                                                        value={memoryUsage}
                                                        label="RAM"
                                                        icon={MemoryStick}
                                                        subtext={`${formatBytes(memoryUsed, 1)}/${formatBytes(memoryTotal, 1)}`}
                                                        color="bg-purple-500"
                                                    />
                                                    <CompactResourceBar
                                                        value={diskUsage}
                                                        label="DSK"
                                                        icon={HardDrive}
                                                        subtext={`${formatBytes(diskUsed, 1)}/${formatBytes(diskTotal, 1)}`}
                                                        color="bg-emerald-500"
                                                    />
                                                    {temperatures.length > 0 && (
                                                        <div
                                                            className="flex items-center gap-2 mt-1 text-xs font-mono flex-wrap">
                                                            <Thermometer className="w-3 h-3 text-orange-400"/>
                                                            {temperatures.map((temp, index) => (
                                                                <span key={index} className="flex items-center gap-1">
                                                                    <span
                                                                        className="text-orange-400">{temp.temperature?.toFixed(1)}°C</span>
                                                                    <span
                                                                        className="text-gray-500 dark:text-cyan-500">{temp.type}</span>
                                                                    {index < temperatures.length - 1 &&
                                                                        <span className="text-cyan-900">|</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-xs text-rose-500 font-mono flex items-center gap-2 py-4">
                                                    <AlertTriangle className="w-4 h-4"/>
                                                    <span>CONNECTION_LOST // RECONNECTING...</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Network */}
                                        <td className="p-4 font-mono text-xs align-top">
                                            <div className="flex flex-col gap-1.5 mb-1.5">
                                                <span
                                                    className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400/80">
                                                    <ArrowDown className="w-3 h-3"/>
                                                    <span>{formatSpeed(download)}</span>
                                                </span>
                                                <span
                                                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400/80">
                                                    <ArrowUp className="w-3 h-3"/>
                                                    <span>{formatSpeed(upload)}</span>
                                                </span>
                                            </div>
                                        </td>

                                        {/* Traffic */}
                                        <td className="p-4 font-mono text-xs align-top">
                                            {traffic?.enabled ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                                        {traffic.type === 'recv' ? '进站' : traffic.type === 'send' ? '出站' : '全部'}流量
                                                    </div>
                                                    {traffic.limit > 0 ? (
                                                        <>
                                                            <div className="flex items-baseline justify-between">
                                                                <span className="text-xs text-gray-600 dark:text-cyan-500 font-mono">
                                                                    {formatBytes(traffic.used, 1)} / {formatBytes(traffic.limit, 1)}
                                                                </span>
                                                                <span className="text-xs font-bold text-gray-700 dark:text-cyan-400 font-mono">
                                                                    {trafficUsagePercent.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-200 dark:bg-cyan-900/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full transition-all ${getTrafficProgressColor(trafficUsagePercent)}`}
                                                                    style={{width: `${trafficUsagePercent}%`}}
                                                                />
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                                                重置日期: 每月 {traffic.resetDay} 号
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="text-xs text-gray-500 dark:text-cyan-600 font-mono">
                                                            已使用: {formatBytes(traffic.used, 1)}
                                                            <div className="text-xs text-gray-400 dark:text-cyan-700 mt-1">仅统计模式</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-gray-600 dark:text-cyan-500">-</div>
                                            )}
                                        </td>

                                        {/* Connections */}
                                        <td className="p-4 font-mono text-xs align-top">
                                            {isOnline && netConn ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Network
                                                            className="w-3 h-3 text-emerald-600 dark:text-emerald-400"/>
                                                        <span
                                                            className="text-emerald-600 dark:text-emerald-400">{netConn.established || 0}</span>
                                                        <span
                                                            className="text-gray-600 dark:text-cyan-500">ESTABLISHED</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Network className="w-3 h-3 text-blue-600 dark:text-blue-400"/>
                                                        <span
                                                            className="text-blue-600 dark:text-blue-400">{netConn.listen || 0}</span>
                                                        <span className="text-gray-600 dark:text-cyan-500">LISTEN</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Network className="w-3 h-3 text-rose-600 dark:text-rose-400"/>
                                                        <span
                                                            className="text-rose-600 dark:text-rose-400">{netConn.closeWait || 0}</span>
                                                        <span
                                                            className="text-gray-600 dark:text-cyan-500">CLOSE_WAIT</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-600 dark:text-cyan-500">-</div>
                                            )}
                                        </td>

                                        {/* Meta */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-1 flex-wrap">
                                                    {server.tags && server.tags.length > 0 && server.tags.map(tag => (
                                                        <span key={tag}
                                                              className="px-1.5 py-0.5 bg-gray-100 dark:bg-cyan-900/40 text-gray-700 dark:text-cyan-500 border border-gray-300 dark:border-cyan-700/50 text-xs font-mono rounded-sm">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div
                                                    className={cn(
                                                        `text-xs font-mono flex items-center gap-1 text-gray-600 dark:text-cyan-500`,
                                                        // 剩余时间小于 30 天时显示为红色
                                                        isExpired(server.expireTime) ? 'text-red-600 dark:text-red-400' : ''
                                                    )}>

                                                    {server.expireTime > 0 &&
                                                        <div className={'flex items-center gap-1'}>
                                                            <div>Expired: {new Date(server.expireTime).toLocaleDateString('zh-CN')}</div>
                                                        </div>
                                                    }
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                    {/* 移动端卡片布局 */}
                    <div className="md:hidden flex flex-col gap-2">
                        {displayAgents.map(server => (
                            <ServerCard
                                key={server.id}
                                server={server}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ServerList;
