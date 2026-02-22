import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissionSnapshot } from "./use-admin";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useSponsors(enabled = true) {
	const result = useQuery(api.sponsors.list, enabled ? {} : "skip");
	const {
		data: sponsors,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		enabled ? result : undefined,
		enabled ? "on" : "off",
	);
	return {
		sponsors: sponsors ?? [],
		isLoading: enabled && isLoading,
		isRefreshing: enabled && isRefreshing,
	};
}

export function useIsSponsorshipManager() {
	const { permissions, isLoading } = usePermissionSnapshot();
	return { isManager: permissions.isSponsorshipManager, isLoading };
}

export function useSponsorMutations() {
	const createSponsor = useMutation(api.sponsors.create);
	const updateSponsor = useMutation(api.sponsors.update);
	const sendAccessEmailMut = useMutation(api.sponsors.sendAccessEmail);
	const revokeSessions = useMutation(api.sponsors.revokeSessions);
	const setSponsorActive = (sponsorId: Id<"sponsors">, active: boolean) =>
		updateSponsor({ sponsorId, active });
	return {
		createSponsor,
		updateSponsor,
		setSponsorActive,
		archiveSponsor: (sponsorId: Id<"sponsors">) =>
			setSponsorActive(sponsorId, false),
		unarchiveSponsor: (sponsorId: Id<"sponsors">) =>
			setSponsorActive(sponsorId, true),
		sendAccessEmail: (sponsorId: Id<"sponsors">) =>
			sendAccessEmailMut({ sponsorId }),
		revokeSessions: (sponsorId: Id<"sponsors">) =>
			revokeSessions({ sponsorId }),
	};
}

export function useSponsorshipCompetitionsForManager(enabled = true) {
	const result = useQuery(
		api.sponsorshipAuctions.listCompetitionsForManager,
		enabled ? {} : "skip",
	);
	const {
		data: competitions,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		enabled ? result : undefined,
		enabled ? "on" : "off",
	);
	return {
		competitions: competitions ?? [],
		isLoading: enabled && isLoading,
		isRefreshing: enabled && isRefreshing,
	};
}

export function useSponsorshipAuctionsForCompetition(
	competitionId: Id<"competitions"> | null,
	enabled = true,
) {
	const result = useQuery(
		api.sponsorshipAuctions.listByCompetition,
		competitionId && enabled ? { competitionId } : "skip",
	);
	const {
		data: auctions,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		competitionId && enabled ? result : undefined,
		competitionId ?? "skip",
	);
	return {
		auctions: auctions ?? [],
		isLoading: enabled && competitionId !== null && isLoading,
		isRefreshing: enabled && competitionId !== null && isRefreshing,
	};
}

export function useSponsorshipAuctionsForManager(enabled = true) {
	const result = useQuery(
		api.sponsorshipAuctions.listForManager,
		enabled ? {} : "skip",
	);
	const {
		data: auctions,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		enabled ? result : undefined,
		enabled ? "on" : "off",
	);
	return {
		auctions: auctions ?? [],
		isLoading: enabled && isLoading,
		isRefreshing: enabled && isRefreshing,
	};
}

export function useSponsorshipAuctionManagerView(
	auctionId: Id<"sponsorshipAuctions"> | null,
	enabled = true,
) {
	const result = useQuery(
		api.sponsorshipAuctions.getManagerView,
		auctionId && enabled ? { auctionId } : "skip",
	);
	const {
		data: managerView,
		isLoading,
		isRefreshing,
	} = useRetainedQueryResult(
		auctionId && enabled ? result : undefined,
		auctionId ?? "skip",
	);
	return {
		managerView: managerView ?? null,
		isLoading: enabled && auctionId !== null && isLoading,
		isRefreshing: enabled && auctionId !== null && isRefreshing,
	};
}

export function useSponsorshipAuctionMutations() {
	const createAuction = useMutation(api.sponsorshipAuctions.create);
	const updateAuction = useMutation(api.sponsorshipAuctions.update);
	const startAuction = useMutation(api.sponsorshipAuctions.start);
	const closeAuction = useMutation(api.sponsorshipAuctions.close);
	const refreshCompetitionSnapshot = useAction(
		api.sponsorshipAuctions.refreshCompetitionSnapshot,
	);
	const deleteBeforeOpen = useMutation(
		api.sponsorshipAuctions.removeBeforeOpen,
	);
	return {
		createAuction,
		updateAuction,
		refreshCompetitionSnapshot: (auctionId: Id<"sponsorshipAuctions">) =>
			refreshCompetitionSnapshot({ auctionId }),
		startAuction: (auctionId: Id<"sponsorshipAuctions">) =>
			startAuction({ auctionId }),
		closeAuction: (auctionId: Id<"sponsorshipAuctions">) =>
			closeAuction({ auctionId }),
		deleteBeforeOpen: (auctionId: Id<"sponsorshipAuctions">) =>
			deleteBeforeOpen({ auctionId }),
	};
}
