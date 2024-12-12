import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { CategoriesService } from './categories.service'

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async createCategory(@Body() body: { name: string }) {
    const keywords = await this.categoriesService.generateKeywords(body.name);
    return this.categoriesService.createCategory({
      name: body.name,
      keywords: keywords,
    });
  }
  @Post('search')
  async searchProducts(@Body() body: { query: string }) {
    return this.categoriesService.searchProducts(body.query);
  }
  @Get()
  getAllCategories() {
    return this.categoriesService.getAllCategories();
  }

  @Get(':id')
  getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(Number(id));
  }
}

