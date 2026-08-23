import type {ReactNode} from 'react';
import {Bell, MessageSquare, Palette, Settings2, Wifi} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import AlertSettings from './AlertSettings';
import NotificationChannels from './NotificationChannels';
import SystemConfig from './SystemConfig';
import PublicIPConfig from './PublicIPConfig';
import ThemeSettings from './ThemeSettings';
import {PageHeader} from '@/components/PageHeader';
import {PagePanel} from '@/components/PagePanel';
import {useSearchParams} from 'react-router-dom';

// 默认 IPv4 API 列表
export const defaultIPv4APIs = [
    'https://myip.ipip.net',
    'https://ddns.oray.com/checkip',
    'https://ip.3322.net',
    'https://4.ipw.cn',
    'https://v4.yinghualuo.cn/bejson',
];

// 默认 IPv6 API 列表
export const defaultIPv6APIs = [
    'https://speed.neu6.edu.cn/getIP.php',
    'https://v6.ident.me',
    'https://6.ipw.cn',
    'https://v6.yinghualuo.cn/bejson',
];

interface SettingsTab {
    key: string;
    label: string;
    icon: LucideIcon;
    content: ReactNode;
}

const settingsTabs: SettingsTab[] = [
    {
        key: 'system',
        label: '系统配置',
        icon: Settings2,
        content: <SystemConfig/>,
    },
    {
        key: 'themes',
        label: '主题管理',
        icon: Palette,
        content: <ThemeSettings/>,
    },
    {
        key: 'channels',
        label: '通知渠道',
        icon: MessageSquare,
        content: <NotificationChannels/>,
    },
    {
        key: 'public-ip',
        label: '公网 IP 采集',
        icon: Wifi,
        content: (
            <PublicIPConfig
                defaultIPv4APIs={defaultIPv4APIs}
                defaultIPv6APIs={defaultIPv6APIs}
            />
        ),
    },
    {
        key: 'alert',
        label: '告警规则',
        icon: Bell,
        content: <AlertSettings/>,
    },
];

const Settings = () => {
    const [searchParams, setSearchParams] = useSearchParams({tab: 'system'});

    const activeKey = settingsTabs.some((tab) => tab.key === searchParams.get('tab'))
        ? searchParams.get('tab')!
        : 'system';
    const activeTab = settingsTabs.find((tab) => tab.key === activeKey) ?? settingsTabs[0];

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <PageHeader title="系统设置"/>

            <div className="grid grid-cols-[208px_minmax(0,1fr)] items-start gap-6 max-md:block">
                <nav
                    className="flex flex-col gap-1 lg:sticky lg:top-[76px] max-md:mb-2 max-md:flex-row max-md:overflow-x-auto max-md:pb-1.5"
                    aria-label="设置分类"
                >
                    {settingsTabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = tab.key === activeKey;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                className={active
                                    ? 'flex min-h-10 w-full cursor-pointer items-center rounded-[7px] border-0 bg-[#eaf2ff] px-2.5 py-2 text-left text-[13px] font-semibold text-[#145dcc] dark:bg-[#1677ff]/15 dark:text-[#75adff] max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap'
                                    : 'flex min-h-10 w-full cursor-pointer items-center rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-[#646a73] hover:bg-[#f5f6f8] hover:text-[#1f2329] dark:text-[#9ba1ab] dark:hover:bg-[#20242c] dark:hover:text-[#e6e8ec] max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap'}
                                onClick={() => setSearchParams({tab: tab.key})}
                                aria-current={active ? 'page' : undefined}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <Icon size={16} className="shrink-0"/>
                                    <span className="truncate">{tab.label}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <PagePanel className="min-w-0">
                    {activeTab.content}
                </PagePanel>
            </div>
        </div>
    );
};

export default Settings;
