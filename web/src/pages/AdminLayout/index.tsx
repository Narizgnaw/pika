import {useEffect, useRef, useState} from 'react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';
import {ConfigProvider, theme} from 'antd';
import {AdminHeader} from './Header';
import {AdminSider} from './Sider';
import {AdminMobileNav} from './MobileNav';
import {useThemeToggle} from './useThemeToggle';
import {HEADER_HEIGHT} from './menu';
import {getServerVersion, type VersionInfo} from '@/api/version';
import type {User} from '@/types';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userInfo, setUserInfo] = useState<User | null>(null);
    const [version, setVersion] = useState<VersionInfo>();
    const themeButtonRef = useRef<HTMLButtonElement>(null);
    const {appliedTheme, toggleTheme} = useThemeToggle(themeButtonRef);

    // 鉴权检查只在挂载时执行一次（不再依赖 location 导致每次路由切换都重查）
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userInfoStr = localStorage.getItem('userInfo');
        if (!token || !userInfoStr) {
            navigate('/admin/login');
            return;
        }
        setUserInfo(JSON.parse(userInfoStr));
        getServerVersion().then((res) => setVersion(res.data)).catch((err) => console.error('获取版本信息失败:', err));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <ConfigProvider theme={{algorithm: appliedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm}}>
            <div className="min-h-screen bg-white dark:bg-[#141414]">
                <AdminHeader
                    userInfo={userInfo}
                    appliedTheme={appliedTheme}
                    themeButtonRef={themeButtonRef}
                    onToggleTheme={toggleTheme}
                />
                <AdminSider version={version}/>
                <div
                    className="flex flex-col bg-white dark:bg-[#141414]"
                    style={{paddingTop: HEADER_HEIGHT, minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`}}
                >
                    <main className="flex-grow bg-white dark:bg-[#141414] pb-20 pt-5 lg:ml-[240px] lg:pb-10">
                        <div className="w-full px-4 pb-4 lg:px-8">
                            <Outlet/>
                        </div>
                    </main>
                </div>
                <AdminMobileNav/>
            </div>
        </ConfigProvider>
    );
};

export default AdminLayout;
