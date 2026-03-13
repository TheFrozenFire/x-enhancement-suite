# Own Following Page (`/:screen_name/following`)

Data available when viewing your own Following list.

## Network Endpoints

### `Following` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/Following`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Returns:** Paginated list of users you follow. Each entry contains a full user object.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `[data-testid="UserCell"]` elements via the `__reactFiber` key.

### `user` prop

Full user object with the same schema as `tweet.user` on thread/timeline pages (see [THREAD.md](./THREAD.md)).

| Field | Type | Notes |
|---|---|---|
| `screen_name` | string | Handle |
| `name` | string | Display name |
| `id_str` | string | Numeric user ID |
| `following` | boolean | Always `true` on this page (you follow everyone listed) |
| `followed_by` | boolean | Whether this user follows you back |
| `is_blue_verified` | boolean | Blue/premium verification status |
| `verified` | boolean | Legacy verification |
| `location` | string | User-set location |
| `description` | string | Bio text |
| `followers_count` | number | |
| `friends_count` | number | Number of accounts they follow |
| `statuses_count` | number | Tweet count |
| `favourites_count` | number | Like count |
| `media_count` | number | |
| `created_at` | string | Account creation date |
| `profile_image_url_https` | string | Avatar URL |
| `profile_banner_url` | string | Banner URL |
| `protected` | boolean | Whether account is private |
| `blocking` | boolean | Whether you block this user |
| `blocked_by` | boolean | Whether this user blocks you |
| `muting` | boolean | Whether you mute this user |
| `can_dm` | boolean | Whether you can DM this user |
| `pinned_tweet_ids_str` | string[] | IDs of pinned tweets |
| `profile_image_shape` | string | Avatar shape (e.g. "Circle", "Square") |
| `super_follow_eligible` | boolean | |
| `super_following` | boolean | |
| `super_followed_by` | boolean | |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements: **Verified Followers**, **Followers**, **Following**
- `aria-selected="true"` on the active tab

### User Cells
- `[data-testid="UserCell"]` — each followed user
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar
- `[data-testid="{userId}-unfollow"]` — unfollow button (all entries, since you follow everyone listed)

### Notable Absences
- No `userFollowIndicator` testid (that only appears on followers pages)
- No `{userId}-follow` buttons (all entries are people you follow)

## Key Differences from Followers Pages

| Aspect | Following | Followers |
|---|---|---|
| Endpoint | `Following` | `Followers` / `BlueVerifiedFollowers` |
| Action button | `{userId}-unfollow` only | Mix of `{userId}-follow` and `{userId}-unfollow` |
| `userFollowIndicator` | Not present | Present ("Follows you" indicator) |
| `user.following` | Always `true` | Varies |
