import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBskyFeedDefs } from "@atproto/api";
import { getDefaultHeaderHeight } from "@react-navigation/elements";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAgent } from "~/lib/agent";
import { useContentFilter } from "~/lib/hooks/preferences";
import { useRefreshOnFocus } from "~/lib/utils/query";

export const useProfile = (handle?: string) => {
  const agent = useAgent();

  const actor = handle ?? agent.session?.did;

  const query = useQuery({
    queryKey: ["profile", actor],
    queryFn: async () => {
      if (!actor) throw new Error("Not logged in");
      const profile = await agent.getProfile({ actor });
      if (!profile.success) throw new Error("Profile not found");
      return profile.data;
    },
  });

  useRefreshOnFocus(query.refetch);

  return query;
};

export const useProfileFeeds = (handle?: string) => {
  const agent = useAgent();

  const actor = handle ?? agent.session?.did;

  return useInfiniteQuery({
    queryKey: ["profile", actor, "feeds"],
    queryFn: async ({ pageParam }) => {
      if (!actor) throw new Error("Not logged in");
      const feeds = await agent.app.bsky.feed.getActorFeeds({
        actor,
        cursor: pageParam as string | undefined,
      });
      if (!feeds.success) throw new Error("Feeds not found");
      return feeds.data;
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
  });
};

export const useProfilePosts = (
  mode: "posts" | "replies" | "likes" | "media",
  handle?: string,
) => {
  const agent = useAgent();
  const { preferences, contentFilter } = useContentFilter();

  const actor = handle ?? agent.session?.did;

  const timeline = useInfiniteQuery({
    queryKey: ["profile", actor, "feed", mode],
    queryFn: async ({ pageParam }) => {
      if (!actor) throw new Error("Not logged in");
      let cursor;
      let posts = [];

      switch (mode) {
        case "posts": {
          const feed = await agent.getAuthorFeed({
            actor,
            cursor: pageParam as string | undefined,
            filter: "posts_no_replies",
          });
          ({ cursor, feed: posts } = feed.data);
          break;
        }
        case "replies": {
          const feed = await agent.getAuthorFeed({
            actor,
            cursor: pageParam as string | undefined,
            filter: "posts_with_replies",
          });
          ({ cursor, feed: posts } = feed.data);
          break;
        }
        case "media": {
          const feed = await agent.getAuthorFeed({
            actor,
            cursor: pageParam as string | undefined,
            filter: "posts_with_media",
          });
          ({ cursor, feed: posts } = feed.data);
          break;
        }
        case "likes": {
          const list = await agent.app.bsky.feed.like.list({
            repo: actor,
            cursor: pageParam as string | undefined,
          });

          // split subjects into chunks of 25
          const subjectChunks = list.records
            .filter((record) =>
              record.value.subject.uri.includes("app.bsky.feed.post"),
            )
            .reduce<string[][]>(
              (acc, record) => {
                if (acc[acc.length - 1]!.length === 25) {
                  acc.push([record.value.subject.uri]);
                } else {
                  acc[acc.length - 1]!.push(record.value.subject.uri);
                }
                return acc;
              },
              [[]],
            );

          const likes = await Promise.all(
            subjectChunks.map((chunk) =>
              agent.getPosts({
                uris: chunk,
              }),
            ),
          ).then((x) =>
            x
              .flatMap((x) => x.data.posts)
              .map((post) => ({ post, reply: undefined, reason: undefined })),
          );

          posts = likes;
          cursor = list.cursor;
          break;
        }
      }

      return { posts, cursor };
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
  });

  const timelineData = useMemo(() => {
    if (!timeline.data) return [];
    const flat = timeline.data.pages.flatMap((page) => page.posts);
    return flat
      .map((item) => {
        const filter = contentFilter(item.post.labels);
        if (filter?.visibility === "hide") return [];
        switch (mode) {
          case "posts":
          case "likes":
          case "media":
            return [{ item, hasReply: false, filter }];
          case "replies":
            if (item.reply && !item.reason) {
              if (!AppBskyFeedDefs.isPostView(item.reply.parent)) return [];

              const parentFilter = contentFilter(item.reply.parent.labels);
              if (parentFilter?.visibility === "hide")
                return [{ item, hasReply: false, filter }];
              return [
                {
                  item: { post: item.reply.parent },
                  hasReply: true,
                  filter: parentFilter,
                },
                { item, hasReply: false, filter },
              ];
            } else {
              return [{ item, hasReply: false, filter }];
            }
        }
      })
      .flat();
  }, [timeline, mode, contentFilter]);

  return { preferences, timeline, timelineData };
};

export const useDefaultHeaderHeight = () => {
  const layout = useWindowDimensions();
  const { top } = useSafeAreaInsets();

  return getDefaultHeaderHeight(layout, false, top > 50 ? top - 5 : top);
};

export const useProfileLists = (handle?: string) => {
  const agent = useAgent();

  const actor = handle ?? agent.session?.did;

  const query = useInfiniteQuery({
    queryKey: ["profile", actor, "lists"],
    queryFn: async ({ pageParam }) => {
      if (!actor) throw new Error("Not logged in");
      const lists = await agent.app.bsky.graph.getLists({
        actor,
        cursor: pageParam as string | undefined,
      });
      if (!lists.success) throw new Error("Profile lists not found");
      return lists.data;
    },
    getNextPageParam: (lastPage) => lastPage.cursor,
  });

  return query;
};
