-- CreateEnum
CREATE TYPE "EstadoTransferencia" AS ENUM ('ENVIADA', 'RECIBIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "transferencias" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "origen_id" UUID NOT NULL,
    "destino_id" UUID NOT NULL,
    "estado" "EstadoTransferencia" NOT NULL DEFAULT 'ENVIADA',
    "nota" TEXT,
    "enviada_por_id" UUID NOT NULL,
    "enviada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibida_por_id" UUID,
    "recibida_en" TIMESTAMP(3),
    "cancelada_por_id" UUID,
    "cancelada_en" TIMESTAMP(3),

    CONSTRAINT "transferencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencia_items" (
    "id" UUID NOT NULL,
    "transferencia_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "pieza_id" UUID,
    "lote_origen_id" UUID,
    "lote_destino_id" UUID,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "transferencia_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transferencias_negocio_id_estado_idx" ON "transferencias"("negocio_id", "estado");

-- CreateIndex
CREATE INDEX "transferencias_origen_id_idx" ON "transferencias"("origen_id");

-- CreateIndex
CREATE INDEX "transferencias_destino_id_idx" ON "transferencias"("destino_id");

-- CreateIndex
CREATE INDEX "transferencia_items_transferencia_id_idx" ON "transferencia_items"("transferencia_id");

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_enviada_por_id_fkey" FOREIGN KEY ("enviada_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_recibida_por_id_fkey" FOREIGN KEY ("recibida_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias" ADD CONSTRAINT "transferencias_cancelada_por_id_fkey" FOREIGN KEY ("cancelada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_items" ADD CONSTRAINT "transferencia_items_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "transferencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_items" ADD CONSTRAINT "transferencia_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_items" ADD CONSTRAINT "transferencia_items_pieza_id_fkey" FOREIGN KEY ("pieza_id") REFERENCES "piezas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_items" ADD CONSTRAINT "transferencia_items_lote_origen_id_fkey" FOREIGN KEY ("lote_origen_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_items" ADD CONSTRAINT "transferencia_items_lote_destino_id_fkey" FOREIGN KEY ("lote_destino_id") REFERENCES "lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
