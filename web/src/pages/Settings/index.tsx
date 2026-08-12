import {Bell, MessageSquare, Palette, Settings2, Wifi} from 'lucide-react';
import AlertSettings from './AlertSettings';
import NotificationChannels from './NotificationChannels';
import SystemConfig from './SystemConfig';
import PublicIPConfig from './PublicIPConfig';
import ThemeSettings from './ThemeSettings';
import {useSearchParams} from "react-router-dom";

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

const Settings = () => {

    const [searchParams, setSearchParams] = useSearchParams({tab: 'system'});
    const items = [
        {
            key: 'system',
            label: (
                <span className="flex items-center gap-2">
                    <Settings2 size={16}/>
                    系统配置
                </span>
            ),
            children: <SystemConfig/>,
        },
        {
            key: 'themes',
            label: (
                <span className="flex items-center gap-2">
                    <Palette size={16}/>
                    主题管理
                </span>
            ),
            children: <ThemeSettings/>,
        },
        {
            key: 'channels',
            label: (
                <span className="flex items-center gap-2">
                    <MessageSquare size={16}/>
                    通知渠道
                </span>
            ),
            children: <NotificationChannels/>,
        },
        {
            key: 'public-ip',
            label: (
                <span className="flex items-center gap-2">
                    <Wifi size={16}/>
                    公网 IP 采集
                </span>
            ),
            children: (
                <PublicIPConfig
                    defaultIPv4APIs={defaultIPv4APIs}
                    defaultIPv6APIs={defaultIPv6APIs}
                />
            ),
        },
        {
            key: 'alert',
            label: (
                <span className="flex items-center gap-2">
                    <Bell size={16}/>
                    告警规则
                </span>
            ),
            children: <AlertSettings/>,
        },
    ];

    const activeKey = searchParams.get('tab') || 'system';
    const activeItem = items.find((item) => item.key === activeKey) || items[0];

    return (
        <div className="grid grid-cols-[208px_minmax(0,1fr)] items-start gap-4 max-md:block">
            <nav className="flex flex-col gap-1 rounded-[10px] border border-[#e8ebf0] bg-white p-2 dark:border-[#272b33] dark:bg-[#171a21] max-md:mb-3.5 max-md:flex-row max-md:overflow-x-auto max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:pb-1.5 dark:max-md:bg-transparent" aria-label="设置分类">
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={item.key === activeKey
                            ? 'flex min-h-10 w-full cursor-pointer items-center rounded-[7px] border-0 bg-[#eaf2ff] px-2.5 py-2 text-left text-[13px] font-semibold text-[#145dcc] dark:bg-[#1677ff]/15 dark:text-[#75adff] max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap'
                            : 'flex min-h-10 w-full cursor-pointer items-center rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-[#646a73] hover:bg-[#f5f6f8] hover:text-[#1f2329] dark:text-[#9ba1ab] dark:hover:bg-[#20242c] dark:hover:text-[#e6e8ec] max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap'}
                        onClick={() => setSearchParams({tab: item.key})}
                        aria-current={item.key === activeKey ? 'page' : undefined}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="min-w-0">{activeItem.children}</div>
        </div>
    );
};

export default Settings;
