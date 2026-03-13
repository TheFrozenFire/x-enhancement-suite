# Own Followers Pages (`/:screen_name/followers`, `/:screen_name/verified_followers`)

Data available when viewing your own Followers and Verified Followers lists.

## Network Endpoints

### `Followers` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/Followers`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Used on:** `/followers` tab
- **Returns:** Paginated list of all followers. Each entry contains a full user object.

### `BlueVerifiedFollowers` (GraphQL GET)
- **Path:** `/i/api/graphql/{hash}/BlueVerifiedFollowers`
- **Variables:** `userId` (numeric), `count` (page size), `includePromotedContent`
- **Used on:** `/verified_followers` tab
- **Returns:** Paginated list of verified/premium followers only. Same user object schema as `Followers`.

### Common endpoints
Also loads `DataSaverMode`, `XChatDmSettingsQuery`, `useDirectCallSetupQuery`, `user_flow.json`. See [NETWORK.md](./NETWORK.md).

## React Fiber Data

Data is accessible on `[data-testid="UserCell"]` elements via the `__reactFiber` key.

### `user` prop

Same full user object schema as the Following page — see [OWN_FOLLOWING.md](./OWN_FOLLOWING.md) for the complete field list.

Key relationship fields on followers pages:

| Field | Type | Notes |
|---|---|---|
| `following` | boolean | Whether you follow this user back — determines follow/unfollow button |
| `followed_by` | boolean | Always `true` on this page (everyone listed follows you) |

## DOM Structure

### Tab Navigation
- `[role="tab"]` elements: **Verified Followers**, **Followers**, **Following**
- `aria-selected="true"` on the active tab
- Same tab bar across all three pages

### User Cells
- `[data-testid="UserCell"]` — each follower
- `[data-testid="UserAvatar-Container-{screenName}"]` — avatar
- `[data-testid="userFollowIndicator"]` — "Follows you" indicator (present on all cells)
- `[data-testid="{userId}-follow"]` — follow button (when you don't follow this user back)
- `[data-testid="{userId}-unfollow"]` — unfollow button (when you follow this user back)
- `[data-testid="icon-verified"]` — verification badge (on verified users)
- `[data-testid="pillLabel"]` — label/pill elements

### Verified vs Regular Followers

| Aspect | `/verified_followers` | `/followers` |
|---|---|---|
| Endpoint | `BlueVerifiedFollowers` | `Followers` |
| Users shown | Only premium/verified followers | All followers |
| `icon-verified` | Present on all entries | Present only on verified users |
| User data schema | Identical | Identical |
| Buttons | Same mix of follow/unfollow | Same mix of follow/unfollow |

## Key Differences from Following Page

| Aspect | Followers | Following |
|---|---|---|
| `userFollowIndicator` | Present on all cells | Not present |
| Action buttons | Mix of follow/unfollow | Unfollow only |
| `user.followed_by` | Always `true` | Varies |
| `user.following` | Varies | Always `true` |
