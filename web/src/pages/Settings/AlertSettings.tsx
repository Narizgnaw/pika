import { useEffect } from 'react';
import { App, Button, Form, InputNumber, Switch } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AlertConfig } from '@/api/property';
import { getAlertConfig, saveAlertConfig } from '@/api/property';
import { getErrorMessage } from '@/lib/utils';
import {SettingsActions, SettingsSection, SettingsSwitchRow} from './SettingsSection';

interface RuleDefinition {
    key: string;
    name: string;
    threshold?: {
        label: string;
        min: number;
        max: number;
        tooltip?: string;
    };
    duration?: {
        tooltip?: string;
    };
}

const RULES: RuleDefinition[] = [
    { key: 'cpu', name: 'CPU 使用率', threshold: { label: '阈值 (%)', min: 0, max: 100 }, duration: {} },
    { key: 'memory', name: '内存使用率', threshold: { label: '阈值 (%)', min: 0, max: 100 }, duration: {} },
    { key: 'disk', name: '磁盘使用率', threshold: { label: '阈值 (%)', min: 0, max: 100 }, duration: {} },
    { key: 'network', name: '网速', threshold: { label: '阈值 (MB/s)', min: 0, max: 10000 }, duration: {} },
    {
        key: 'cert',
        name: 'HTTPS 证书',
        threshold: { label: '剩余天数阈值（天）', min: 1, max: 365, tooltip: '当证书剩余天数低于此阈值时触发告警' },
    },
    { key: 'service', name: '服务下线', duration: { tooltip: '服务持续离线多久后触发告警' } },
    { key: 'agentOffline', name: '探针离线', duration: { tooltip: '探针持续离线多久后触发告警' } },
];

const AlertSettings = () => {
    const [form] = Form.useForm();
    const { message: messageApi } = App.useApp();
    const queryClient = useQueryClient();

    // 获取全局告警配置
    const { data: configData, isLoading: configLoading } = useQuery({
        queryKey: ['alertConfig'],
        queryFn: getAlertConfig,
    });

    // 设置表单默认值
    useEffect(() => {
        if (configData) {
            form.setFieldsValue(configData);
        }
    }, [configData, configLoading, form]);

    // 保存 mutation
    const saveMutation = useMutation({
        mutationFn: (config: AlertConfig) => saveAlertConfig(config),
        onSuccess: () => {
            messageApi.success('告警配置保存成功');
            queryClient.invalidateQueries({ queryKey: ['alertConfig'] });
        },
        onError: (error: unknown) => {
            messageApi.error(getErrorMessage(error, '保存配置失败'));
        },
    });

    const handleSubmit = async () => {
        const values = await form.validateFields();
        saveMutation.mutate(values as AlertConfig);
    };

    return (
        <div>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <SettingsSection title="基本信息" divided={false}>
                    <SettingsSwitchRow
                        title="启用告警"
                        description="总开关，关闭后不再产生和发送任何告警通知。"
                    >
                        <Form.Item noStyle name="enabled" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭"/>
                        </Form.Item>
                    </SettingsSwitchRow>
                    <SettingsSwitchRow
                        title="IP 打码"
                        description="开启后，通知消息中的 IP 地址将显示为 192.168.*.* 格式。"
                    >
                        <Form.Item noStyle name="maskIP" valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭"/>
                        </Form.Item>
                    </SettingsSwitchRow>
                </SettingsSection>

                <SettingsSection title="通知开关" description="控制哪些事件会通过通知渠道推送。">
                    <SettingsSwitchRow title="流量告警通知">
                        <Form.Item noStyle name={['notifications', 'trafficEnabled']} valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭"/>
                        </Form.Item>
                    </SettingsSwitchRow>
                    <SettingsSwitchRow title="SSH 登录成功通知">
                        <Form.Item noStyle name={['notifications', 'sshLoginSuccessEnabled']} valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭"/>
                        </Form.Item>
                    </SettingsSwitchRow>
                    <SettingsSwitchRow title="防篡改事件通知">
                        <Form.Item noStyle name={['notifications', 'tamperEventEnabled']} valuePropName="checked">
                            <Switch checkedChildren="开启" unCheckedChildren="关闭"/>
                        </Form.Item>
                    </SettingsSwitchRow>
                </SettingsSection>

                <SettingsSection title="告警规则" description="开启规则后，满足阈值条件并持续指定时间才会触发告警。">
                    <div>
                        {RULES.map((rule) => (
                            <Form.Item key={rule.key} noStyle shouldUpdate>
                                {({ getFieldValue }) => {
                                    const enabled = getFieldValue(['rules', `${rule.key}Enabled`]);
                                    return (
                                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-[#e8ebf0] py-4 first:border-t-0 first:pt-0 dark:border-[#272b33]">
                                            <div className="flex items-center gap-3">
                                                <Form.Item
                                                    noStyle
                                                    name={['rules', `${rule.key}Enabled`]}
                                                    valuePropName="checked"
                                                >
                                                    <Switch size="small"/>
                                                </Form.Item>
                                                <span className="text-[13px] font-medium text-[#1f2329] dark:text-[#e6e8ec]">
                                                    {rule.name}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                                                {rule.threshold && (
                                                    <Form.Item
                                                        label={rule.threshold.label}
                                                        name={['rules', `${rule.key}Threshold`]}
                                                        tooltip={rule.threshold.tooltip}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        <InputNumber
                                                            min={rule.threshold.min}
                                                            max={rule.threshold.max}
                                                            disabled={!enabled}
                                                        />
                                                    </Form.Item>
                                                )}
                                                {rule.duration && (
                                                    <Form.Item
                                                        label="持续时间（秒）"
                                                        name={['rules', `${rule.key}Duration`]}
                                                        tooltip={rule.duration.tooltip}
                                                        style={{ marginBottom: 0 }}
                                                    >
                                                        <InputNumber min={1} max={3600} disabled={!enabled}/>
                                                    </Form.Item>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }}
                            </Form.Item>
                        ))}
                    </div>
                </SettingsSection>

                <SettingsActions>
                    <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                        保存配置
                    </Button>
                </SettingsActions>
            </Form>
        </div>
    );
};

export default AlertSettings;
