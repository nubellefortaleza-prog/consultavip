import { z } from "zod";
import {
  getAppSettings,
  listUsers,
  updateAppSettings,
  updateUserRole,
} from "../db";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  settings: router({
    get: adminProcedure.query(async () => {
      const settings = await getAppSettings();
      return {
        aiApiKeyConfigured: Boolean(settings?.aiApiKey),
        webhookUrl: settings?.webhookUrl ?? null,
        webhookEnabled: settings?.webhookEnabled ?? false,
        googleCalendarEnabled: settings?.googleCalendarEnabled ?? false,
      };
    }),

    update: adminProcedure
      .input(
        z.object({
          aiApiKey: z.string().min(10).optional(),
          webhookUrl: z.string().url().optional().nullable(),
          webhookEnabled: z.boolean().optional(),
          googleCalendarEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updated = await updateAppSettings({
          aiApiKey: input.aiApiKey,
          webhookUrl: input.webhookUrl,
          webhookEnabled: input.webhookEnabled,
          googleCalendarEnabled: input.googleCalendarEnabled,
        });
        return {
          success: true,
          aiApiKeyConfigured: Boolean(updated?.aiApiKey),
          webhookUrl: updated?.webhookUrl ?? null,
          webhookEnabled: updated?.webhookEnabled ?? false,
          googleCalendarEnabled: updated?.googleCalendarEnabled ?? false,
        };
      }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      const users = await listUsers();
      return users.map(u => ({
        id: u.id,
        openId: u.openId,
        name: u.name,
        email: u.email,
        role: u.role,
        lastSignedIn: u.lastSignedIn,
      }));
    }),

    setRole: adminProcedure
      .input(
        z.object({
          openId: z.string().min(1),
          role: z.enum(["user", "admin", "recorder"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateUserRole(input.openId, input.role);
        return { success: true };
      }),
  }),
});
