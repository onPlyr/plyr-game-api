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
- Body: `{ avatar }`

#### Bind Secondary Address
- **POST** `/api/user/secondary/bind`
- Bind a secondary address to a user
- Body: `{ plyrId, secondaryAddress, signature }`

#### Get Secondary Addresses
- **GET** `/api/user/secondary/:plyrId`
- Retrieve secondary addresses for a user

#### User Login
- **POST** `/api/user/login`
- Log in a user
- Body: `{ plyrId, otp, expiresIn }`
- Response: Session JWT and user information

#### User Logout
- **POST** `/api/user/logout`
- Log out a user
- Body: `{ sessionJwt }`

#### Verify User Session
- **POST** `/api/user/session/verify`
- Verify a user's session JWT
- Body: `{ sessionJwt, plyrId, gameId, expiresIn }`

### Airdrop

#### Claim Airdrop
- **POST** `/api/airdrop/campaign/claim`
- Claim airdrop rewards
- Body: `{ campaignId, address, playedGame }`

#### Get Campaign Info
- **GET** `/api/airdrop/campaign/info`
- Retrieve information about all airdrop campaigns

#### Get Claimable Reward
- **GET** `/api/airdrop/campaign/:campaignId/claimableReward/:address`
- Get claimable reward for a specific campaign and address

#### Get User Reward
- **GET** `/api/airdrop/campaign/:campaignId/userReward/:address`
- Get user's reward information for a specific campaign

### Miscellaneous

#### Get Current Time
- **GET** `/api/now`
- Get the current server time

#### Get API Status
- **GET** `/api/status`
- Get the API status (admin only)

#### Get JWT Public Key
- **GET** `/api/jwt/publicKey`
- Retrieve the public key for JWT verification

#### Get Task Status
- **GET** `/api/task/status/:id`
- Check the status of a task

## Error Handling

All endpoints may return error responses with appropriate HTTP status codes and error messages in the response body.
