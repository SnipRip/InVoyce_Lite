"use client";

import useSWR from "swr";
import { SelectField } from "@/components/ui/select-field";
import { PARTIES_PATH } from "@/features/parties/parties-api";
import { apiGet } from "@/lib/api-client";
import type { PartyView } from "@/types/party";
import type { VehicleView } from "@/types/vehicle";
import { vehiclePersistence, VEHICLES_PATH } from "./masters-api";
import { useQuickAddRecord } from "./quick-add-record";
import { VEHICLE_BLANK, vehicleFields } from "./vehicles-master";

/** Radix Select takes no empty value: the "typed in" choice. */
const TYPED = "typed";

/** Hint under the vehicle number once it comes from the master (the field is then read-only). */
export const PICKED_VEHICLE_HINT = "From the vehicle master";

/** Live vehicles for a new document (an archived one cannot be newly picked). Empty while loading. */
export function useLiveVehicles(): VehicleView[] {
  return useSWR<VehicleView[]>(VEHICLES_PATH, apiGet).data ?? [];
}

interface VehicleSelectProps {
  vehicles: VehicleView[];
  /** Empty: typed, not from the master. */
  vehicleId: string;
  onPick: (vehicle: VehicleView | null) => void;
}

/** Live vendors, the transporters a new hired vehicle can belong to. */
const LIVE_VENDORS_PATH = `${PARTIES_PATH}?role=vendor`;

// The "Vehicle" picker on shipments, invoices and stock transfers. Picking
// one fills the number (the server records the master's number), "Not on the
// list" lets the number be typed. The "+" (client, 12 Nov 2026) adds a
// vehicle to the master with its own fields and picks it here.
export function VehicleSelect({ vehicles, vehicleId, onPick }: VehicleSelectProps) {
  const vendors = useSWR<PartyView[]>(LIVE_VENDORS_PATH, apiGet);
  const addVehicle = useQuickAddRecord({
    title: "New vehicle",
    fields: vehicleFields((vendors.data ?? []).map((vendor) => ({ value: vendor.id, label: vendor.displayName }))),
    blank: VEHICLE_BLANK,
    persistence: vehiclePersistence(() => {}),
    path: VEHICLES_PATH,
    listedIds: vehicles.map((vehicle) => vehicle.id),
    onPick: (id) => onPick(vehicles.find((vehicle) => vehicle.id === id) ?? null),
  });
  return (
    <>
      <SelectField
        label="Vehicle"
        options={[
          { value: TYPED, label: "Not on the list" },
          ...vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.number} · ${vehicle.ownership === "OWN" ? "own" : (vehicle.transporterName ?? "hired")}` })),
        ]}
        value={vehicleId || TYPED}
        onValueChange={(value) => onPick(vehicles.find((vehicle) => vehicle.id === value) ?? null)}
        onAdd={addVehicle.open}
        addLabel="Add a new vehicle"
      />
      {addVehicle.dialog}
    </>
  );
}
