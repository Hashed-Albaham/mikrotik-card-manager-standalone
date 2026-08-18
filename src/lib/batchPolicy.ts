import type { Batch, Device } from "./model";

export type BatchMetadataChange = { name: string; deviceId?: string; status: "local" | "cancelled"; notes?: string };

export function updateBatchMetadata(batch: Batch, change: BatchMetadataChange, device?: Pick<Device, "id" | "version">) {
  if (!change.name.trim()) throw new Error("اسم الدفعة مطلوب.");
  if (device && device.version !== batch.routerVersion) throw new Error("لا يمكن ربط الدفعة بجهاز إصدار مختلف، لأن سكربت RSC أنشئ للإصدار الحالي.");
  if (batch.status === "sent" && change.status === "local") throw new Error("لا يمكن إعادة دفعة مُرسلة إلى الحالة المحلية.");
  return { ...batch, name: change.name.trim(), deviceId: change.deviceId, status: change.status, notes: change.notes?.trim() };
}
