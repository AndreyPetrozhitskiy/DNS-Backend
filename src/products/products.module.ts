import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'

@Module({
  imports: [PrismaModule], // Добавляем PrismaModule
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}