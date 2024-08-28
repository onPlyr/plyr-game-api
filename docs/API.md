# PLYR Game API Documentation

## Authentication

All API requests require HMAC authentication. Include the following headers with each request:

- `apikey`: Your API key
- `signature`: HMAC signature
- `timestamp`: Current timestamp

## Endpoints

### User Management

#### Check User Existence
- **GET** `/api/user/exists/:queryStr`
- Checks if a user exists by PLYR ID or primary address
- Response: `{ exists: boolean }`

#### Register User
- **POST** `/api/user/register`
- Register a new user
- Body: `{ address, signature, plyrId, secret, chainId, avatar }`
- Response: User information including PLYR ID, mirror address, and primary address

#### Get User Info
- **GET** `/api/user/info/:plyrId`
- Retrieve user information
- Response: User details including PLYR ID, primary address, mirror address, and avatar

#### Modify User Avatar
- **POST** `/api/user/modify/:plyrId/avatar`
- Update user's avatar
- Body: `{ avatar, signature }`
- Response: Updated user information including PLYR ID and avatar

#### Reset Two-Factor Authentication
- **POST** `/api/user/reset2fa`
- Reset user's two-factor authentication
- Body: `{ plyrId, signature, secret }`
- Response: Success message

#### Bind Secondary Address
- **POST** `/api/user/secondary/bind`
- Bind a secondary address to a user
- Body: `{ plyrId, secondaryAddress, signature }`
- Response: Success message

#### Get Secondary Addresses
- **GET** `/api/user/secondary/:plyrId`
- Retrieve secondary addresses for a user
- Response: List of secondary addresses

#### User Login
- **POST** `/api/user/login`
- Log in a user
- Body: `{ plyrId, otp, expiresIn }`
- Response: Session JWT and user information

#### User Logout
- **POST** `/api/user/logout`
- Log out a user
- Body: `{ sessionJwt }`
- Response: Success message

#### Verify User Session
- **POST** `/api/user/session/verify`
- Verify a user's session JWT
- Body: `{ sessionJwt, plyrId, gameId, expiresIn }`
- Response: Verification result

### Airdrop

#### Claim Airdrop
- **POST** `/api/airdrop/campaign/claim`
- Claim airdrop rewards
- Body: `{ campaignId, address, playedGame }`
- Response: Task ID and status

#### Get Campaign Info
- **GET** `/api/airdrop/campaign/info`
- Retrieve information about all airdrop campaigns
- Response: List of campaign details

#### Get Claimable Reward
- **GET** `/api/airdrop/campaign/:campaignId/claimableReward/:address`
- Get claimable reward for a specific campaign and address
- Response: Claimable reward amount

#### Get User Reward
- **GET** `/api/airdrop/campaign/:campaignId/userReward/:address`
- Get user's reward information for a specific campaign
- Response: Claimed, total, and unclaimed reward amounts

### Game Management

#### Game Approve
- **POST** `/api/game/approve`
- Approve a game action
- Body: `{ plyrId, gameId, token, amount, expiresIn }`
- Response: Success message

#### Game Allowance
- **GET** `/api/game/allowance`
- Get allowance for a game
- Body: `{ plyrId, gameId, token }`
- Response: Allowance amount

#### Game Revoke
- **POST** `/api/game/revoke`
- Revoke approval for a game
- Body: `{ plyrId, gameId, token }`
- Response: Success message

#### Create Game Room
- **POST** `/api/game/create`
- Create a new game room
- Body: `{ expiresIn }`
- Response: Task ID and status

#### Join Game Room
- **POST** `/api/game/join`
- Join a game room
- Body: `{ roomId, sessionJwts }`
- Response: Task ID and status

#### Leave Game Room
- **POST** `/api/game/leave`
- Leave a game room
- Body: `{ roomId, sessionJwts }`
- Response: Task ID and status

#### Game Pay
- **POST** `/api/game/pay`
- Process a payment in a game
- Body: `{ roomId, sessionJwts, token, amount }`
- Response: Task ID and status

#### Game Earn
- **POST** `/api/game/earn`
- Process earnings in a game
- Body: `{ roomId, sessionJwts, token, amount }`
- Response: Task ID and status

#### Game Multicall
- **POST** `/api/game/multicall`
- Process multiple game actions in one call
- Body: `{ roomId, functionDatas, sessionJwts }`
- Response: Task ID and status

### Miscellaneous

#### Get Current Time
- **GET** `/api/now`
- Get the current server time
- Response: Current timestamp

#### Get API Status
- **GET** `/api/status`
- Get the API status (admin only)
- Response: API status information

#### Get JWT Public Key
- **GET** `/api/jwt/publicKey`
- Retrieve the public key for JWT verification
- Response: Base64 encoded public key

#### Get Task Status
- **GET** `/api/task/status/:id`
- Check the status of a task
- Response: Task status information

## Error Handling

All endpoints may return error responses with appropriate HTTP status codes and error messages in the response body.