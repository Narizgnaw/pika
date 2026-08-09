import {type RefObject} from 'react';
import {useNavigate} from 'react-router-dom';
import type {MenuProps} from 'antd';
import {App as AntApp, Avatar, Button, Dropdown, Space} from 'antd';
import {BookOpen, Eye, LogOut, Moon, Sun, User as UserIcon} from 'lucide-react';
import {logout} from '@/api/auth';
import {useRuntimeConfig} from '@/api/runtime';
import type {User} from '@/types';

interface HeaderProps {
    userInfo: User | null;
    appliedTheme: 'light' | 'dark';
    themeButtonRef: RefObject<HTMLButtonElement | null>;
    onToggleTheme: () => void;
}

export const AdminHeader = ({userInfo, appliedTheme, themeButtonRef, onToggleTheme}: HeaderProps) => {
    const navigate = useNavigate();
    const {message: messageApi, modal} = AntApp.useApp();
    const {data: runtime} = useRuntimeConfig();

    const handleLogout = () => {
        modal.confirm({
            title: '确认退出',
            content: '确定要退出登录吗？',
            onOk: async () => {
                try {
                    await logout();
                } finally {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userInfo');
                    messageApi.success('已退出登录');
                    navigate('/');
                }
            },
        });
    };

    const userMenuItems: MenuProps['items'] = [
        {key: 'logout', icon: <LogOut size={16} strokeWidth={2}/>, label: '退出登录', onClick: handleLogout},
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-[300] h-14 border-b border-white/20 dark:border-white/10 bg-[#060b16]/95 dark:bg-[#141414]/95 backdrop-blur">
            <div className="flex h-full items-center justify-between px-4">
                <div className="flex items-center gap-3 text-white">
                    <div className="flex items-center justify-center">
                        <img
                            src="/api/logo"
                            alt="Logo"
                            className="h-10 w-10 object-contain rounded-md"
                            onError={(e) => { e.currentTarget.src = '/logo.png'; }}
                        />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{runtime?.system.nameZh}</p>
                        <p className="text-sm font-semibold">控制台</p>
                    </div>
                </div>

                <Space size={8} className="flex h-full items-center">
                    <Button
                        type="text"
                        icon={<Eye className="h-4 w-4" strokeWidth={2}/>}
                        onClick={() => window.open('/', '_blank')}
                        className="hidden !h-9 !items-center !rounded-full !px-3 !text-xs !text-white/80 hover:!bg-white/10 sm:!inline-flex"
                    >
                        公共页面
                    </Button>
                    <Button
                        type="text"
                        icon={<BookOpen className="h-4 w-4" strokeWidth={2}/>}
                        onClick={() => navigate('/admin/agents-install/one-click')}
                        className="!h-9 !items-center !rounded-full !px-3 !text-xs !text-white hover:!bg-blue-500/10"
                    >
                        部署指南
                    </Button>

                    <button
                        ref={themeButtonRef}
                        type="button"
                        onClick={onToggleTheme}
                        className="inline-flex h-9 items-center rounded-full p-2 text-white/80 hover:bg-white/10 transition-all"
                        title={appliedTheme === 'dark' ? '切换到浅色模式' : '切换到暗黑模式'}
                    >
                        {appliedTheme === 'dark' ? <Sun className="h-4 w-4" strokeWidth={2}/> : <Moon className="h-4 w-4" strokeWidth={2}/>}
                    </button>

                    <Dropdown menu={{items: userMenuItems}} placement="bottomRight" trigger={['click']}>
                        <button
                            type="button"
                            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-left text-white transition-colors hover:border-white/40"
                        >
                            <Avatar size={24} icon={<UserIcon className="h-3.5 w-3.5" strokeWidth={2}/>} className="!bg-white/20"/>
                            <span className="text-xs font-medium">{userInfo?.username || '访客'}</span>
                        </button>
                    </Dropdown>
                </Space>
            </div>
        </header>
    );
};
