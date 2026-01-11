import {useRef, useState} from 'react';
import type {ActionType, ProColumns} from '@ant-design/pro-components';
import {ProTable} from '@ant-design/pro-components';
import {App, Divider, Select, Space, Tag} from 'antd';
import {Trash2} from 'lucide-react';
import {clearAlertRecords, getAlertRecords} from '@/api/alert.ts';
import type {AlertRecord} from '@/types';
import dayjs from 'dayjs';
import {getErrorMessage} from '@/lib/utils';
import {PageHeader} from '@admin/components';
import {getAgentPaging} from '@/api/agent.ts';
import {useQuery} from '@tanstack/react-query';

const AlertRecordList = () => {
    const {message: messageApi, modal} = App.useApp();
    const actionRef = useRef<ActionType>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');

    // 使用 react-query 获取探针列表
    const {data: agentsData} = useQuery({
        queryKey: ['agents-for-alert-filter'],
        queryFn: async () => {
            const response = await getAgentPaging(1, 1000);
            return response.data;
        },
    });

    // 告警类型中文映射
    const alertTypeMap: Record<string, string> = {
        cpu: 'CPU使用率',
        memory: '内存使用率',
        disk: '磁盘使用率',
        network: '网速',
        traffic: '流量',
        cert: 'HTTPS证书',
        service: '服务下线',
        agent_offline: '探针离线',
    };

    // 告警级别映射
    const getLevelTag = (level: string) => {
        const config = {
            info: {color: 'blue', text: '信息'},
            warning: {color: 'orange', text: '警告'},
            critical: {color: 'red', text: '严重'},
        };
        const levelConfig = config[level as keyof typeof config] || {color: 'default', text: level};
        return <Tag color={levelConfig.color}>{levelConfig.text}</Tag>;
    };

    // 状态映射
    const getStatusTag = (status: string) => {
        const config = {
            firing: {color: 'red', text: '告警中'},
            resolved: {color: 'green', text: '已恢复'},
            notice: {color: 'blue', text: '通知'},
        };
        const statusConfig = config[status as keyof typeof config] || {color: 'default', text: status};
        return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
    };

    // 格式化持续时间
    const formatDuration = (firedAt: number, resolvedAt: number | null, status: string) => {
        // 如果告警还在进行中，返回 "-"
        if (status === 'firing' || !resolvedAt || resolvedAt <= firedAt) {
            return '-';
        }

        const durationMs = resolvedAt - firedAt;
        const durationSec = Math.floor(durationMs / 1000);

        if (durationSec < 60) {
            return `${durationSec}秒`;
        }

        if (durationSec < 3600) {
            const minutes = Math.floor(durationSec / 60);
            const seconds = durationSec % 60;
            return `${minutes}分${seconds}秒`;
        }

        const hours = Math.floor(durationSec / 3600);
        const minutes = Math.floor((durationSec % 3600) / 60);
        const seconds = durationSec % 60;
        return `${hours}时${minutes}分${seconds}秒`;
    };

    // 计算探针选项
    const agentOptions = agentsData?.items?.map((agent) => ({
        label: agent.name || agent.id,
        value: agent.id,
    })) || [];

    const handleClear = () => {
        modal.confirm({
            title: '确认清空',
            content: selectedAgentId
                ? '确定要清空该探针的所有告警记录吗？'
                : '确定要清空所有告警记录吗？此操作不可恢复！',
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await clearAlertRecords(selectedAgentId || undefined);
                    messageApi.success('清空成功');
                    actionRef.current?.reload();
                } catch (error: unknown) {
                    messageApi.error(getErrorMessage(error, '清空失败'));
                }
            },
        });
    };

    const columns: ProColumns<AlertRecord>[] = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
            search: false,
        },
        {
            title: '探针',
            dataIndex: 'agentName',
            width: 200,
            ellipsis: true,
            search: false,
        },
        {
            title: '告警类型',
            dataIndex: 'alertType',
            width: 120,
            render: (_, record) => alertTypeMap[record.alertType] || record.alertType,
            search: false,
        },
        {
            title: '告警消息',
            dataIndex: 'message',
            ellipsis: true,
            search: false,
        },
        {
            title: '阈值',
            dataIndex: 'threshold',
            width: 100,
            render: (_, record) => {
                if (record.alertType === 'network') {
                    return `${record.threshold.toFixed(2)} MB/s`;
                }
                if (record.alertType === 'cert') {
                    return `${record.threshold.toFixed(0)} 天`;
                }
                if (record.alertType === 'service' || record.alertType === 'agent_offline') {
                    return `${record.threshold.toFixed(0)} 秒`;
                }
                return `${record.threshold.toFixed(2)}%`;
            },
            search: false,
        },
        {
            title: '实际值',
            dataIndex: 'actualValue',
            width: 100,
            render: (_, record) => {
                if (record.alertType === 'network') {
                    return `${record.actualValue.toFixed(2)} MB/s`;
                }
                if (record.alertType === 'cert') {
                    return `${record.actualValue.toFixed(0)} 天`;
                }
                if (record.alertType === 'service' || record.alertType === 'agent_offline') {
                    return `${record.actualValue.toFixed(0)} 秒`;
                }
                return `${record.actualValue.toFixed(2)}%`;
            },
            search: false,
        },
        {
            title: '告警级别',
            dataIndex: 'level',
            width: 100,
            render: (_, record) => getLevelTag(record.level),
            search: false,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (_, record) => getStatusTag(record.status),
            search: false,
        },
        {
            title: '触发时间',
            dataIndex: 'firedAt',
            width: 180,
            render: (_, record) => dayjs(record.firedAt).format('YYYY-MM-DD HH:mm:ss'),
            search: false,
            sorter: true,
        },
        {
            title: '恢复时间',
            dataIndex: 'resolvedAt',
            width: 180,
            render: (_, record) =>
                record.resolvedAt ? dayjs(record.resolvedAt).format('YYYY-MM-DD HH:mm:ss') : '-',
            search: false,
        },
        {
            title: '持续时间',
            dataIndex: 'duration',
            width: 130,
            render: (_, record) => formatDuration(record.firedAt, record.resolvedAt, record.status),
            search: false,
        },
    ];

    return (
        <div>
            <PageHeader
                title="告警记录"
                description="查看和管理系统的告警记录"
                actions={[
                    {
                        key: 'clear',
                        label: '清空记录',
                        icon: <Trash2 className="h-4 w-4"/>,
                        type: 'primary',
                        danger: true,
                        onClick: handleClear,
                    },
                ]}
            />

            <Divider/>

            <ProTable<AlertRecord>
                columns={columns}
                actionRef={actionRef}
                rowKey="id"
                request={async (params, sort) => {
                    try {
                        const {pageSize = 20, current = 1} = params;

                        const result = await getAlertRecords(
                            current,
                            pageSize,
                            selectedAgentId || undefined,
                        );

                        return {
                            data: result.items || [],
                            success: true,
                            total: result.total || 0,
                        };
                    } catch (error) {
                        messageApi.error(getErrorMessage(error, '获取告警记录失败'));
                        return {
                            data: [],
                            success: false,
                            total: 0,
                        };
                    }
                }}
                search={false}
                toolbar={{
                    actions: [
                        <Space key="toolbar">
                            <Select
                                placeholder="选择探针"
                                allowClear
                                showSearch
                                style={{width: 200}}
                                value={selectedAgentId || undefined}
                                onChange={(value) => {
                                    setSelectedAgentId(value || '');
                                    actionRef.current?.reload();
                                }}
                                filterOption={(input, option) =>
                                    (option?.label?.toString() ?? '')
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={agentOptions}
                            />
                        </Space>,
                    ],
                }}
                pagination={{
                    defaultPageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                }}
            />
        </div>
    );
};

export default AlertRecordList;
