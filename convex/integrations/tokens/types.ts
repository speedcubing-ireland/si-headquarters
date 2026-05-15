import type { Infer } from "convex/values";
import type schema from "../../schema";

type ServiceTokensDocument = Infer<
	typeof schema.tables.serviceTokens.validator
>;

export type ServiceType = ServiceTokensDocument["service"];
export type TokenData = Pick<
	ServiceTokensDocument,
	"accessToken" | "refreshToken" | "expiresAt"
>;
