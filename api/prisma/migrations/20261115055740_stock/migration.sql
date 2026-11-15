-- CreateEnum
CREATE TYPE "EstadoPieza" AS ENUM ('DISPONIBLE', 'RESERVADA', 'VENDIDA', 'EN_TRANSITO', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO_COMPRA', 'INGRESO_ELABORACION', 'VENTA', 'DEVOLUCION', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_INVENTARIO', 'BAJA');

-- CreateEnum
CREATE TYPE "MotivoBaja" AS ENUM ('ROTURA', 'PERDIDA', 'FUNDICION', 'OTRO');

-- CreateTable
CREATE TABLE "piezas" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "peso_gramos" DECIMAL(10,3) NOT NULL,
    "precio_compra" DECIMAL(14,2),
    "hechura_usd" DECIMAL(12,2),
    "dolar_alta" DECIMAL(14,4) NOT NULL,
    "gramo_alta" DECIMAL(14,2),
    "estado" "EstadoPieza" NOT NULL DEFAULT 'DISPONIBLE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "piezas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "cantidad_inicial" INTEGER NOT NULL,
    "cantidad_disponible" INTEGER NOT NULL,
    "peso_total_gramos" DECIMAL(12,3),
    "precio_compra_total" DECIMAL(14,2),
    "moneda_compra" "Moneda" NOT NULL DEFAULT 'ARS',
    "hechura_usd_unitaria" DECIMAL(12,2),
    "dolar_alta" DECIMAL(14,4) NOT NULL,
    "gramo_alta" DECIMAL(14,2),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "pieza_id" UUID,
    "lote_id" UUID,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo_baja" "MotivoBaja",
    "detalle" TEXT,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piezas_producto_id_estado_idx" ON "piezas"("producto_id", "estado");

-- CreateIndex
CREATE INDEX "piezas_tienda_id_estado_idx" ON "piezas"("tienda_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "piezas_negocio_id_codigo_key" ON "piezas"("negocio_id", "codigo");

-- CreateIndex
CREATE INDEX "lotes_producto_id_tienda_id_fecha_ingreso_idx" ON "lotes"("producto_id", "tienda_id", "fecha_ingreso");

-- CreateIndex
CREATE INDEX "movimientos_stock_negocio_id_fecha_idx" ON "movimientos_stock"("negocio_id", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_stock_producto_id_idx" ON "movimientos_stock"("producto_id");

-- CreateIndex
CREATE INDEX "movimientos_stock_tienda_id_idx" ON "movimientos_stock"("tienda_id");

-- AddForeignKey
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_pieza_id_fkey" FOREIGN KEY ("pieza_id") REFERENCES "piezas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
