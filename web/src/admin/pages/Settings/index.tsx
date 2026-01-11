import {Tabs} from 'antd';
import {Bell, Database, MessageSquare, Settings2} from 'lucide-react';
import AlertSettings from './AlertSettings';
import NotificationChannels from './NotificationChannels';
import SystemConfig from './SystemConfig';
import {PageHeader} from "@admin/components";
import {useSearchParams} from "react-router-dom";

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

    return (
        <div className={'space-y-6'}>
            <PageHeader
                title="系统设置"
                description="CONFIGURATION"
            />
            <Tabs tabPosition={'left'}
                  items={items}
                  activeKey={searchParams.get('tab')}
                  onChange={(key) => {
                      setSearchParams({tab: key});
                  }}
            />
        </div>
    );
};

export default Settings;
