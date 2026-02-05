import { useState, useCallback, useRef, useEffect } from "react";

interface UseDebouncedFormOptions<T> {
	initialValue: T;
	onChange: (value: T) => void;
	debounceMs?: number;
	immediateOnCommit?: boolean;
}

interface UseDebouncedFormReturn<T> {
	value: T;
	setValue: (value: T) => void;
	commit: () => void;
	reset: () => void;
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => void;
	hasPendingChanges: boolean;
}

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
		(value: T) => {
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
		commit,
		reset,
		handleChange,
		hasPendingChanges,
	};
}
