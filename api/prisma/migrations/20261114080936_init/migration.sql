-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'GERENTE', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "ProveedorAuth" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "TipoDolar" AS ENUM ('OFICIAL', 'BLUE', 'MEP', 'CCL', 'TARJETA', 'MAYORISTA');

-- CreateTable
CREATE TABLE "negocios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "tipo_dolar" "TipoDolar" NOT NULL DEFAULT 'BLUE',
    "plan" TEXT,
    "respuestas_cuestionario" JSONB,
    "regla_redondeo" INTEGER NOT NULL DEFAULT 100,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "proveedor_auth" "ProveedorAuth" NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "rol" "Rol" NOT NULL,
    "tope_descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiendas" (
    "id" UUID NOT NULL,
    "negocio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_tiendas" (
    "membresia_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,

    CONSTRAINT "usuarios_tiendas_pkey" PRIMARY KEY ("membresia_id","tienda_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");

-- CreateIndex
CREATE INDEX "membresias_negocio_id_idx" ON "membresias"("negocio_id");

-- CreateIndex
CREATE UNIQUE INDEX "membresias_usuario_id_negocio_id_key" ON "membresias"("usuario_id", "negocio_id");

-- CreateIndex
CREATE INDEX "tiendas_negocio_id_idx" ON "tiendas"("negocio_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiendas_negocio_id_nombre_key" ON "tiendas"("negocio_id", "nombre");

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiendas" ADD CONSTRAINT "tiendas_negocio_id_fkey" FOREIGN KEY ("negocio_id") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_tiendas" ADD CONSTRAINT "usuarios_tiendas_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_tiendas" ADD CONSTRAINT "usuarios_tiendas_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
