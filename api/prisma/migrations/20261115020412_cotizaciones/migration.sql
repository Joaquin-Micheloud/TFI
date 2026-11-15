-- CreateEnum
CREATE TYPE "TipoCotizacion" AS ENUM ('DOLAR_OFICIAL', 'DOLAR_BLUE', 'DOLAR_MEP', 'DOLAR_CCL', 'DOLAR_TARJETA', 'DOLAR_MAYORISTA', 'ORO', 'PLATA');

-- CreateEnum
CREATE TYPE "Metal" AS ENUM ('ORO', 'PLATA');

-- CreateEnum
CREATE TYPE "ModoPrecioMetal" AS ENUM ('AUTOMATICO', 'AJUSTE', 'MANUAL');

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" UUID NOT NULL,
    "tipo" "TipoCotizacion" NOT NULL,
    "valor_compra" DECIMAL(14,4),
    "valor_venta" DECIMAL(14,4) NOT NULL,
    "unidad" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_precio_metal" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "metal" "Metal" NOT NULL,
    "modo" "ModoPrecioMetal" NOT NULL DEFAULT 'AUTOMATICO',
    "ajuste_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_precio_metal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_manuales_gramo" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "metal" "Metal" NOT NULL,
    "ley" DECIMAL(4,3) NOT NULL,
    "precio_ars" DECIMAL(14,2) NOT NULL,
    "vigente_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "precios_manuales_gramo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cotizaciones_tipo_creado_en_idx" ON "cotizaciones"("tipo", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "config_precio_metal_negocio_id_metal_key" ON "config_precio_metal"("negocio_id", "metal");

-- CreateIndex
CREATE INDEX "precios_manuales_gramo_negocio_id_metal_ley_vigente_desde_idx" ON "precios_manuales_gramo"("negocio_id", "metal", "ley", "vigente_desde");

-- AddForeignKey
ALTER TABLE "config_precio_metal" ADD CONSTRAINT "config_precio_metal_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_manuales_gramo" ADD CONSTRAINT "precios_manuales_gramo_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_manuales_gramo" ADD CONSTRAINT "precios_manuales_gramo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
