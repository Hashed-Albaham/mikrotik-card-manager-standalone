import { z } from "zod";

export const batchMetadataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  deviceId: z.string().uuid().nullable().optional(),
  status: z.enum(["local", "cancelled"]),
  notes: z.string().trim().max(1_000).optional()
}).strict();

export function applyBatchMetadata(current, change, device) {
  if (device && String(device.version) !== String(current.routerVersion)) throw new Error("لا يمكن ربط الدفعة بجهاز إصدار مختلف، لأن سكربت RSC أنشئ للإصدار الحالي.");
  return { ...current, name: change.name, deviceId: change.deviceId ?? undefined, status: change.status, notes: change.notes ?? "" };
}
