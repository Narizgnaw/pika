import {Outlet} from 'react-router-dom';
import PublicHeader from '@portal/components/PublicHeader';
import PublicFooter from '@portal/components/PublicFooter';
import {ThemeProvider} from '../contexts/ThemeContext';

const globalStyles = `
    /* 1. 定义变量：默认亮色模式 */
:root {
    --bg-color: #f0f2f5;
    --sb-track-color: #e5e7eb;
    --sb-thumb-color: #9ca3af;
    --sb-thumb-hover: #6b7280;
    --sb-thumb-border: #d1d5db;
    --sb-corner: #f0f2f5;
}

/* 2. 定义暗色模式下的变量值 */
/* 只要 html 标签上有 class="dark" 就会生效 */
html.dark {
    --bg-color: #05050a;
    --sb-track-color: #0a0a0f;
    --sb-thumb-color: #1e1e28;
    --sb-thumb-hover: #2a2a38;
    --sb-thumb-border: #2a2a35;
    --sb-corner: #05050a;
}

/* 3. 应用背景色 */
body {
    background-color: var(--bg-color);
    /* 平滑过渡效果，可选 */
    transition: background-color 0.3s ease;
}

/* 4. Webkit 滚动条 (Chrome, Edge, Safari) - 只写一次 */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--sb-track-color);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: var(--sb-thumb-color);
    border-radius: 4px;
    border: 1px solid var(--sb-thumb-border);
}

::-webkit-scrollbar-thumb:hover {
    background: var(--sb-thumb-hover);
}

::-webkit-scrollbar-corner {
    background: var(--sb-corner);
}

/* 5. Firefox 滚动条 - 只写一次 */
html {
    scrollbar-width: thin;
    scrollbar-color: var(--sb-thumb-color) var(--sb-track-color);
    scrollbar-gutter: stable;
}

/* 6. 防止滚动条消失时页面宽度变化 */
body {
    scrollbar-gutter: stable;
}
`;

const PublicLayout = () => {
    return (
        <ThemeProvider>
            <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#05050a] text-slate-800 dark:text-slate-200 flex flex-col relative overflow-x-hidden transition-colors duration-500">
                <style>{globalStyles}</style>
                {/* 背景网格效果 */}
                <div
                    className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
                    style={{
                        backgroundImage: 'linear-gradient(to_right,#cbd5e180_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e180_1px,transparent_1px)',
                        backgroundSize: '30px 30px',
                    }}
                ></div>
                {/* 暗色模式网格 */}
                <div
                    className="fixed inset-0 pointer-events-none z-0 opacity-0 dark:opacity-100 transition-opacity duration-500"
                    style={{
                        backgroundImage: 'linear-gradient(to_right,#4f4f4f1a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f1a_1px,transparent_1px)',
                        backgroundSize: '30px 30px',
                    }}
                ></div>
                {/* 顶部发光效果 */}
                <div
                    className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none z-0 opacity-40 dark:opacity-100 transition-opacity duration-500"
                ></div>

                <PublicHeader/>
                <div className="relative z-10 flex flex-col min-h-screen pt-[81px]">
                    <main className="flex-1">
                        <Outlet/>
                    </main>
                    <PublicFooter/>
                </div>
            </div>
        </ThemeProvider>
    );
};

export default PublicLayout;
