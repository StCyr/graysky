import { useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Animated, { FadeIn } from "react-native-reanimated";
import { showToastable } from "react-native-toastable";
import { useTheme } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2Icon } from "lucide-react-native";
import { z } from "zod";

import { useAgent } from "~/lib/agent";
import { Text } from "./text";
import { TextButton } from "./text-button";

class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordError";
  }
}

interface Props {
  defaultEmail?: string;
}

export const ChangePasswordFlow = ({ defaultEmail = "" }: Props) => {
  const theme = useTheme();
  const agent = useAgent();

  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>(defaultEmail);
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>("");

  const sendEmail = useMutation({
    mutationKey: ["send-reset-email"],
    mutationFn: async () => {
      await agent.com.atproto.server.requestPasswordReset({
        email,
      });
    },
    onSettled: () => setStage(2),
  });

  const changePassword = useMutation({
    mutationKey: ["change-password"],
    mutationFn: async () => {
      if (newPassword.length < 8) {
        throw new PasswordError("Password must be at least 8 characters");
      }
      await agent.com.atproto.server.resetPassword({
        password: newPassword,
        token: token.trim(),
      });
    },
    onSuccess: () => setStage(3),
    onError: (err) => {
      if (err instanceof PasswordError) {
        showToastable({
          title: err.message,
          message: "Please try again",
          status: "danger",
        });
      } else {
        console.error(err);
        showToastable({
          title: "An error occured",
          message:
            "Please try again - are you sure your reset code is correct?",
          status: "danger",
        });
      }
    },
  });

  switch (stage) {
    case 1:
      return (
        <KeyboardAwareScrollView className="flex-1 px-4">
          <View className="my-4 flex-1">
            <Text className="mx-4 mb-1 mt-4 text-xs uppercase text-neutral-500">
              Email
            </Text>
            <View
              style={{ backgroundColor: theme.colors.card }}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <TextInput
                value={email}
                autoComplete="email"
                placeholder="alice@example.com"
                onChange={(evt) => setEmail(evt.nativeEvent.text)}
                className="flex-1 flex-row items-center px-4 py-3 text-base leading-5"
                style={{ color: theme.colors.text }}
                placeholderTextColor={theme.dark ? "#525255" : "#C6C6C8"}
                keyboardAppearance={theme.dark ? "dark" : "light"}
              />
            </View>
          </View>
          <View className="flex-row items-center justify-end pt-2">
            {!sendEmail.isLoading ? (
              <TextButton
                disabled={!z.string().email().safeParse(email).success}
                onPress={() => sendEmail.mutate()}
                title="Send reset email"
                className="font-medium"
              />
            ) : (
              <ActivityIndicator className="px-2" />
            )}
          </View>
        </KeyboardAwareScrollView>
      );
    case 2:
      return (
        <KeyboardAwareScrollView className="flex-1 px-4">
          <View className="my-4 flex-1">
            <Text className="mx-4 mb-1 mt-4 text-xs uppercase text-neutral-500">
              Reset Code
            </Text>
            <View
              style={{ backgroundColor: theme.colors.card }}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <TextInput
                value={token}
                placeholder="ABCDE-ABCDE"
                onChange={(evt) => setToken(evt.nativeEvent.text)}
                className="flex-1 flex-row items-center px-4 py-3 text-base leading-5"
                style={{ color: theme.colors.text }}
                placeholderTextColor={theme.dark ? "#525255" : "#C6C6C8"}
                keyboardAppearance={theme.dark ? "dark" : "light"}
              />
            </View>
          </View>
          <View className="flex-1">
            <Text className="mx-4 mb-1 mt-4 text-xs uppercase text-neutral-500">
              New Password
            </Text>
            <View
              style={{ backgroundColor: theme.colors.card }}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <View
                style={{ backgroundColor: theme.colors.card }}
                className="flex-1 overflow-hidden rounded-lg"
              >
                <TextInput
                  value={newPassword}
                  secureTextEntry
                  onChange={(evt) => setNewPassword(evt.nativeEvent.text)}
                  className="flex-1 flex-row items-center px-4 py-3 text-base leading-5"
                  style={{ color: theme.colors.text }}
                  placeholderTextColor={theme.dark ? "#525255" : "#C6C6C8"}
                  keyboardAppearance={theme.dark ? "dark" : "light"}
                />
              </View>
            </View>
          </View>
          <View className="mb-4 flex-1">
            <Text className="mx-4 mb-1 mt-4 text-xs uppercase text-neutral-500">
              Confirm Password
            </Text>
            <View
              style={{ backgroundColor: theme.colors.card }}
              className="flex-1 overflow-hidden rounded-lg"
            >
              <View
                style={{ backgroundColor: theme.colors.card }}
                className="flex-1 overflow-hidden rounded-lg"
              >
                <TextInput
                  value={newPasswordConfirm}
                  secureTextEntry
                  onChange={(evt) =>
                    setNewPasswordConfirm(evt.nativeEvent.text)
                  }
                  className="flex-1 flex-row items-center px-4 py-3 text-base leading-5"
                  style={{ color: theme.colors.text }}
                  placeholderTextColor={theme.dark ? "#525255" : "#C6C6C8"}
                  keyboardAppearance={theme.dark ? "dark" : "light"}
                />
              </View>
            </View>
          </View>
          <View className="flex-row items-center justify-between pt-2">
            <TextButton onPress={() => setStage(1)} title="Back" />
            {!changePassword.isLoading ? (
              <TextButton
                disabled={
                  !token || !newPassword || newPassword !== newPasswordConfirm
                }
                onPress={() => changePassword.mutate()}
                title="Save"
                className="font-medium"
              />
            ) : (
              <ActivityIndicator className="px-2" />
            )}
          </View>
        </KeyboardAwareScrollView>
      );
    case 3:
      return (
        <Animated.View
          entering={FadeIn}
          className="flex-1 items-center justify-center"
        >
          <CheckCircle2Icon size={64} color={theme.colors.primary} />
          <Text className="mt-8 text-center text-lg font-medium">
            Password changed successfully!
          </Text>
        </Animated.View>
      );
  }
};
