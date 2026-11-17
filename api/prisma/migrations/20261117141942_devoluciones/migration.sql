-- CreateEnum
CREATE TYPE "DestinoDevolucion" AS ENUM ('STOCK', 'BAJA');

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "anulada_en" TIMESTAMP(3),
ADD COLUMN     "anulada_por_id" UUID,
ADD COLUMN     "motivo_anulacion" TEXT;

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "medio_reintegro" "MedioPago" NOT NULL,
    "monto_ars" DECIMAL(14,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_items" (
    "id" UUID NOT NULL,
    "devolucion_id" UUID NOT NULL,
    "venta_item_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "monto_ars" DECIMAL(14,2) NOT NULL,
    "destino" "DestinoDevolucion" NOT NULL,

    CONSTRAINT "devolucion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devoluciones_venta_id_idx" ON "devoluciones"("venta_id");

-- CreateIndex
CREATE INDEX "devoluciones_negocio_id_fecha_idx" ON "devoluciones"("negocio_id", "fecha");

-- CreateIndex
CREATE INDEX "devolucion_items_venta_item_id_idx" ON "devolucion_items"("venta_item_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_anulada_por_id_fkey" FOREIGN KEY ("anulada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_items" ADD CONSTRAINT "devolucion_items_venta_item_id_fkey" FOREIGN KEY ("venta_item_id") REFERENCES "venta_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
