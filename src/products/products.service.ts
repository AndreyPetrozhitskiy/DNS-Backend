import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  createProduct(data: Prisma.ProductCreateInput) {
    return this.prisma.product.create({ data });
  }

  getAllProducts() {
    return this.prisma.product.findMany({ include: { category: true } });
  }

  getProductsByCategoryId(categoryId: number) {
    return this.prisma.product.findMany({
      where: { categoryId },
      include: { category: true },
    });
  }
}