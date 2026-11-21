// Vehicle plates and driver phones, shared by the vehicle master and documents.

/** Plates like WB73E1234, stored upper case without spaces. */
export const VEHICLE_PATTERN = /^[A-Z]{2}-?\d{1,2}-?[A-Z]{0,3}-?\d{4}$/;
export const VEHICLE_MESSAGE = 'Vehicle number like WB73E1234';
export const normaliseVehicle = (value: string) => value.toUpperCase().replace(/\s+/g, '');

/** class-transformer hook: a typed plate in its stored form. */
export const vehicleTransform = ({ value }: { value: unknown }) => (typeof value === 'string' ? normaliseVehicle(value) : value);

/** A mobile number, with or without the country code. */
export const DRIVER_PHONE_PATTERN = /^\+?\d{8,13}$/;
export const DRIVER_PHONE_MESSAGE = "Driver's phone is 8 to 13 digits";
