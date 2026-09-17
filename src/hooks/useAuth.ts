"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginData, SignupData } from "../lib/api/auth";
import * as authApi from "../lib/api/auth";

export const useAuth = () => {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(["currentUser"], data.user);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: (data) => {
      queryClient.setQueryData(["currentUser"], data.user);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(["currentUser"], null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: (data: LoginData) => loginMutation.mutateAsync(data),
    signup: (data: SignupData) => signupMutation.mutateAsync(data),
    logout: () => logoutMutation.mutateAsync(),
    isLoginLoading: loginMutation.isPending,
    isSignupLoading: signupMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
};
