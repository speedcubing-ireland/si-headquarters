import { SharedDisplaySettings } from "@/components/shared/display-settings";
import { columnOptions } from "@/lib/competitions-constants";
import { useDisplaySettingsStore } from "@/store/display-settings-store";

export function DisplaySettings() {
	return (
		<SharedDisplaySettings
			columnOptions={columnOptions.map(({ value, label }) => ({
				value,
				label,
			}))}
			useDisplaySettingsStore={useDisplaySettingsStore}
		/>
	);
}
