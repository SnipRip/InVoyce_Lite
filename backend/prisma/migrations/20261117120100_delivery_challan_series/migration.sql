-- The DELIVERY_CHALLAN kind added in 20261117120000_delivery_challans gets its
-- series (a new enum value can only be used once the migration that added it
-- has committed).
INSERT INTO "NumberSeries" ("id", "kind", "method", "voucherType", "updatedAt")
VALUES (gen_random_uuid(), 'DELIVERY_CHALLAN', 'AUTOMATIC', 'Delivery Note', now());
