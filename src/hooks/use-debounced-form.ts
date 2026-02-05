import { useState, useCallback, useRef, useEffect } from "react";

interface UseDebouncedFormOptions<T> {
	/** Initial value for the form field */
	initialValue: T;
	/** Callback to execute when value changes (debounced) */
	onChange: (value: T) => void;
	/** Debounce delay in milliseconds (default: 250ms) */
	debounceMs?: number;
	/** Whether to immediately trigger onChange when value is committed (blur/submit) */
	immediateOnCommit?: boolean;
}

interface UseDebouncedFormReturn<T> {
	/** Current value (local state) */
	value: T;
	/** Set value locally and debounce the store update */
	setValue: (value: T) => void;
	/** Commit the current value immediately (e.g., on blur) */
	commit: () => void;
	/** Reset to initial value */
	reset: () => void;
	/** Handler for React onChange events */
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => void;
	/** Whether there are pending debounced changes */
	hasPendingChanges: boolean;
}

/**
 * Hook for managing form field state with debounced updates.
 *
 * This follows the industry standard pattern used by Linear.app and other performance-focused apps:
 * - Local state for immediate typing feedback
 * - Debounced store updates to reduce re-renders
 * - Immediate save on commit (blur/submit)
 *
 * @example
 * ```tsx
 * const { value, handleChange, commit } = useDebouncedForm({
 *   initialValue: task.title,
 *   onChange: (newTitle) => updateTask(task.id, { title: newTitle }),
 *   debounceMs: 250,
 * });
 *
 * return (
 *   <Input
 *     value={value}
 *     onChange={handleChange}
 *     onBlur={commit}
 *   />
 * );
 * ```
 */
export function useDebouncedForm<T extends string>({
	initialValue,
	onChange,
	debounceMs = 250,
	immediateOnCommit = true,
}: UseDebouncedFormOptions<T>): UseDebouncedFormReturn<T> {
	const [localValue, setLocalValue] = useState<T>(initialValue);
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChangeRef = useRef(onChange);

	// Sync from initialValue when it changes (e.g. navigation, refetch), but not while user has pending edits
	useEffect(() => {
		if (!hasPendingChanges && localValue !== initialValue) {
			setLocalValue(initialValue);
		}
	}, [initialValue, hasPendingChanges, localValue]);

	// Keep callback ref up to date
	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const debouncedUpdate = useCallback(
		(value: T) => {
			setHasPendingChanges(true);

			// Clear existing timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			// Set new timeout
			timeoutRef.current = setTimeout(() => {
				onChangeRef.current(value);
				setHasPendingChanges(false);
			}, debounceMs);
		},
		[debounceMs],
	);

	const setValue = useCallback(
		(value: T) => {
			setLocalValue(value);
			debouncedUpdate(value);
		},
		[debouncedUpdate],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const newValue = e.target.value as T;
			setValue(newValue);
		},
		[setValue],
	);

	const commit = useCallback(() => {
		// Clear any pending debounce
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		// Only trigger if there were pending changes
		if (hasPendingChanges && immediateOnCommit) {
			onChangeRef.current(localValue);
			setHasPendingChanges(false);
		}
	}, [localValue, hasPendingChanges, immediateOnCommit]);

	const reset = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setLocalValue(initialValue);
		setHasPendingChanges(false);
	}, [initialValue]);

	return {
		value: localValue,
		setValue,
		commit,
		reset,
		handleChange,
		hasPendingChanges,
	};
}

/**
 * Hook for managing boolean form fields with debounced updates.
 *
 * @example
 * ```tsx
 * const { value, toggle } = useDebouncedBooleanForm({
 *   initialValue: task.isArchived,
 *   onChange: (isArchived) => updateTask(task.id, { isArchived }),
 * });
 * ```
 */
export function useDebouncedBooleanForm({
	initialValue,
	onChange,
	debounceMs = 100,
	immediateOnCommit = true,
}: Omit<UseDebouncedFormOptions<boolean>, "initialValue"> & {
	initialValue: boolean;
}): Omit<UseDebouncedFormReturn<boolean>, "handleChange"> & {
	toggle: () => void;
	setValue: (value: boolean) => void;
} {
	const [localValue, setLocalValue] = useState<boolean>(initialValue);
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChangeRef = useRef(onChange);

	// Sync from initialValue when it changes (e.g. navigation, refetch), but not while user has pending edits
	useEffect(() => {
		if (!hasPendingChanges && localValue !== initialValue) {
			setLocalValue(initialValue);
		}
	}, [initialValue, hasPendingChanges, localValue]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const debouncedUpdate = useCallback(
		(value: boolean) => {
			setHasPendingChanges(true);

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				onChangeRef.current(value);
				setHasPendingChanges(false);
			}, debounceMs);
		},
		[debounceMs],
	);

	const setValue = useCallback(
		(value: boolean) => {
			setLocalValue(value);
			debouncedUpdate(value);
		},
		[debouncedUpdate],
	);

	const toggle = useCallback(() => {
		const newValue = !localValue;
		setValue(newValue);
	}, [localValue, setValue]);

	const commit = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}

		if (hasPendingChanges && immediateOnCommit) {
			onChangeRef.current(localValue);
			setHasPendingChanges(false);
		}
	}, [localValue, hasPendingChanges, immediateOnCommit]);

	const reset = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		setLocalValue(initialValue);
		setHasPendingChanges(false);
	}, [initialValue]);

	return {
		value: localValue,
		setValue,
		toggle,
		commit,
		reset,
		hasPendingChanges,
	};
}
