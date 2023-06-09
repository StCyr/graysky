import { useRef, useState } from "react";
import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  AppBskyFeedPost,
  ComAtprotoModerationDefs,
  type AppBskyFeedDefs,
} from "@atproto/api";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useComposer } from "../../components/composer";
import { useLists } from "../../components/lists/context";
import { blockAccount, muteAccount } from "../account-actions";
import { useAuthedAgent } from "../agent";
import { assert } from "../utils/assert";
import { useColorScheme } from "../utils/color-scheme";

export const useLike = (
  post: AppBskyFeedDefs.FeedViewPost["post"],
  updated: number,
) => {
  const agent = useAuthedAgent();
  const cid = useRef(post.cid);
  const lastUpdate = useRef(updated);

  const [liked, setLiked] = useState(!!post.viewer?.like);
  const [likeUri, setLikeUri] = useState(post.viewer?.like);

  const toggleLike = useMutation({
    onMutate: () => void Haptics.impactAsync(),
    mutationKey: ["like", post.uri],
    mutationFn: async () => {
      if (!likeUri) {
        try {
          setLiked(true);
          const like = await agent.like(post.uri, post.cid);
          setLikeUri(like.uri);
        } catch (err) {
          setLiked(false);
          console.warn(err);
        }
      } else {
        try {
          setLiked(false);
          await agent.deleteLike(likeUri);
          setLikeUri(undefined);
        } catch (err) {
          setLiked(true);
          console.warn(err);
        }
      }
    },
  });

  // reset like/repost state if cid or timestamp changes
  if (post.cid !== cid.current || updated !== lastUpdate.current) {
    cid.current = post.cid;
    lastUpdate.current = updated;
    setLiked(!!post.viewer?.like);
    setLikeUri(post.viewer?.like);
    toggleLike.reset();
  }

  return {
    liked,
    likeCount:
      (post.likeCount ?? 0) + (liked && likeUri !== post.viewer?.like ? 1 : 0),
    toggleLike,
  };
};

export const useRepost = (
  post: AppBskyFeedDefs.FeedViewPost["post"],
  updated: number,
) => {
  const agent = useAuthedAgent();
  const cid = useRef(post.cid);
  const lastUpdate = useRef(updated);

  const [reposted, setReposted] = useState(!!post.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post.viewer?.repost);

  const toggleRepost = useMutation({
    onMutate: () => void Haptics.impactAsync(),
    mutationKey: ["repost", post.uri],
    mutationFn: async () => {
      if (!repostUri) {
        try {
          setReposted(true);
          const repost = await agent.repost(post.uri, post.cid);
          setRepostUri(repost.uri);
        } catch (err) {
          setReposted(false);
          console.warn(err);
        }
      } else {
        try {
          setReposted(false);
          await agent.deleteRepost(repostUri);
          setRepostUri(undefined);
        } catch (err) {
          setReposted(true);
          console.warn(err);
        }
      }
    },
  });

  // reset like/repost state if cid or timestamp changes
  if (post.cid !== cid.current || updated !== lastUpdate.current) {
    cid.current = post.cid;
    lastUpdate.current = updated;
    setReposted(!!post.viewer?.repost);
    setRepostUri(post.viewer?.repost);
    toggleRepost.reset();
  }

  return {
    reposted,
    repostCount:
      (post.repostCount ?? 0) +
      (reposted && repostUri !== post.viewer?.repost ? 1 : 0),
    toggleRepost,
  };
};

