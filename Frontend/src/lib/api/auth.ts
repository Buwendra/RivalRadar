import { apiClient } from "./client";
import { TOS_VERSION, PRIVACY_VERSION } from "@/lib/utils/constants";

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  tosVersion?: string;
  privacyVersion?: string;
}

export interface SignUpResponse {
  userId: string;
  message: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const authApi = {
  signUp: (data: SignUpInput) =>
    apiClient<SignUpResponse>("/auth/signup", {
      method: "POST",
      body: {
        tosVersion: TOS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        ...data,
      },
      requireAuth: false,
    }),

  signIn: (data: SignInInput) =>
    apiClient<SignInResponse>("/auth/signin", {
      method: "POST",
      body: data,
      requireAuth: false,
    }),

  resendVerification: (email: string) =>
    apiClient<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: { email },
      requireAuth: false,
    }),
};
