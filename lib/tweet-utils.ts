/**
 * Utilities for extracting data from X/Twitter tweet DOM elements.
 *
 * Data is read from the `data-xes-tweet-data` attribute set by the
 * MAIN world fiber-bridge content script, since the ISOLATED world
 * content script cannot access React fiber internals.
 */

const DATA_ATTR = "data-xes-tweet-data";

export interface TweetUserData {
  screenName: string;
  following: boolean;
  followedBy: boolean;
}

export interface TweetData {
  id_str: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number | null;
}

interface BridgeData {
  id_str: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number | null;
  screen_name: string;
  following: boolean;
  followed_by: boolean;
}

function readBridgeData(article: HTMLElement): BridgeData | null {
  const json = article.getAttribute(DATA_ATTR);
  if (!json) return null;
  try {
    return JSON.parse(json) as BridgeData;
  } catch {
    return null;
  }
}

/**
 * Extract user data from a tweet article element.
 */
export function getTweetUserData(
  article: HTMLElement
): TweetUserData | null {
  const data = readBridgeData(article);
  if (!data) return null;

  return {
    screenName: data.screen_name,
    following: data.following,
    followedBy: data.followed_by,
  };
}

/**
 * Extract tweet engagement data from a tweet article element.
 */
export function getTweetData(article: HTMLElement): TweetData | null {
  const data = readBridgeData(article);
  if (!data) return null;

  return {
    id_str: data.id_str,
    favorite_count: data.favorite_count,
    retweet_count: data.retweet_count,
    reply_count: data.reply_count,
    views_count: data.views_count,
  };
}

/**
 * Get the logged-in user's screen name from the profile nav link.
 */
export function getLoggedInUsername(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="AppTabBar_Profile_Link"]'
  );
  return link?.getAttribute("href")?.replace("/", "") ?? null;
}
