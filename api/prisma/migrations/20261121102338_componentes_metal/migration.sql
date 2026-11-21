CREATE TABLE "producto_componentes" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "metal" "Metal" NOT NULL,
    "ley" DECIMAL(4,3) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "producto_componentes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "producto_componentes_producto_id_idx" ON "producto_componentes"("producto_id");

ALTER TABLE "producto_componentes"
  ADD CONSTRAINT "producto_componentes_producto_id_fkey"
  FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "producto_componentes" ("id", "producto_id", "metal", "ley", "porcentaje", "orden")
SELECT gen_random_uuid(), "id", "metal", "ley", 100, 0
FROM "productos"
WHERE "metal" IS NOT NULL AND "ley" IS NOT NULL;

ALTER TABLE "venta_items" ADD COLUMN "componentes" JSONB;

ALTER TABLE "productos" DROP COLUMN "metal", DROP COLUMN "ley";