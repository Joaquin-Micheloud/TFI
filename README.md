# QuilateAR

SaaS multi-tenant de gestión de stock, ventas y composturas para joyerías, con precios que se recalculan según las cotizaciones del dólar, el oro y la plata.

Trabajo Final Integrador de la Tecnicatura Universitaria en Programación (UTN).

## Qué resuelve

En una joyería el precio de casi todas las piezas depende del peso, de la ley del metal y de cotizaciones que cambian todos los días. QuilateAR calcula el precio de cada pieza al momento, con la cotización vigente, y guarda en cada venta qué cotización se usó.

## Funcionalidades

| Módulo | Qué incluye |
| --- | --- |
| Negocio y equipo | Registro, alta de tiendas, invitaciones por email con vencimiento, roles (administrador, gerente, vendedor) y permisos por tienda |
| Cotizaciones | Lectura programada de dólar (dolarapi.com) y onza de oro y plata (xaus.com), historial, precio del gramo automático, con ajuste o manual |
| Catálogo | Productos de reventa, fantasía y elaboración propia; uno o varios metales por pieza (gramo promedio ponderado); categorías con margen |
| Stock | Piezas únicas y lotes con hechura del proveedor en USD, movimientos, bajas, ajustes, stock mínimo, transferencias entre tiendas |
| Ventas | Punto de venta con lector de códigos, FIFO de lotes, descuentos con tope por rol, pagos combinados, ticket PDF, snapshot de la cotización, anulaciones y devoluciones |
| Clientes | Ficha con historial de compras y composturas |
| Composturas | Órdenes con estados, presupuesto, comprobante de recepción, entrega con cobro (venta de servicio) y alertas de vencidas y sin retirar |
| Reportes | Valorización del inventario a la cotización de hoy, ventas por período y por vendedor con margen bruto, caja del día, composturas; exportación a CSV |

## Tecnologías

- **Backend:** NestJS 12 (ESM) · Prisma 7 con `@prisma/adapter-pg` · PostgreSQL 17 · JWT (Passport) · class-validator · PDFKit · Nodemailer
- **Frontend:** React 19 · Vite · TypeScript · Mantine · TanStack Query · React Router
- **Infraestructura:** Docker Compose (PostgreSQL, Adminer, Mailpit) · GitHub Actions · Azure (App Service, Static Web Apps, PostgreSQL Flexible Server)

## Arquitectura

```
web/  (React)  ──HTTP/JSON + JWT──▶  api/  (NestJS)  ──Prisma──▶  PostgreSQL
                                        │
                                        ├── job programado ──▶ dolarapi.com / xaus.com
                                        └── SMTP ──▶ invitaciones por email
```

**Multi-tenancy:** una sola base con `negocio_id` en todas las tablas del negocio. El negocio sale siempre del token, nunca de un parámetro del cliente, y en cada request se verifica contra la base que la membresía siga activa. Gerentes y vendedores solo operan en las tiendas que tienen asignadas.

**Precios:** el precio no se guarda en el producto; se calcula al vuelo con el precio del gramo de hoy:

- Gramo = USD por onza ÷ 31,1035 × ley × dólar × (1 + ajuste)
- Reventa: costo = peso × gramo + hechura USD × dólar
- Fantasía: costo = precio de compra
- Elaboración propia: costo = peso × gramo + elaboración USD × dólar + insumos
- Composturas: precio = mano de obra + metal agregado × gramo × (1 + margen)
- Precio de venta = costo × (1 + margen), redondeado según la regla del negocio

## Estructura

```
api/                  Backend NestJS
  prisma/             Esquema y migraciones
  src/<módulo>/       auth, tiendas, usuarios, cotizaciones, precios, productos, stock,
                      transferencias, ventas, clientes, composturas, reportes, invitaciones
web/                  Frontend React
  src/pages/          Una carpeta por pantalla
  src/lib/            Cliente de la API, tipos y formatos
docker-compose.yml    PostgreSQL, Adminer y Mailpit para desarrollo
api-helpers.ps1       Funciones de PowerShell para probar la API a mano
```

## Cómo levantarlo en local

Requisitos: Node.js 22, Docker Desktop y Git.

```powershell
# 1. Servicios: PostgreSQL (puerto 5433), Adminer (http://localhost:8080) y Mailpit (http://localhost:8025)
docker compose up -d

# 2. Backend
cd api
copy .env.example .env        # y completá JWT_SECRET
npm install
npx prisma migrate deploy
npx prisma generate
npm run start:dev             # http://localhost:3000

# 3. Frontend (en otra terminal)
cd web
npm install
npm run dev                   # http://localhost:5173
```

Entrá a http://localhost:5173, registrá un negocio y quedás como administrador. Los emails de invitación llegan a Mailpit.

### Comandos útiles

| Dónde | Comando | Para qué |
| --- | --- | --- |
| api | `npm run start:dev` | API con recarga automática |
| api | `npm test` | Tests unitarios (motor de precios y fechas) |
| api | `npx prisma migrate dev --name <nombre>` | Nueva migración después de cambiar el esquema |
| api | `npx prisma generate` | Regenerar el cliente (Prisma 7 no lo hace solo al migrar) |
| web | `npm run build` | Compilar el frontend (chequea tipos) |

## Despliegue en Azure

| Parte | Servicio |
| --- | --- |
| Base de datos | Azure Database for PostgreSQL – Flexible Server (B1ms) |
| API | Azure App Service (Linux, Node 22), comando de inicio `node dist/main.js` |
| Frontend | Azure Static Web Apps (plan Free), `app_location: web`, `output_location: dist` |

- `.github/workflows/api.yml` compila, testea y publica la API en cada push a `main`. Necesita la variable `AZURE_API_APP_NAME` y el secreto `AZURE_API_PUBLISH_PROFILE` en GitHub.
- El workflow del frontend lo genera Azure al crear la Static Web App; hay que agregarle `VITE_API_URL` con la URL de la API.
- `web/public/staticwebapp.config.json` redirige las rutas de React Router a `index.html`.
- En App Service se configuran las variables de `api/.env.example`, con `CORS_ORIGIN` y `FRONTEND_URL` apuntando a la URL del frontend.

## Decisiones y trabajo futuro

- **Sesión:** token JWT de 24 horas. El refresh token queda como mejora futura.
- **Tests de aislamiento multi-tenant:** el aislamiento se resuelve en cada servicio tomando el negocio del token; los tests automáticos específicos quedan como mejora futura.
- **Login con Google y verificación de email:** fuera de esta entrega; el registro es con email y contraseña (los invitados quedan verificados al aceptar el link).
- **Composturas:** las fotos de la pieza quedan para una próxima versión (requiere almacenamiento de archivos). La seña se registra al recibir y figura como pago de la venta de servicio al entregar.
- **Etapa 3:** cuestionario y planes, reservas con seña, recargos por cuotas y gráfico de evolución de cotizaciones.
