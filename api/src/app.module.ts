import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TiendasModule } from './tiendas/tiendas.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { NegocioModule } from './negocio/negocio.module.js';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module.js';
import { PreciosModule } from './precios/precios.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { CategoriasModule } from './categorias/categorias.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { StockModule } from './stock/stock.module.js';
import { MailModule } from './mail/mail.module.js';
import { InvitacionesModule } from './invitaciones/invitaciones.module.js';
import { VentasModule } from './ventas/ventas.module.js';
import { ClientesModule } from './clientes/clientes.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    TiendasModule,
    UsuariosModule,
    NegocioModule,
    CotizacionesModule,
    PreciosModule,
    CategoriasModule,
    ProductosModule,
    ProductosModule,
    StockModule,
    InvitacionesModule,
    VentasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    VentasModule,
    ClientesModule,
  ],
})
export class AppModule {}