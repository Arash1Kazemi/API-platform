import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateModelDto,
  ExportQueryDto,
  ModelQueryDto,
  UpdateCategoryDto,
  UpdateModelDto,
} from './dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Get('models')
  models(@Query() q: ModelQueryDto) {
    return this.catalog.listModels(q);
  }
  @Get('models/:id')
  model(@Param('id') id: string) {
    return this.catalog.getModel(id);
  }
  @Get('models/:id/history')
  history(@Param('id') id: string) {
    return this.catalog.priceHistory(id);
  }
  @Post('models')
  createModel(@Body() dto: CreateModelDto) {
    return this.catalog.createModel(dto);
  }
  @Patch('models/:id')
  updateModel(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.catalog.updateModel(id, dto);
  }
  @Delete('models/:id')
  deleteModel(@Param('id') id: string) {
    return this.catalog.deleteModel(id);
  }

  /** GET /export?format=csv&category=t2i  (format defaults to json) */
  @Get('export')
  async export(@Query() q: ExportQueryDto, @Res() res: Response) {
    const { body, type } = await this.catalog.export(q.category, q.format);
    const ext = q.format === 'csv' ? 'csv' : 'json';
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `attachment; filename="models${q.category ? `-${q.category}` : ''}.${ext}"`);
    res.send(body);
  }
}
