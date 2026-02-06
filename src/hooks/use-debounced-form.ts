import { useState, useCallback, useRef, useEffect } from "react";

interface UseDebouncedFormOptions {
	initialValue: string;
	onChange: (value: string) => void;
	debounceMs?: number;
	immediateOnCommit?: boolean;
}

interface UseDebouncedFormReturn {
	value: string;
	setValue: (value: string) => void;
	commit: () => void;
	reset: () => void;
	handleChange: (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => void;
	hasPendingChanges: boolean;
}

export function useDebouncedForm({
	initialValue,
	onChange,
	debounceMs = 250,
	immediateOnCommit = true,
}: UseDebouncedFormOptions): UseDebouncedFormReturn {
	const [localValue, setLocalValue] = useState<string>(initialValue);
	const [hasPendingChanges, setHasPendingChanges] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onChangeRef = useRef(onChange);
	const previousInitialValueRef = useRef(initialValue);

	useEffect(() => {
		const previousInitialValue = previousInitialValueRef.current;
		if (previousInitialValue === initialValue) return;
		previousInitialValueRef.current = initialValue;
		if (!hasPendingChanges) {
			setLocalValue(initialValue);
		}
	}, [initialValue, hasPendingChanges]);

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
		(value: string) => {
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
		(value: string) => {
			setLocalValue(value);
			debouncedUpdate(value);
		},
		[debouncedUpdate],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setValue(e.target.value);
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
