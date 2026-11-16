import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter;
  private readonly remitente: string;

  constructor(config: ConfigService) {
    const usuario = config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get('SMTP_PORT', 1025)),
      secure: config.get('SMTP_SECURE') === 'true',
      // Mailpit no pide usuario. En producción se completa SMTP_USER y SMTP_PASS.
      auth: usuario ? { user: usuario, pass: config.get<string>('SMTP_PASS') } : undefined,
    });
    this.remitente = config.get<string>('MAIL_FROM', 'QuilateAr <no-responder@quilatear.local>');
  }

  async enviar(para: string, asunto: string, html: string, texto: string) {
    await this.transporter.sendMail({ from: this.remitente, to: para, subject: asunto, html, text: texto });
    this.logger.log(`Enviado a ${para}: ${asunto}`);
  }
}