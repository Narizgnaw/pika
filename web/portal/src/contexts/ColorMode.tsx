import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {getRuntimeConfig, resolveColorMode} from '../api';
import type {ColorMode} from '../types';

export type ResolvedColorMode = 'light' | 'dark';

interface ColorModeContextValue {
    colorMode: ColorMode;
    resolvedColorMode: ResolvedColorMode;
    setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export const ColorModeProvider = ({children}: {children: ReactNode}) => {
    const [colorMode, setColorModeState] = useState<ColorMode>(() => {
        const saved = localStorage.getItem('colorMode') || localStorage.getItem('theme');
        if (saved === 'auto') return 'system';
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
        return getRuntimeConfig().system.defaultColorMode;
    });
    const [resolvedColorMode, setResolvedColorMode] = useState<ResolvedColorMode>('dark');

    const setColorMode = (mode: ColorMode) => {
        setColorModeState(mode);
        localStorage.setItem('colorMode', mode);
        localStorage.removeItem('theme');
    };

    useEffect(() => {
        const apply = () => {
            const resolved = resolveColorMode(colorMode);
            setResolvedColorMode(resolved);
            document.documentElement.classList.toggle('dark', resolved === 'dark');
            document.documentElement.dataset.colorMode = resolved;
        };
        apply();
        if (colorMode !== 'system') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, [colorMode]);

    return (
        <ColorModeContext.Provider value={{colorMode, resolvedColorMode, setColorMode}}>
            {children}
        </ColorModeContext.Provider>
    );
};

export const useColorMode = () => {
    const value = useContext(ColorModeContext);
    if (!value) throw new Error('useColorMode must be used within ColorModeProvider');
    return value;
};
