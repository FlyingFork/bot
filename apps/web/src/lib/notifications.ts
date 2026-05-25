import { prisma, type NotificationType } from "@tiles-survive/database";
import { hasRole } from "@/lib/roles";

type Locale = "en" | "ru" | "tr";

export type NotificationTemplate =
  | "uploadSubmitted"
  | "uploadApproved"
  | "uploadRejected"
  | "accountVerified"
  | "eventCreated";

type Values = Record<string, string | number | null | undefined>;

const COPY: Record<Locale, Record<NotificationTemplate, { title: string; message: string }>> = {
  en: {
    uploadSubmitted: {
      title: "Upload submitted",
      message: "{submitter} submitted {uploadType} for review.",
    },
    uploadApproved: {
      title: "Upload approved",
      message: "Your {uploadType} upload was approved.",
    },
    uploadRejected: {
      title: "Upload rejected",
      message: "Your {uploadType} upload was rejected: {note}",
    },
    accountVerified: {
      title: "Account verified",
      message: "Your account has been verified and activated.",
    },
    eventCreated: {
      title: "Event created",
      message: "{eventName} was created.",
    },
  },
  ru: {
    uploadSubmitted: {
      title: "Загрузка отправлена",
      message: "{submitter} отправил(а) {uploadType} на проверку.",
    },
    uploadApproved: {
      title: "Загрузка одобрена",
      message: "Ваша загрузка {uploadType} одобрена.",
    },
    uploadRejected: {
      title: "Загрузка отклонена",
      message: "Ваша загрузка {uploadType} отклонена: {note}",
    },
    accountVerified: {
      title: "Аккаунт подтвержден",
      message: "Ваш аккаунт подтвержден и активирован.",
    },
    eventCreated: {
      title: "Событие создано",
      message: "Создано событие {eventName}.",
    },
  },
  tr: {
    uploadSubmitted: {
      title: "Yükleme gönderildi",
      message: "{submitter}, {uploadType} için inceleme gönderdi.",
    },
    uploadApproved: {
      title: "Yükleme onaylandı",
      message: "{uploadType} yüklemeniz onaylandı.",
    },
    uploadRejected: {
      title: "Yükleme reddedildi",
      message: "{uploadType} yüklemeniz reddedildi: {note}",
    },
    accountVerified: {
      title: "Hesap doğrulandı",
      message: "Hesabınız doğrulandı ve etkinleştirildi.",
    },
    eventCreated: {
      title: "Etkinlik oluşturuldu",
      message: "{eventName} oluşturuldu.",
    },
  },
};

function fill(template: string, values: Values = {}) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

function localeOf(value: unknown): Locale {
  return value === "ru" || value === "tr" ? value : "en";
}

export function notificationCopy(locale: unknown, template: NotificationTemplate, values?: Values) {
  const copy = COPY[localeOf(locale)][template];
  return {
    title: fill(copy.title, values),
    message: fill(copy.message, values),
  };
}

export function notificationData(template: NotificationTemplate, values?: Values, data?: object) {
  return {
    ...(data ?? {}),
    template,
    values: values ?? {},
  };
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  template: NotificationTemplate,
  values?: Values,
  data?: object,
) {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  const copy = notificationCopy(recipient?.language, template, values);
  await prisma.notification.create({
    data: {
      userId,
      type,
      title: copy.title,
      message: copy.message,
      data: notificationData(template, values, data) as never,
    },
  });
}

export async function notifyAllAdmins(
  type: NotificationType,
  template: NotificationTemplate,
  values?: Values,
  data?: object,
) {
  const admins = await prisma.user.findMany({
    where: { role: "admin", platformStatus: "ACTIVE" },
    select: { id: true },
  });
  await Promise.all(admins.map((admin) => createNotification(admin.id, type, template, values, data)));
}

export async function notifyR4Plus(
  type: NotificationType,
  template: NotificationTemplate,
  values?: Values,
  data?: object,
) {
  const users = await prisma.user.findMany({
    where: { platformStatus: "ACTIVE" },
    select: { id: true, role: true },
  });
  await Promise.all(
    users
      .filter((user) => hasRole(user.role, "r4"))
      .map((user) => createNotification(user.id, type, template, values, data)),
  );
}
