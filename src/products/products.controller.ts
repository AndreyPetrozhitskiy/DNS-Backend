import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ProductsService } from './products.service'

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  createProduct(@Body() body: { categoryId: number; url: string }) {
    return this.productsService.createProduct({
      category: { connect: { id: body.categoryId } },
      url: body.url,
    });
  }

  @Get()
  getAllProducts() {
    return this.productsService.getAllProducts();
  }

  @Get('category/:categoryId')
  getProductsByCategoryId(@Param('categoryId') categoryId: string) {
    return this.productsService.getProductsByCategoryId(Number(categoryId));
  }

  @Get('random')
  async getRandomProducts() {
    return this.productsService.getRandomProducts(5); // 5 — количество товаров
  }
}