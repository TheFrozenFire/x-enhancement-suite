/**
 * Utilities for extracting data from X/Twitter tweet DOM elements
 * via React fiber internals.
 */

export interface TweetUserData {
  screenName: string;
  following: boolean;
  followedBy: boolean;
}

/**
 * Walk the React fiber tree to find a prop by key.
 */
function findFiberProp(
  fiber: any,
  targetKey: string,
  depth = 0,
  maxDepth = 50
): any {
  if (!fiber || depth > maxDepth) return null;
  try {
    const props = fiber.memoizedProps;
    if (props && props[targetKey]) return props[targetKey];
  } catch {
    // Skip inaccessible fibers
  }
  return (
    findFiberProp(fiber.child, targetKey, depth + 1, maxDepth) ||
    findFiberProp(fiber.sibling, targetKey, depth + 1, maxDepth)
  );
}

/**
 * Get the React fiber key for the current page.
 */
function getFiberKey(): string | undefined {
  const el = document.querySelector("article[data-testid='tweet']");
  if (!el) return undefined;
  return Object.keys(el).find((k) => k.startsWith("__reactFiber"));
}

/**
 * Extract user data from a tweet article element's React fiber tree.
 */
export function getTweetUserData(
  article: HTMLElement
): TweetUserData | null {
  const fiberKey = getFiberKey();
  if (!fiberKey) return null;

  const fiber = (article as any)[fiberKey];
  if (!fiber) return null;

  const tweet = findFiberProp(fiber, "tweet");
  const user = tweet?.user;
  if (!user) return null;

  return {
    screenName: user.screen_name ?? "",
    following: !!user.following,
    followedBy: !!user.followed_by,
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
