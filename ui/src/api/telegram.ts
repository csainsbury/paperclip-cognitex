import { api } from "./client";

export interface TelegramSettings {
  isLinked: boolean;
  isActive: boolean;
  telegramUsername: string | null;
  verifiedAt: string | null;
}

export interface LinkTelegramRequest {
  telegramChatId: string;
  telegramUsername?: string;
}

export interface LinkTelegramResponse {
  id: string;
  verificationCode: string;
  message: string;
}

export interface VerifyTelegramRequest {
  verificationCode: string;
}

export interface VerifyTelegramResponse {
  success: boolean;
  message: string;
}

export interface TestNotificationRequest {
  message?: string;
}

export interface TestNotificationResponse {
  success: boolean;
}

export const telegramApi = {
  getSettings: (companyId: string) =>
    api.get<TelegramSettings>(`/companies/${companyId}/telegram/settings`),

  link: (companyId: string, data: LinkTelegramRequest) =>
    api.post<LinkTelegramResponse>(`/companies/${companyId}/telegram/link`, data),

  verify: (companyId: string, data: VerifyTelegramRequest) =>
    api.post<VerifyTelegramResponse>(`/companies/${companyId}/telegram/verify`, data),

  unlink: (companyId: string) =>
    api.delete<{ success: boolean }>(`/companies/${companyId}/telegram/link`),

  test: (companyId: string, data?: TestNotificationRequest) =>
    api.post<TestNotificationResponse>(`/companies/${companyId}/telegram/test`, data ?? {}),
};
