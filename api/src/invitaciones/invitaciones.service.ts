import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  EstadoInvitacion,
  Prisma,
  ProveedorAuth,
  Rol,
} from '../generated/prisma/client.js';
import { generarToken, hashToken } from '../common/tokens.js';
import { esErrorUnico } from '../common/prisma-errors.js';
import type { UsuarioActual } from '../auth/types.js';
import { CrearInvitacionDto } from './dto/crear-invitacion.dto.js';
import { AceptarInvitacionDto } from './dto/aceptar-invitacion.dto.js';

const HORAS_VIGENCIA = 72;

const incluir = {
  negocio: { select: { id: true, nombre: true } },
  invitadoPor: { select: { nombre: true, email: true } },
} satisfies Prisma.InvitacionInclude;

export type InvitacionConDatos = Prisma.InvitacionGetPayload<{ include: typeof incluir }>;

const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'administrador',
  GERENTE: 'gerente',
  VENDEDOR: 'vendedor',
};

function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger('Invitaciones');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  // ---------- Para admin y gerente ----------

  async crear(dto: CrearInvitacionDto, user: UsuarioActual) {
    const email = dto.email.trim().toLowerCase();
    const tiendaIds = dto.tiendaIds ?? [];

    await this.validarPermisos(dto.rol, tiendaIds, user);
    await this.validarTiendas(tiendaIds, user.negocioId);

    const yaEsMiembro = await this.prisma.membresia.findFirst({
      where: { negocioId: user.negocioId, usuario: { email } },
    });
    if (yaEsMiembro) throw new ConflictException('Esa persona ya forma parte del negocio');

    const pendiente = await this.prisma.invitacion.findFirst({
      where: {
        negocioId: user.negocioId,
        email,
        estado: EstadoInvitacion.PENDIENTE,
        venceEn: { gt: new Date() },
      },
    });
    if (pendiente) {
      throw new ConflictException('Ya hay una invitación pendiente para ese email. Podés reenviarla.');
    }

    const { token, hash: tokenHash } = generarToken();
    const invitacion = await this.prisma.invitacion.create({
      data: {
        negocioId: user.negocioId,
        email,
        rol: dto.rol,
        topeDescuento: dto.topeDescuento ?? 0,
        tiendaIds,
        tokenHash,
        venceEn: this.vencimiento(),
        invitadoPorId: user.usuarioId,
      },
      include: incluir,
    });

    const emailEnviado = await this.enviarEmail(invitacion, token);
    return { ...this.presentar(invitacion), emailEnviado };
  }

  async listar(user: UsuarioActual) {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: {
        negocioId: user.negocioId,
        // El gerente ve solo las que envió él
        invitadoPorId: user.rol === Rol.GERENTE ? user.usuarioId : undefined,
      },
      include: incluir,
      orderBy: { creadoEn: 'desc' },
    });
    return invitaciones.map((i) => this.presentar(i));
  }

  // Genera un token nuevo (el anterior deja de servir) y renueva el vencimiento
  async reenviar(id: string, user: UsuarioActual) {
    const actual = await this.buscar(id, user);
    if (actual.estado !== EstadoInvitacion.PENDIENTE) {
      throw new ConflictException(`La invitación está ${actual.estado.toLowerCase()}`);
    }

    const { token, hash: tokenHash } = generarToken();
    const invitacion = await this.prisma.invitacion.update({
      where: { id },
      data: { tokenHash, venceEn: this.vencimiento() },
      include: incluir,
    });

    const emailEnviado = await this.enviarEmail(invitacion, token);
    return { ...this.presentar(invitacion), emailEnviado };
  }

  async cancelar(id: string, user: UsuarioActual) {
    const actual = await this.buscar(id, user);
    if (actual.estado !== EstadoInvitacion.PENDIENTE) {
      throw new ConflictException(`La invitación está ${actual.estado.toLowerCase()}`);
    }
    const invitacion = await this.prisma.invitacion.update({
      where: { id },
      data: { estado: EstadoInvitacion.CANCELADA },
      include: incluir,
    });
    return this.presentar(invitacion);
  }

  // ---------- Públicos (los usa el invitado desde el link) ----------

  // Datos para mostrar en la pantalla de "aceptar invitación"
  async consultar(token: string) {
    const invitacion = await this.buscarVigente(token);
    const cuenta = await this.prisma.usuario.findUnique({
      where: { email: invitacion.email },
      select: { id: true },
    });
    return {
      email: invitacion.email,
      rol: invitacion.rol,
      negocio: invitacion.negocio.nombre,
      invitadoPor: invitacion.invitadoPor.nombre ?? invitacion.invitadoPor.email,
      venceEn: invitacion.venceEn,
      tieneCuenta: cuenta !== null,
    };
  }

  async aceptar(dto: AceptarInvitacionDto) {
    const invitacion = await this.buscarVigente(dto.token);
    const existente = await this.prisma.usuario.findUnique({ where: { email: invitacion.email } });

    if (existente) {
      // Ya tiene cuenta: confirma que es él con su contraseña actual
      const ok = existente.passwordHash && (await compare(dto.password, existente.passwordHash));
      if (!ok) throw new UnauthorizedException('La contraseña no coincide con la de tu cuenta');
    } else if (!dto.nombre?.trim()) {
      throw new BadRequestException('El nombre es obligatorio para crear tu cuenta');
    }

    // Solo las tiendas que siguen activas
    const tiendas = await this.prisma.tienda.findMany({
      where: { id: { in: invitacion.tiendaIds }, negocioId: invitacion.negocioId, activa: true },
      select: { id: true },
    });
    const passwordHash = existente ? null : await hash(dto.password, 10);

    try {
      const { usuario, membresia } = await this.prisma.$transaction(async (tx) => {
        // Se marca como usada de forma atómica: si se acepta dos veces a la vez, solo una gana
        const r = await tx.invitacion.updateMany({
          where: { id: invitacion.id, estado: EstadoInvitacion.PENDIENTE },
          data: { estado: EstadoInvitacion.ACEPTADA, aceptadaEn: new Date() },
        });
        if (r.count === 0) throw new GoneException('La invitación ya fue usada');

        const usuario =
          existente ??
          (await tx.usuario.create({
            data: {
              email: invitacion.email,
              nombre: dto.nombre!.trim(),
              proveedorAuth: ProveedorAuth.EMAIL,
              passwordHash,
              verificado: true, // abrir el link del email demuestra que el email es suyo
            },
          }));

        const membresia = await tx.membresia.create({
          data: {
            usuarioId: usuario.id,
            negocioId: invitacion.negocioId,
            rol: invitacion.rol,
            topeDescuento: invitacion.topeDescuento,
            tiendas: { create: tiendas.map((t) => ({ tiendaId: t.id })) },
          },
          include: { negocio: true },
        });

        return { usuario, membresia };
      });

      // Devuelve la sesión iniciada en el negocio que lo invitó
      return this.auth.armarRespuesta(usuario, membresia);
    } catch (e) {
      if (esErrorUnico(e)) throw new ConflictException('Ya formás parte de este negocio');
      throw e;
    }
  }

  // ---------- Internos ----------

  private async validarPermisos(rol: Rol, tiendaIds: string[], user: UsuarioActual) {
    if (user.rol === Rol.ADMIN) return;

    // Gerente: solo vendedores y solo a sus tiendas
    if (rol !== Rol.VENDEDOR) throw new ForbiddenException('Un gerente solo puede invitar vendedores');
    if (tiendaIds.length === 0) throw new BadRequestException('Indicá al menos una de tus tiendas');

    const asignadas = await this.prisma.usuarioTienda.findMany({
      where: { membresiaId: user.membresiaId },
      select: { tiendaId: true },
    });
    const misTiendas = asignadas.map((a) => a.tiendaId);
    if (tiendaIds.some((id) => !misTiendas.includes(id))) {
      throw new ForbiddenException('Solo podés asignar tiendas que tenés asignadas');
    }
  }

  private async validarTiendas(tiendaIds: string[], negocioId: string) {
    if (tiendaIds.length === 0) return;
    const cantidad = await this.prisma.tienda.count({
      where: { id: { in: tiendaIds }, negocioId, activa: true },
    });
    if (cantidad !== tiendaIds.length) {
      throw new BadRequestException('Alguna de las tiendas no existe, está inactiva o no es de tu negocio');
    }
  }

  private async buscar(id: string, user: UsuarioActual) {
    const invitacion = await this.prisma.invitacion.findFirst({
      where: {
        id,
        negocioId: user.negocioId,
        invitadoPorId: user.rol === Rol.GERENTE ? user.usuarioId : undefined,
      },
    });
    if (!invitacion) throw new NotFoundException('Invitación no encontrada');
    return invitacion;
  }

  // Mismo mensaje para "no existe", "usada", "cancelada" y "vencida": no damos pistas
  private async buscarVigente(token: string) {
    const invitacion = await this.prisma.invitacion.findUnique({
      where: { tokenHash: hashToken(token) },
      include: incluir,
    });
    if (
      !invitacion ||
      invitacion.estado !== EstadoInvitacion.PENDIENTE ||
      invitacion.venceEn < new Date()
    ) {
      throw new GoneException('La invitación no es válida o ya venció');
    }
    return invitacion;
  }

  private vencimiento() {
    return new Date(Date.now() + HORAS_VIGENCIA * 3_600_000);
  }

  // Si el email falla, la invitación queda creada y se puede reenviar
  private async enviarEmail(invitacion: InvitacionConDatos, token: string) {
    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const link = `${frontend}/invitacion?token=${token}`;
    const quien = invitacion.invitadoPor.nombre ?? invitacion.invitadoPor.email;
    const negocio = invitacion.negocio.nombre;
    const rol = NOMBRE_ROL[invitacion.rol];
    const vence = invitacion.venceEn.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    const html = `
      <p>Hola,</p>
      <p><b>${escaparHtml(quien)}</b> te invitó a sumarte a <b>${escaparHtml(negocio)}</b> en QuilateAr como <b>${rol}</b>.</p>
      <p><a href="${link}">Aceptar invitación</a></p>
      <p>El link vence el ${vence} y se puede usar una sola vez.</p>`;
    const texto = `${quien} te invitó a sumarte a ${negocio} en QuilateAr como ${rol}.\nAceptá la invitación acá: ${link}\nEl link vence el ${vence}.`;

    try {
      await this.mail.enviar(invitacion.email, `Te invitaron a ${negocio} en QuilateAr`, html, texto);
      return true;
    } catch (e) {
      this.logger.warn(`No se pudo enviar el email a ${invitacion.email}: ${(e as Error).message}`);
      return false;
    }
  }

  private presentar(i: InvitacionConDatos) {
    const { tokenHash, ...datos } = i;
    const vencida = i.estado === EstadoInvitacion.PENDIENTE && i.venceEn < new Date();
    return { ...datos, estado: vencida ? 'VENCIDA' : i.estado };
  }
}