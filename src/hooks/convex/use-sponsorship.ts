import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePermissionSnapshot } from "./use-admin";

export function useSponsors(enabled = true) {
	const sponsors = useQuery(api.sponsors.list, enabled ? {} : "skip");
	return {
		sponsors: sponsors ?? [],
		isLoading: enabled && sponsors === undefined,
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
	const competitions = useQuery(
		api.sponsorshipAuctions.listCompetitionsForManager,
		enabled ? {} : "skip",
	);
	return {
		competitions: competitions ?? [],
		isLoading: enabled && competitions === undefined,
	};
}

export function useSponsorshipAuctionsForCompetition(
	competitionId: Id<"competitions"> | null,
	enabled = true,
) {
	const auctions = useQuery(
		api.sponsorshipAuctions.listByCompetition,
		competitionId && enabled ? { competitionId } : "skip",
	);
	return {
		auctions: auctions ?? [],
		isLoading: enabled && competitionId !== null && auctions === undefined,
	};
}

export function useSponsorshipAuctionsForManager(enabled = true) {
	const auctions = useQuery(
		api.sponsorshipAuctions.listForManager,
		enabled ? {} : "skip",
	);
	return {
		auctions: auctions ?? [],
		isLoading: enabled && auctions === undefined,
	};
}

export function useSponsorshipAuctionManagerView(
	auctionId: Id<"sponsorshipAuctions"> | null,
	enabled = true,
) {
	const managerView = useQuery(
		api.sponsorshipAuctions.getManagerView,
		auctionId && enabled ? { auctionId } : "skip",
	);
	return {
		managerView: managerView ?? null,
		isLoading: enabled && auctionId !== null && managerView === undefined,
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
