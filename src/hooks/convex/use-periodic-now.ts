import { useEffect, useState } from "react";

export function usePeriodicNow(intervalMs = 30_000) {
	const [nowMs, setNowMs] = useState(() => Date.now());
	useEffect(() => {
		const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs]);
	return nowMs;
}
