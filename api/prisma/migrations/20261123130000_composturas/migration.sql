-- CreateEnum
CREATE TYPE "EstadoCompostura" AS ENUM ('RECIBIDA', 'PRESUPUESTADA', 'EN_TALLER', 'LISTA', 'ENTREGADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('PRODUCTOS', 'SERVICIO');

-- AlterTable
ALTER TABLE "negocios" ADD COLUMN     "ultimo_numero_compostura" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "tipo" "TipoVenta" NOT NULL DEFAULT 'PRODUCTOS';

-- El ítem de servicio de una compostura no tiene producto
ALTER TABLE "venta_items" DROP CONSTRAINT "venta_items_producto_id_fkey";
ALTER TABLE "venta_items" ALTER COLUMN "producto_id" DROP NOT NULL;
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "composturas" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" "EstadoCompostura" NOT NULL DEFAULT 'RECIBIDA',
    "descripcion" TEXT NOT NULL,
    "metal" "Metal",
    "ley" DECIMAL(4,3),
    "peso_entrada" DECIMAL(10,3) NOT NULL,
    "peso_aportado" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "peso_agregado" DECIMAL(10,3),
    "peso_salida" DECIMAL(10,3),
    "mano_obra" DECIMAL(14,2),
    "margen_pct" DECIMAL(6,2),
    "presupuesto" DECIMAL(14,2),
    "precio_final" DECIMAL(14,2),
    "sena" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "medio_sena" "MedioPago",
    "fecha_estimada" DATE,
    "observaciones" TEXT,
    "motivo_cancelacion" TEXT,
    "lista_en" TIMESTAMP(3),
    "entregada_en" TIMESTAMP(3),
    "venta_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compostura_estados" (
    "id" UUID NOT NULL,
    "compostura_id" UUID NOT NULL,
    "estado" "EstadoCompostura" NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compostura_estados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "composturas_venta_id_key" ON "composturas"("venta_id");

-- CreateIndex
CREATE INDEX "composturas_negocio_id_estado_idx" ON "composturas"("negocio_id", "estado");

-- CreateIndex
CREATE INDEX "composturas_cliente_id_idx" ON "composturas"("cliente_id");

-- CreateIndex
CREATE INDEX "composturas_tienda_id_idx" ON "composturas"("tienda_id");

-- CreateIndex
CREATE UNIQUE INDEX "composturas_negocio_id_numero_key" ON "composturas"("negocio_id", "numero");

-- CreateIndex
CREATE INDEX "compostura_estados_compostura_id_idx" ON "compostura_estados"("compostura_id");

-- AddForeignKey
ALTER TABLE "composturas" ADD CONSTRAINT "composturas_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composturas" ADD CONSTRAINT "composturas_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composturas" ADD CONSTRAINT "composturas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composturas" ADD CONSTRAINT "composturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "composturas" ADD CONSTRAINT "composturas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compostura_estados" ADD CONSTRAINT "compostura_estados_compostura_id_fkey" FOREIGN KEY ("compostura_id") REFERENCES "composturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compostura_estados" ADD CONSTRAINT "compostura_estados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
