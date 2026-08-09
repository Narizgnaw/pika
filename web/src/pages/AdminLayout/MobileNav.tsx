import {useLocation, useNavigate} from 'react-router-dom';
import {menuItems} from './menu';
import {cn} from '@/lib/utils';

/** 移动端底部导航。菜单可横向滚动，避免固定列数截断。 */
export const AdminMobileNav = () => {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[300] border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#141414]/95 backdrop-blur lg:hidden">
            <div className="flex overflow-x-auto thin-scrollbar">
                {menuItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'flex min-w-[64px] flex-col items-center justify-center gap-1 py-2 text-xs font-medium',
                                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400',
                            )}
                        >
                            <span className={cn(
                                'rounded-full p-2',
                                isActive ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-current',
                            )}>
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
