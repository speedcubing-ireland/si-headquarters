import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissionSnapshot } from "./use-admin";
import { useRetainedQueryResult } from "./use-retained-query-result";

export function useSponsors(enabled = true) {
	const result = useQuery(api.sponsorship.sponsors.list, enabled ? {} : "skip");
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
	const createSponsor = useMutation(api.sponsorship.sponsors.create);
	const updateSponsor = useMutation(api.sponsorship.sponsors.update);
	const sendAccessEmailMut = useMutation(
		api.sponsorship.sponsors.sendAccessEmail,
	);
	const revokeSessions = useMutation(api.sponsorship.sponsors.revokeSessions);
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
		api.sponsorship.auctions.management.listCompetitionsForManager,
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
		api.sponsorship.auctions.management.listByCompetition,
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
		api.sponsorship.auctions.management.listForManager,
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
		api.sponsorship.auctions.management.getManagerView,
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
	const createAuction = useMutation(api.sponsorship.auctions.management.create);
	const updateAuction = useMutation(api.sponsorship.auctions.management.update);
	const startAuction = useMutation(api.sponsorship.auctions.lifecycle.start);
	const closeAuction = useMutation(api.sponsorship.auctions.lifecycle.close);
	const refreshCompetitionSnapshot = useAction(
		api.sponsorship.auctions.competitionSnapshot.refreshCompetitionSnapshot,
	);
	const deleteBeforeOpen = useMutation(
		api.sponsorship.auctions.management.removeBeforeOpen,
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
