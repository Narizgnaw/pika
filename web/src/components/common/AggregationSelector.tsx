import type {AggregationOptionValue} from '@/constants/metrics';
import {cn} from '@/lib/utils';

export interface AggregationOption {
    label: string;
    value: AggregationOptionValue;
}

interface AggregationSelectorProps {
    value: AggregationOptionValue;
    onChange: (value: AggregationOptionValue) => void;
    options: readonly AggregationOption[];
    variant?: 'light' | 'dark';
}

export const AggregationSelector = ({
                                        value,
                                        onChange,
                                        options,
                                        variant = 'light',
                                    }: AggregationSelectorProps) => {
    const isDark = variant === 'dark';

    return (
        <div className="flex gap-2 bg-slate-100 dark:bg-black/40 p-1 rounded-lg border border-slate-200 dark:border-cyan-900/50">
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-xs font-medium transition-all font-mono cursor-pointer whitespace-nowrap",
                            isActive
                                ? 'bg-gray-200 dark:bg-cyan-500/20 text-gray-800 dark:text-cyan-300 border border-gray-300 dark:border-cyan-500/30'
                                : 'text-gray-600 dark:text-cyan-500 hover:text-gray-800 dark:hover:text-cyan-400 border border-transparent'
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};