export const usePostViewOptions = (post: AppBskyFeedDefs.PostView) => {
  const { showActionSheetWithOptions } = useActionSheet();
  const { colorScheme } = useColorScheme();
  const agent = useAuthedAgent();
  const { openLikes, openReposts } = useLists();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleMore = () => {
    void Haptics.impactAsync();
    const options =
      post.author.handle === agent.session.handle
        ? [
            "Translate",
            "Copy post text",
            "Share post",
            "See likes",
            "Delete post",
            "Cancel",
          ]
        : [
            "Translate",
            "Copy post text",
            "Share post",
            "See likes",
            "See reposts",
            post.author.viewer?.muted ? "" : `Mute @${post.author.handle}`,
            post.author.viewer?.blocking ? "" : `Block @${post.author.handle}`,
            "Report post",
            "Cancel",
          ].filter(Boolean);
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        userInterfaceStyle: colorScheme,
      },
      async (index) => {
        if (index === undefined) return;
        switch (options[index]) {
          case "Translate":
            if (!AppBskyFeedPost.isRecord(post.record)) return;
            assert(AppBskyFeedPost.validateRecord(post.record));
            router.push(
              `/translate?text=${encodeURIComponent(post.record.text)}`,
            );
            break;
          case "Copy post text":
            if (!AppBskyFeedPost.isRecord(post.record)) return;
            assert(AppBskyFeedPost.validateRecord(post.record));
            await Clipboard.setStringAsync(post.record.text);
            break;
          case "Share post":
            await Share.share({
              message: `https://bsky.app/profile/${
                post.author.handle
              }/post/${post.uri.split("/").pop()}`,
            });
            break;
          case "See likes":
            openLikes(post.uri);
            break;
          case "See reposts":
            openReposts(post.uri);
            break;
          case `Mute @${post.author.handle}`:
            muteAccount(
              agent,
              post.author.handle,
              post.author.did,
              queryClient,
            );
            break;
          case `Block @${post.author.handle}`:
            blockAccount(
              agent,
              post.author.handle,
              post.author.did,
              queryClient,
            );
            break;
          case "Delete post":
            Alert.alert(
              "Delete",
              "Are you sure you want to delete this post?",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Delete",
                  style: "destructive",
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  onPress: async () => {
                    await agent.deletePost(post.uri);
                    Alert.alert("Deleted", "Your post has been deleted.");
                    await queryClient.invalidateQueries();
                  },
                },
              ],
            );
            break;
          case "Report post":
            // prettier-ignore
            const reportOptions = [
              { label: "Spam", value: ComAtprotoModerationDefs.REASONSPAM },
              { label: "Copyright Violation", value: ComAtprotoModerationDefs.REASONVIOLATION },
              { label: "Misleading", value: ComAtprotoModerationDefs.REASONMISLEADING },
              { label: "Unwanted Sexual Content", value: ComAtprotoModerationDefs.REASONSEXUAL },
              { label: "Rude", value: ComAtprotoModerationDefs.REASONRUDE },
              { label: "Other", value: ComAtprotoModerationDefs.REASONOTHER },
              { label: "Cancel", value: "Cancel" },
            ] as const;
            showActionSheetWithOptions(
              {
                title: "What is the issue with this post?",
                options: reportOptions.map((x) => x.label),
                cancelButtonIndex: reportOptions.length - 1,
                userInterfaceStyle: colorScheme,
              },
              async (index) => {
                if (index === undefined) return;
                const reason = reportOptions[index]!.value;
                if (reason === "Cancel") return;
                await agent.createModerationReport({
                  reasonType: reason,
                  subject: {
                    uri: post.uri,
                    cid: post.cid,
                  },
                });
                Alert.alert(
                  "Report submitted",
                  "Thank you for making the skyline a safer place.",
                );
              },
            );
            break;
        }
      },
    );
  };

  return handleMore;
};

export const useHandleRepost = (
  post: AppBskyFeedDefs.PostView,
  reposted: boolean,
  toggleRepost: () => void,
) => {
  const { showActionSheetWithOptions } = useActionSheet();
  const composer = useComposer();
  const { colorScheme } = useColorScheme();

  return () => {
    const options = [reposted ? "Unrepost" : "Repost", "Quote", "Cancel"];
    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        userInterfaceStyle: colorScheme,
      },
      (index) => {
        if (index === undefined) return;
        switch (options[index]) {
          case "Repost":
          case "Unrepost":
            toggleRepost();
            break;
          case "Quote":
            composer.quote(post);
            break;
        }
      },
    );
  };
};
