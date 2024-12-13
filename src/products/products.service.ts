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
  async getRandomProducts(limit: number) {
    console.log('Получаем случайные продукты, limit =', limit);
    const count = await this.prisma.product.count();
    console.log('Всего продуктов в БД:', count);
    if (count === 0) return [];

    const products = await this.prisma.product.findMany({
      select: { id: true }
    });

    // Перемешиваем массив
    for (let i = products.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [products[i], products[j]] = [products[j], products[i]];
    }

    const randomIds = products.slice(0, Math.min(limit, products.length)).map(p => p.id);

    console.log('Случайно выбранные ID:', randomIds);

    return this.prisma.product.findMany({
      where: { id: { in: randomIds } },
      select: { url: true }
    });
  }
}