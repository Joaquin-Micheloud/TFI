-- CreateEnum
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "invitaciones" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "tope_descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tienda_ids" UUID[],
    "token_hash" TEXT NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "invitado_por_id" UUID NOT NULL,
    "aceptada_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_token_hash_key" ON "invitaciones"("token_hash");

-- CreateIndex
CREATE INDEX "invitaciones_negocio_id_estado_idx" ON "invitaciones"("negocio_id", "estado");

-- CreateIndex
CREATE INDEX "invitaciones_email_idx" ON "invitaciones"("email");

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_por_id_fkey" FOREIGN KEY ("invitado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
