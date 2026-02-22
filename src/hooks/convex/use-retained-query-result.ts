import { useRef } from "react";

export type RetainedQueryResult<T> =
	| {
			data: undefined;
			isLoading: true;
			isRefreshing: false;
	  }
	| {
			data: T;
			isLoading: false;
			isRefreshing: boolean;
	  };

export function useRetainedQueryResult<T>(
	result: T | undefined,
	key: unknown = "__default__",
): RetainedQueryResult<T> {
	const keyRef = useRef(key);
	const lastResolvedRef = useRef<T | undefined>(undefined);

	if (!Object.is(keyRef.current, key)) {
		keyRef.current = key;
		lastResolvedRef.current = undefined;
	}

	if (result !== undefined) {
		lastResolvedRef.current = result;
	}

	const data = result ?? lastResolvedRef.current;
	if (data === undefined) {
		return {
			data: undefined,
			isLoading: true,
			isRefreshing: false,
		};
	}

	return {
		data,
		isLoading: false,
		isRefreshing: result === undefined,
	};
}
