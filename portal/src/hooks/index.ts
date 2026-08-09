import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {pika} from '../api';
import type {Agent, LatestMetrics, MetricsAggregation, MetricsParams, MetricsResponse} from '../types';

interface UseMetricsQueryOptions {
    agentId: string;
    type: MetricsParams['type'];
    range?: string;
    start?: number;
    end?: number;
    interfaceName?: string;
    aggregation?: MetricsAggregation;
    refetchIntervalMs?: number;
}

export const useAgentQuery = (agentId?: string) => {
    return useQuery({
        queryKey: ['agent', agentId],
        queryFn: () => pika.getAgent<Agent>(agentId!),
        enabled: !!agentId,
        staleTime: 60000,
    });
};

export const useLatestMetricsQuery = (agentId?: string, intervalMs: number = 5000) => {
    return useQuery({
        queryKey: ['agent', agentId, 'metrics', 'latest'],
        queryFn: () => pika.getLatestMetrics<LatestMetrics>(agentId!),
        enabled: !!agentId,
        refetchInterval: intervalMs > 0 ? intervalMs : false,
    });
};

export const useMetricsQuery = ({agentId, type, range, start, end, interfaceName, aggregation, refetchIntervalMs}: UseMetricsQueryOptions) => {
    return useQuery({
        queryKey: ['agent', agentId, 'metrics', type, range, start, end, interfaceName, aggregation],
        queryFn: () =>
            pika.getMetrics<MetricsResponse>(agentId, {
                type,
                range: start !== undefined && end !== undefined ? undefined : range,
                start,
                end,
                interface: interfaceName,
                aggregation,
            }),
        enabled: !!agentId,
        refetchInterval: refetchIntervalMs && refetchIntervalMs > 0 ? refetchIntervalMs : false,
    });
};

export const useNetworkInterfacesQuery = (agentId?: string) => {
    return useQuery({
        queryKey: ['agent', agentId, 'network-interfaces'],
        queryFn: () => pika.getNetworkInterfaces(agentId!),
        enabled: !!agentId,
    });
};

export function useLiveBuffer<T extends { timestamp: number }>(
    initial: T[],
    isLive: boolean,
    livePoint: T | null,
    windowMs: number,
    resetKey?: unknown,
): T[] {
    const [buffer, setBuffer] = useState<T[]>([]);
    const lastTsRef = useRef<number>(0);
    const seededRef = useRef<boolean>(false);

    useEffect(() => {
        seededRef.current = false;
        lastTsRef.current = 0;
        setBuffer([]);
    }, [isLive, resetKey]);

    useEffect(() => {
        if (!isLive) return;
        if (seededRef.current) return;
        if (!initial || initial.length === 0) return;
        seededRef.current = true;

        const initLastTs = initial[initial.length - 1].timestamp;
        setBuffer(prev => {
            if (prev.length === 0) {
                return initial.slice();
            }
            const earliestExisting = prev[0].timestamp;
            const olderHistory = initial.filter(p => p.timestamp < earliestExisting);
            return olderHistory.length > 0 ? [...olderHistory, ...prev] : prev;
        });
        if (initLastTs > lastTsRef.current) {
            lastTsRef.current = initLastTs;
        }
    }, [isLive, initial, resetKey]);

    useEffect(() => {
        if (!isLive || !livePoint) return;
        const ts = livePoint.timestamp;
        if (!Number.isFinite(ts) || ts <= 0) return;
        if (ts <= lastTsRef.current) return;
        lastTsRef.current = ts;

        setBuffer(prev => {
            const next = prev.length === 0 ? [livePoint] : [...prev, livePoint];
            const cutoff = ts - windowMs;
            let drop = 0;
            while (drop < next.length && next[drop].timestamp < cutoff) drop++;
            return drop > 0 ? next.slice(drop) : next;
        });
    }, [livePoint, isLive, windowMs]);

    return isLive ? buffer : initial;
}

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        mql.addEventListener('change', onChange);
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener('change', onChange);
    }, []);
    return !!isMobile;
}
