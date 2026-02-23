import { z } from 'zod';
import { insertUserSchema, users, fortunes } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  telegramChatId: z.string().nullable().optional(),
  telegramHandle: z.string().nullable().optional(),
  birthDate: z.string().optional(),
  birthTime: z.string().optional(),
  gender: z.string().optional(),
  mbti: z.string().nullable().optional(),
  birthCountry: z.string().nullable().optional(),
  birthCity: z.string().nullable().optional(),
  preferredDeliveryTime: z.string().optional(),
});

export const api = {
  users: {
    create: {
      method: 'POST' as const,
      path: '/api/users' as const,
      input: insertUserSchema.extend({
        telegramId: z.string().optional().default(""),
        telegramHandle: z.string().optional(),
        linkToken: z.string().optional(),
        preferredDeliveryTime: z.string().default("07:00"),
        mbti: z.string().nullable().optional(),
        birthCountry: z.string().nullable().optional(),
        birthCity: z.string().nullable().optional(),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        409: z.object({ message: z.string() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:telegramId' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:telegramId' as const,
      input: updateUserSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  fortunes: {
    generate: {
      method: 'POST' as const,
      path: '/api/fortunes/generate' as const,
      input: z.object({
        telegramId: z.string(),
      }),
      responses: {
        201: z.object({
          message: z.string(),
          fortune: z.custom<typeof fortunes.$inferSelect>()
        }),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/fortunes/:telegramId' as const,
      responses: {
        200: z.array(z.custom<typeof fortunes.$inferSelect>()),
        404: errorSchemas.notFound,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
