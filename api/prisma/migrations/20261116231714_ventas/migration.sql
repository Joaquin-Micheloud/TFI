-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('CONFIRMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO_ARS', 'EFECTIVO_USD', 'TRANSFERENCIA', 'DEBITO', 'CREDITO');

-- AlterTable
ALTER TABLE "tiendas" ADD COLUMN     "punto_venta" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ultimo_numero_venta" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ventas" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "punto_venta" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descuento_total" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "vuelto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tipo_dolar" "TipoDolar" NOT NULL,
    "dolar_usado" DECIMAL(14,4) NOT NULL,
    "cotizacion_dolar_id" UUID,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'CONFIRMADA',

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "producto_id" UUID NOT NULL,
    "pieza_id" UUID,
    "lote_id" UUID,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_lista_unitario" DECIMAL(14,2) NOT NULL,
    "descuento_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "costo_unitario" DECIMAL(14,2) NOT NULL,
    "margen_pct" DECIMAL(6,2) NOT NULL,
    "metal" "Metal",
    "ley" DECIMAL(4,3),
    "peso_gramos" DECIMAL(10,3),
    "gramo_usado" DECIMAL(14,2),
    "cotizacion_metal_id" UUID,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "moneda" "Moneda" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "monto_ars" DECIMAL(14,2) NOT NULL,
    "cuotas" INTEGER,
    "referencia" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ventas_negocio_id_fecha_idx" ON "ventas"("negocio_id", "fecha");

-- CreateIndex
CREATE INDEX "ventas_usuario_id_fecha_idx" ON "ventas"("usuario_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_tienda_id_numero_key" ON "ventas"("tienda_id", "numero");

-- CreateIndex
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- CreateIndex
CREATE INDEX "venta_items_producto_id_idx" ON "venta_items"("producto_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_pieza_id_fkey" FOREIGN KEY ("pieza_id") REFERENCES "piezas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
