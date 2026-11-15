import { Module } from '@nestjs/common';
import { NegocioController } from './negocio.controller.js';

@Module({ controllers: [NegocioController] })
export class NegocioModule {}