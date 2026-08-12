import {useEffect, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import type {TabsProps} from 'antd';
import {Alert, Spin, Tabs, Tag} from 'antd';
import {Activity, ArrowLeft, FileWarning, Lock, Shield, TrendingUp} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {getAgentForAdmin} from '@/api/agent.ts';
import AgentBasicInfo from './AgentBasicInfo';
import AgentAudit from './AgentAudit';
import TamperProtection from './TamperProtection';
import SSHLoginMonitor from './SSHLoginMonitor';
import TrafficStats from './TrafficStats';
import {PageHeader} from '@/components/PageHeader';
import {PagePanel} from '@/components/PagePanel';

const AgentDetail = () => {
    const {id} = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'info');

    // 获取探针基本信息（用于显示头部卡片）
    const {data: agent, isLoading} = useQuery({
        queryKey: ['admin', 'agent', id],
        queryFn: async () => {
            if (!id) throw new Error('Agent ID is required');
            const response = await getAgentForAdmin(id);
            return response.data;
        },
        enabled: !!id,
    });

    useEffect(() => {
        // 同步 activeTab 到 URL
        const nextParams = new URLSearchParams(searchParams);
        if (nextParams.get('tab') === activeTab) {
            return;
        }
        nextParams.set('tab', activeTab);
        setSearchParams(nextParams);
    }, [activeTab, searchParams, setSearchParams]);

    if (isLoading) {
        return (
            <div className="text-center py-24">
                <Spin/>
            </div>
        );
    }

    if (!agent || !id) {
        return (
            <div className="text-center py-24">
                <Alert
                    title="未找到探针"
                    description="该探针不存在或已被删除"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    // Tab 项配置
    const tabItems: TabsProps['items'] = [
        {
            key: 'info',
            label: (
                <div className="flex items-center gap-2 text-sm">
                    <Activity size={16}/>
                    <div>基本信息</div>
                </div>
            ),
            children: <AgentBasicInfo agentId={id}/>,
        },
        {
            key: 'traffic',
            label: (
                <div className="flex items-center gap-2 text-sm">
                    <TrendingUp size={16}/>
                    <div>流量统计</div>
                </div>
            ),
            children: <TrafficStats agentId={id}/>,
        },
        {
            key: 'audit',
            label: (
                <div className="flex items-center gap-2 text-sm">
                    <Shield size={16}/>
                    <div>安全审计</div>
                </div>
            ),
            children: <AgentAudit agentId={id}/>,
        },
        {
            key: 'tamper',
            label: (
                <div className="flex items-center gap-2 text-sm">
                    <FileWarning size={16}/>
                    <div>防篡改保护</div>
                </div>
            ),
            children: agent.os.toLowerCase().includes('linux') ? (
                <TamperProtection agentId={id}/>
            ) : (
                <Alert
                    title="功能限制"
                    description="防篡改保护功能仅支持 Linux 系统。当前系统为 Windows 或其他系统，无法使用此功能。"
                    type="warning"
                    showIcon
                />
            ),
        },
        {
            key: 'ssh-login',
            label: (
                <div className="flex items-center gap-2 text-sm">
                    <Lock size={16}/>
                    <div>SSH 登录监控</div>
                </div>
            ),
            children: agent.os.toLowerCase().includes('linux') ? (
                <SSHLoginMonitor agentId={id}/>
            ) : (
                <Alert
                    title="功能限制"
                    description="SSH 登录监控功能仅支持 Linux 系统。当前系统为 Windows 或其他系统，无法使用此功能。"
                    type="warning"
                    showIcon
                />
            ),
        },
    ];

    return (
        <div className="space-y-4 lg:space-y-6">
            <PageHeader
                title={agent.name || agent.hostname}
                actions={[{
                    key: 'back',
                    label: '返回列表',
                    icon: <ArrowLeft size={16}/>,
                    onClick: () => navigate('/admin/agents'),
                }]}
            />

            <PagePanel>
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <Activity size={21}/>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">当前连接状态</div>
                        <div className="mt-1">
                            {agent.status === 1 ? <Tag color="success">在线</Tag> : <Tag color="error">离线</Tag>}
                        </div>
                    </div>
                </div>
            </PagePanel>

            {/* Tabs 内容 */}
            <PagePanel>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                />
            </PagePanel>
        </div>
    );
};

export default AgentDetail;
