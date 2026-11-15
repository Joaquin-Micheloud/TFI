-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('REVENTA', 'FANTASIA', 'ELABORACION');

-- CreateEnum
CREATE TYPE "ModoStock" AS ENUM ('UNICO', 'LOTE');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "ElaboracionPor" AS ENUM ('PIEZA', 'GRAMO');

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "margen_defecto_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "categoria_id" UUID,
    "codigo" TEXT NOT NULL,
    "codigo_barras" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoProducto" NOT NULL,
    "modo_stock" "ModoStock" NOT NULL,
    "metal" "Metal",
    "ley" DECIMAL(4,3),
    "peso_gramos" DECIMAL(10,3),
    "margen_pct" DECIMAL(6,2),
    "precio_compra" DECIMAL(14,2),
    "moneda_compra" "Moneda",
    "elaboracion_usd" DECIMAL(12,2),
    "elaboracion_por" "ElaboracionPor",
    "insumos_ars" DECIMAL(14,2),
    "stock_minimo" INTEGER,
    "foto_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_negocio_id_nombre_key" ON "categorias"("negocio_id", "nombre");

-- CreateIndex
CREATE INDEX "productos_negocio_id_tipo_idx" ON "productos"("negocio_id", "tipo");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_negocio_id_codigo_key" ON "productos"("negocio_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productos_negocio_id_codigo_barras_key" ON "productos"("negocio_id", "codigo_barras");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
