import type { RegistrationDataV2 } from "../../services/wca/client/types.gen";

function readString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function normalizeWcaId(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

export function getRegistrationStatus(
	registration: RegistrationDataV2,
): string {
	const competingRecord = registration.competing as Record<string, unknown>;
	const registrationRecord = registration as unknown as Record<string, unknown>;
	return (
		readString(competingRecord.registration_status) ??
		readString(competingRecord.status) ??
		readString(registrationRecord.registration_status) ??
		readString(registrationRecord.status) ??
		""
	).trim();
}

export function isAcceptedRegistration(
	registration: RegistrationDataV2,
): boolean {
	return getRegistrationStatus(registration).toLowerCase() === "accepted";
}

export function hasPaid(registration: RegistrationDataV2): boolean {
	const paymentRecord = registration.payment as
		| Record<string, unknown>
		| undefined;
	if (typeof paymentRecord?.has_paid === "boolean") {
		return paymentRecord.has_paid;
	}
	const paymentStatus = (readString(paymentRecord?.payment_status) ?? "")
		.trim()
		.toLowerCase();
	return paymentStatus === "paid";
}
