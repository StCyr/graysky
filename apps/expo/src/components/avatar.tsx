import { View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { useAgent } from "~/lib/agent";
import { cx } from "~/lib/utils/cx";

interface Props {
  size?: "large" | "medium" | "small";
}

export const Avatar = ({ size = "large" }: Props) => (
  <ErrorBoundary
    fallback={
      <View
        className={cx("rounded-full bg-neutral-200 dark:bg-neutral-800", {
          "h-7 w-7": size === "small",
          "h-10 w-10": size === "medium",
          "h-12 w-12": size === "large",
        })}
      />
    }
  >
    <AvatarInner size={size} />
  </ErrorBoundary>
);

const AvatarInner = ({ size }: Props) => {
  const agent = useAgent();

  const profile = useQuery({
    queryKey: ["profile", agent.session?.did],
    queryFn: async () => {
      if (!agent.session) return null;
      const profile = await agent.getProfile({
        actor: agent.session.did,
      });
      return profile.data;
    },
  });

  return (
    <Image
      source={{ uri: profile.data?.avatar }}
      alt={profile.data?.displayName}
      className={cx(
        "rounded-full bg-neutral-200 object-cover dark:bg-neutral-800",
        {
          "h-7 w-7": size === "small",
          "h-10 w-10": size === "medium",
          "h-12 w-12": size === "large",
        },
      )}
    />
  );
};
