import {useLocation, useNavigate} from 'react-router-dom';
import {menuItems, SIDEBAR_WIDTH, HEADER_HEIGHT} from './menu';
import {cn} from '@/lib/utils';
import {useRuntimeConfig} from '@/api/runtime';
import type {VersionInfo} from '@/api/version';

export const AdminSider = ({version}: {version?: VersionInfo}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const {data: runtime} = useRuntimeConfig();

    return (
        <aside
            className="fixed left-0 z-[200] hidden h-screen overflow-hidden border-r border-white/60 dark:border-white/10 bg-white/90 dark:bg-[#141414]/90 shadow-sm backdrop-blur lg:block"
            style={{width: SIDEBAR_WIDTH, paddingTop: HEADER_HEIGHT}}
        >
            <div className="flex h-full flex-col">
                <div className="px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500">导航</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-slate-100">管理面板</p>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-1 thin-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    'group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-all cursor-pointer',
                                    isActive
                                        ? 'bg-gradient-to-r from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 shadow-sm'
                                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800',
                                )}
                            >
                                <span className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 shadow-sm',
                                    isActive && 'bg-blue-600 dark:bg-blue-500 text-white',
                                )}>
                                    {item.icon}
                                </span>
                                <span className="truncate font-medium">{item.label}</span>
                                {isActive && <span className="ml-auto text-[10px] uppercase text-blue-500 dark:text-blue-400">当前</span>}
                            </button>
                        );
                    })}
                </nav>

                {version && (
                    <div className="border-t border-gray-100 dark:border-slate-800 px-4 py-4">
                        <div className="rounded-2xl bg-gray-50/90 dark:bg-slate-800/90 p-3 shadow-inner">
                            <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-slate-500">版本信息</p>
                            <div className="mt-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Server: {version.version}</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Agent: {version.agentVersion}</p>
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 uppercase tracking-[0.1em]">{runtime?.system.nameEn}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
