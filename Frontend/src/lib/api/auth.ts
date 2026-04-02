import { apiClient } from "./client";

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
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
      body: data,
      requireAuth: false,
    }),

  signIn: (data: SignInInput) =>
    apiClient<SignInResponse>("/auth/signin", {
      method: "POST",
      body: data,
      requireAuth: false,
    }),
};
