import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

export type CanvaTemplatePickerItem = {
	id: string;
	title: string;
	url: string | null;
};

export type CanvaFolderPickerItem = {
	id: string;
	name: string;
};

function mergeUniqueById<T extends { id: string }>(items: T[]): T[] {
	const seen = new Set<string>();
	const merged: T[] = [];
	for (const item of items) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		merged.push(item);
	}
	return merged;
}

export function useCanvaTemplatePicker(query: string) {
	const listBrandTemplates = useAction(api.canva.listBrandTemplates);
	const [items, setItems] = useState<CanvaTemplatePickerItem[]>([]);
	const [continuation, setContinuation] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestIdRef = useRef(0);

	const fetchPage = useCallback(
		async (args: { reset: boolean; continuation?: string | null }) => {
			const requestId = ++requestIdRef.current;
			setError(null);
			if (args.reset) {
				setIsLoading(true);
			} else {
				setIsLoadingMore(true);
			}
			try {
				const response = await listBrandTemplates({
					query: query.trim() || undefined,
					continuation: args.continuation ?? undefined,
					limit: 30,
				});
				if (requestId !== requestIdRef.current) return;

				setItems((previous) =>
					args.reset
						? response.items
						: mergeUniqueById([...previous, ...response.items]),
				);
				setContinuation(response.continuation);
			} catch (fetchError) {
				if (requestId !== requestIdRef.current) return;
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "Failed to load Canva templates.",
				);
				if (args.reset) {
					setItems([]);
					setContinuation(null);
				}
			} finally {
				if (requestId === requestIdRef.current) {
					setIsLoading(false);
					setIsLoadingMore(false);
				}
			}
		},
		[listBrandTemplates, query],
	);

	useEffect(() => {
		void fetchPage({ reset: true });
	}, [fetchPage]);

	const hasMore = continuation !== null;
	const loadMore = useCallback(() => {
		if (!continuation || isLoadingMore || isLoading) return;
		void fetchPage({ reset: false, continuation });
	}, [continuation, fetchPage, isLoading, isLoadingMore]);

	return {
		items,
		isLoading,
		isLoadingMore,
		error,
		hasMore,
		loadMore,
	};
}

export function useCanvaFolderPicker(folderId: string, query: string) {
	const listFolderItems = useAction(api.canva.listFolderItems);
	const [items, setItems] = useState<CanvaFolderPickerItem[]>([]);
	const [continuation, setContinuation] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestIdRef = useRef(0);

	const fetchPage = useCallback(
		async (args: { reset: boolean; continuation?: string | null }) => {
			const requestId = ++requestIdRef.current;
			setError(null);
			if (args.reset) {
				setIsLoading(true);
			} else {
				setIsLoadingMore(true);
			}
			try {
				const response = await listFolderItems({
					folderId,
					continuation: args.continuation ?? undefined,
					limit: 100,
					sortBy: "title_ascending",
				});
				if (requestId !== requestIdRef.current) return;

				const folders = response.items
					.filter((item) => item.type === "folder")
					.map((item) => ({ id: item.id, name: item.name }));

				setItems((previous) =>
					args.reset ? folders : mergeUniqueById([...previous, ...folders]),
				);
				setContinuation(response.continuation);
			} catch (fetchError) {
				if (requestId !== requestIdRef.current) return;
				setError(
					fetchError instanceof Error
						? fetchError.message
						: "Failed to load Canva folders.",
				);
				if (args.reset) {
					setItems([]);
					setContinuation(null);
				}
			} finally {
				if (requestId === requestIdRef.current) {
					setIsLoading(false);
					setIsLoadingMore(false);
				}
			}
		},
		[folderId, listFolderItems],
	);

	useEffect(() => {
		void fetchPage({ reset: true });
	}, [fetchPage]);

	const filteredItems = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return items;
		return items.filter((item) => item.name.toLowerCase().includes(needle));
	}, [items, query]);

	const hasMore = continuation !== null;
	const loadMore = useCallback(() => {
		if (!continuation || isLoadingMore || isLoading) return;
		void fetchPage({ reset: false, continuation });
	}, [continuation, fetchPage, isLoading, isLoadingMore]);

	return {
		items: filteredItems,
		isLoading,
		isLoadingMore,
		error,
		hasMore,
		loadMore,
	};
}
