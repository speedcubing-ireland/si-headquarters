import type { ServiceType } from "./tokens/types";
import type { ServiceDefinition } from "./types";

import canva from "./canva";
import google from "./google";
import wca from "./wca";

const services: Record<ServiceType, ServiceDefinition> = {
	canva: canva,
	google: google,
	wca: wca,
};

export default services;
