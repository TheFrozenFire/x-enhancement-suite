# Thread Page Data (`/:screen_name/status/:id`)

## Network Endpoints

### `TweetDetail` (GraphQL GET)
Primary endpoint for loading the thread. Returns the focal tweet and paginated replies.
See [NETWORK.md](./NETWORK.md) for response schema.

### `TweetResultByRestId` (GraphQL GET)
Fetches a single tweet by ID. Used alongside TweetDetail on thread pages.
See [NETWORK.md](./NETWORK.md) for response schema.

## React Fiber Data

Data is accessible on `article[data-testid="tweet"]` elements via the `__reactFiber` key.

### `tweet` prop (found via fiber tree traversal)

| Field | Type | Notes |
|---|---|---|
| `id_str` | string | Tweet ID |
| `conversation_id_str` | string | Root tweet ID of the thread |
| `full_text` | string | Tweet text content |
| `in_reply_to_status_id_str` | string | Parent tweet ID (replies only) |
| `lang` | string | Detected tweet language (e.g. `"en"`) |
| `source` | string | Posting client HTML (e.g. `"Twitter for iPhone"`) |
| `created_at` | string | Tweet creation timestamp |
| `display_text_range` | array | `[start, end]` indices for display text |
| `entities` | object | Parsed hashtags, urls, user_mentions, symbols, media |
| `favorite_count` | number | Like count |
| `retweet_count` | number | Retweet count |
| `reply_count` | number | Reply count |
| `quote_count` | number | Quote tweet count |
| `bookmark_count` | number | Bookmark count |
| `favorited` | boolean | Whether logged-in user liked it |
| `retweeted` | boolean | Whether logged-in user retweeted it |
| `bookmarked` | boolean | Whether logged-in user bookmarked it |
| `is_quote_status` | boolean | Whether this quotes another tweet |
| `possibly_sensitive` | boolean | Sensitive content flag |
| `is_translatable` | boolean | Whether translation is available |
| `has_birdwatch_notes` | boolean | Whether Community Notes are attached |
| `edit_control` | object | Edit history metadata |
| `views` | object | View count data (focal tweet only) |
| `source_name` | string | Clean client name |
| `source_url` | string | Client URL |
| `permalink` | string | Tweet permalink path |

### `tweet.user` prop

| Field | Type | Notes |
|---|---|---|
| `id_str` | string | User ID |
| `screen_name` | string | Handle (without @) |
| `name` | string | Display name |
| `location` | string | User-set location (freeform text, often empty) |
| `description` | string | Bio text |
| `created_at` | string | Account creation timestamp |
| `followers_count` | number | Follower count |
| `friends_count` | number | Following count |
| `statuses_count` | number | Tweet count |
| `favourites_count` | number | Likes given count |
| `listed_count` | number | Lists membership count |
| `media_count` | number | Media posted count |
| `subscribers_count` | number | X Premium subscriber count |
| `following` | boolean | Whether logged-in user follows this user |
| `followed_by` | boolean | Whether this user follows logged-in user |
| `blocking` | boolean | Whether logged-in user blocks this user |
| `blocked_by` | boolean | Whether this user blocks logged-in user |
| `muting` | boolean | Whether logged-in user mutes this user |
| `follow_request_sent` | boolean | Pending follow request |
| `is_blue_verified` | boolean | Has X Premium verification |
| `verified` | boolean | Legacy verification badge |
| `protected` | boolean | Protected/private account |
| `possibly_sensitive` | boolean | Account-level sensitive flag |
| `default_profile` | boolean | Has not customized profile |
| `default_profile_image` | boolean | Using default avatar |
| `is_translator` | boolean | Community translator |
| `translator_type` | string | e.g. `"none"` |
| `is_profile_translatable` | boolean | Profile translatable |
| `profile_description_language` | string | Bio language (e.g. `"en"`) |
| `profile_image_url_https` | string | Avatar URL |
| `profile_banner_url` | string | Banner image URL |
| `profile_image_shape` | string | Avatar shape type |
| `profile_interstitial_type` | string | Interstitial warning type |
| `profile_sort_enabled` | boolean | Profile sort enabled |
| `has_custom_timelines` | boolean | Has custom lists/timelines |
| `has_graduated_access` | boolean | Has graduated access |
| `notifications` | boolean | Notifications enabled for this user |
| `want_retweets` | boolean | Show retweets from this user |
| `can_dm` | boolean | Can send DMs to this user |
| `can_media_tag` | boolean | Can tag this user in media |
| `dm_muting` | boolean | DM muted |
| `pinned_tweet_ids_str` | array | Pinned tweet IDs |
| `withheld_in_countries` | array | Countries where account is withheld |
| `professional` | object/null | Professional account metadata |
| `business_account` | object/null | Business account metadata |
| `parody_commentary_fan_label` | string | Parody/commentary label |
| `creator_subscriptions_count` | number | Creator subscriptions |
| `super_follow_eligible` | boolean | Eligible for super follows |
| `super_followed_by` | boolean | Super followed by logged-in user |
| `super_following` | boolean | Logged-in user super follows |
| `verified_phone_status` | boolean | Phone verified |

### `userData` prop

Lighter-weight user data found higher in the fiber tree:

| Field | Type |
|---|---|
| `screenName` | string |
| `userId` | string |
| `name` | string |
| `isProtected` | boolean |
| `isBlueVerified` | boolean |
| `isVerified` | boolean |
| `isSubscriber` | boolean |
| `verifiedType` | string |
| `affiliateBadgeInfo` | object |
| `communityModeratorStatus` | string |

### `loggedInUser` prop

Same schema as `tweet.user` but for the authenticated user. Also includes `birthdate`.

## DOM Structure

### Key `data-testid` selectors

**Focal tweet only:**
- `{userId}-follow` — follow button (only on OP tweet, only if not following)

**Reply tweets only:**
- (No unique data-testid values exclusive to replies)

**All tweets:**
- `article[data-testid="tweet"]` — tweet container
- `[data-testid="Tweet-User-Avatar"]` — avatar element
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar with username
- `[data-testid="User-Name"]` — display name + handle area
- `[data-testid="tweetText"]` — tweet text content
- `[data-testid="tweetPhoto"]` — image media
- `[data-testid="videoPlayer"]` — video/GIF media
- `[data-testid="card.wrapper"]` — link card
- `[data-testid="caret"]` — more actions menu
- `[data-testid="reply"]` — reply action button
- `[data-testid="retweet"]` — retweet action button
- `[data-testid="like"]` / `[data-testid="unlike"]` — like action button
- `[data-testid="bookmark"]` — bookmark action button
- `[data-testid="icon-verified"]` — verification badge

**Page-level:**
- `[data-testid="cellInnerDiv"]` — virtual scroll row container
- `a[data-testid="AppTabBar_Profile_Link"]` — logged-in user profile link (href = `/{screenName}`)

## Distinguishing Focal Tweet from Replies

The focal (OP) tweet can be identified by:
1. Having a "Views" text in its content + an analytics link (`a[href*="/analytics"]`)
2. Being the first `article[data-testid="tweet"]` on the page
3. Having a follow button (`[data-testid="{userId}-follow"]`) if not already following

## Notable Limitations

- **No `account_based_in` data** — country/region info requires a separate `AboutAccountQuery` GraphQL call per user
- **`location` is unreliable** — user-set freeform text, often empty or fictional
- **Virtual scrolling** — X removes/re-adds tweet DOM nodes as the user scrolls; observers must handle re-inserted nodes
- **Media loads asynchronously** — `tweetPhoto`/`videoPlayer` elements may be added after the article element
