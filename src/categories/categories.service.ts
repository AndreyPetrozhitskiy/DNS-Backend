import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import fetch from 'node-fetch'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CategoriesService {
  // Используем feature-extraction endpoint
  private HF_API_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';
  private HF_API_KEY = process.env.HUGGING_FACE_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  async createCategory(data: Prisma.CategoryCreateInput) {
    console.log('Создание категории. Имя:', data.name);
  
    if (!data.name || data.name.trim() === '') {
      throw new Error('Имя категории не может быть пустым.');
    }
  
    const category = await this.prisma.category.create({ data });
    console.log('Категория успешно создана. ID категории:', category.id);
  
    const keywords = Array.isArray(category.keywords) ? category.keywords : [];
    console.log('Ключевые слова для эмбеддинга:', keywords);
  
    if (keywords.length === 0) {
      throw new Error('Список ключевых слов не может быть пустым.');
    }
  
    const embeddings = await this.generateEmbedding(category.name, keywords);
    console.log('Сгенерированные эмбеддинги:', embeddings);
  
    await this.prisma.category.update({
      where: { id: category.id },
      data: { embedding: embeddings },
    });
  
    console.log('Категория обновлена с эмбеддингами.');
    return category;
  }

  async generateKeywords(name: string, limit = 20): Promise<string[]> {
    console.log('Генерация ключевых слов для категории:', name);

    const url = 'https://api-inference.huggingface.co/models/mistralai/Mistral-Nemo-Instruct-2407/v1/chat/completions';

    const headers = {
      Authorization: `Bearer ${this.HF_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: 'mistralai/Mistral-Nemo-Instruct-2407',
      messages: [
        { role: 'user',   content: `
          Сгенерируй список релевантных ключевых слов для категории "${name}" в контексте интернет-магазина.
          Избегай сугубо технических характеристик (например, "оперативная память", "процессор"), 
          вместо этого сосредоточься на ключевых словах, которые отражают реальные потребности и сценарии использования:
          - Различные ценовые сегменты ("бюджетный", "премиум", "акция")
          - Популярные бренды и модели
          - Специфические сценарии применения ("для путешествий", "для работы", "для игр", "для учебы")
          - Особенности, важные для покупателей (например, "долгая гарантия", "быстрая доставка", "подарочная упаковка")
      
          Выдай каждое ключевое слово или фразу на новой строке. 
          Старайся, чтобы результат был максимально полезен для реального пользователя, пришедшего в интернет-магазин.
        `},
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 0.9,
    };

    try {
      console.log('Отправка запроса для генерации ключевых слов:', body);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка от API Hugging Face. Тело ответа:', errorText);
        throw new Error(`Ошибка генерации ключевых слов: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      console.log('Ответ от API (сырой текст):', content);

      const keywords = content
        .split('\n')
        .map((keyword: string) => keyword.replace(/^\d+\.\s*/, '').trim())
        .filter((keyword: string) => keyword.length > 0);

      console.log('Ключевые слова до ограничения:', keywords);

      return keywords.slice(0, limit);
    } catch (error) {
      console.error('Ошибка при генерации ключевых слов:', error);
      return [];
    }
  }

  async searchProducts(query: string): Promise<any[]> {
    console.log('Поиск товаров. Запрос:', query);
  
    const queryEmbedding = await this.generateEmbedding(query, []);
    console.log('Эмбеддинг для запроса:', queryEmbedding);
  
    const categories = await this.prisma.category.findMany({
      include: { products: true },
    });
    console.log('Загруженные категории:', categories);

    const resultsWithSimilarity = categories.map((category) => {
      const categoryEmbedding: number[][] = category.embedding as any;
      if (!categoryEmbedding) {
        console.log(`Категория ${category.id} не имеет эмбеддингов.`);
        return { category, similarity: 0 };
      }
      const similarity = this.calculateSimilarity(queryEmbedding, categoryEmbedding);
      console.log(`Сходство для категории ${category.id} (${category.name}):`, similarity);
      return { category, similarity };
    });

    console.log('Результаты до фильтрации:', resultsWithSimilarity);

    // Понизим порог для демонстрации
    const filteredResults = resultsWithSimilarity
      .filter((result) => result.similarity > 0.75);
// 
    console.log('Результаты после фильтрации по сходству > 0.2:', filteredResults);

    const products = filteredResults.flatMap((result) => result.category.products);
    console.log('Товары из отфильтрованных категорий:', products);

    return products;
  }

  private calculateSimilarity(vecA: number[][], vecB: number[][]): number {
    // Предполагается, что vecA и vecB — это уже усреднённые эмбеддинги предложений (один массив чисел для каждого предложения)
    // Если у нас только по одному предложению в запросе, то vecA и vecB должны быть 1-векторными массивами.
    // Допустим, для простоты берем первый вектор, если есть несколько.
    const flattenA = vecA[0]; 
    const flattenB = vecB[0]; 
  
    const dotProduct = flattenA.reduce((sum, a, i) => sum + a * flattenB[i], 0);
    const magnitudeA = Math.sqrt(flattenA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(flattenB.reduce((sum, b) => sum + b * b, 0));
  
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async generateEmbedding(source: string, sentences: string[]): Promise<number[][]> {
    console.log('Генерация эмбеддингов для текста:', source);
    console.log('Сравнительные предложения:', sentences);
  
    if (!source || source.trim() === '') {
      throw new Error('Основной текст не может быть пустым.');
    }
  
    const allSentences = sentences.length > 0 ? [source, ...sentences] : [source];
  
    const headers = {
      Authorization: `Bearer ${this.HF_API_KEY}`,
      'Content-Type': 'application/json',
    };
  
    const body = {
      inputs: allSentences
    };
  
    try {
      console.log('Отправка запроса на Hugging Face API. Тело запроса:', JSON.stringify(body));
  
      const response = await fetch(this.HF_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      console.log('Ответ от API Hugging Face:', response);
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка от API Hugging Face. Тело ответа:', errorText);
        throw new Error(`Ошибка генерации эмбеддингов: ${response.status} - ${errorText}`);
      }
  
      const data = await response.json();
      console.log('Сырой ответ от API после парсинга:', data);
  
      // Проверяем формат: ожидаем что data — массив массивов чисел (каждый элемент — уже sentence embedding)
      if (!Array.isArray(data) || !Array.isArray(data[0]) || typeof data[0][0] !== 'number') {
        console.error('Неверный формат эмбеддингов. Ожидался массив массивов чисел.');
        throw new Error('Неверный формат эмбеддингов. Ожидался массив массивов чисел.');
      }
  
      // Если сюда дошли — у нас уже готовые эмбеддинги для каждого предложения, ничего усреднять не нужно
      console.log('Эмбеддинги успешно получены:', data);
      return data; // Это уже подходящий формат: массив векторов для каждого предложения
    } catch (error) {
      console.error('Ошибка при генерации эмбеддингов:', error);
      throw error;
    }
  }

  getAllCategories() {
    console.log('Получение всех категорий из базы данных.');
    return this.prisma.category.findMany();
  }
  
  getCategoryById(id: number) {
    console.log(`Получение категории с ID: ${id} из базы данных.`);
    return this.prisma.category.findUnique({ where: { id } });
  }
}
