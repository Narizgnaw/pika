import {del, get} from './request';
import type {AlertRecord} from '@/types';

// 注意：告警配置相关 API 已迁移到 property.ts 中
// 使用 getAlertConfig() 和 saveAlertConfig() 从 '@/api/property' 导入

// 获取告警记录列表
export const getAlertRecords = async (
    pageIndex: number = 1,
    pageSize: number = 20,
    agentId?: string,
): Promise<{
    items: AlertRecord[];
    total: number;
}> => {
    const params = new URLSearchParams();
    params.append('pageIndex', pageIndex.toString());
    params.append('pageSize', pageSize.toString());
    params.set('sortOrder', 'desc');
    params.set('sortField', 'fired_at');
    if (agentId) {
        params.append('agentId', agentId);
    }

    const response = await get<{
        items: AlertRecord[];
        total: number;
    }>(`/admin/alert-records?${params.toString()}`);
    return response.data;
};

// 清空告警记录
export const clearAlertRecords = async (agentId?: string): Promise<void> => {
    let url = '/admin/alert-records';
    if (agentId) url += `?agentId=${agentId}`;
    await del(url);
};
