# Game NFT API Documentation

This document provides detailed information about all Game NFT related API endpoints in the Plyr Game API. These APIs are used for creating, minting, transferring, and querying game NFTs.

## General Requirements

All API requests require:
- HMAC authentication (`hmacAuth('user')`)
- Most endpoints require the `chainId` parameter to specify the blockchain network

## Chain ID Validation

The system validates the `chainId` parameter through the `checkChainId` middleware and converts it to an internal `chainTag`. If the `chainId` is invalid or unsupported, the API will return a 401 error.

## API Endpoints

### 1. Create Game NFT (By Signature)

**Endpoint:** `POST /api/game/nft/createBySignature`

**Description:** Create a game NFT using signature, suitable for game developers.

**Request Parameters:**
- `gameId`: Game ID (required)
- `name`: NFT name (required)
- `symbol`: NFT symbol (required)
- `image`: NFT image URL (optional)
- `signature`: Signature (required)
- `chainId`: Blockchain network ID (required)

**Response:**
- Success: Returns task data containing the NFT contract address
- Failure: Returns error message

### 2. Create Game NFT (By API Key)

**Endpoint:** `POST /api/game/nft/create`

**Description:** Create a game NFT using API Key, suitable for authorized applications.

**Request Parameters:**
- `name`: NFT name (required)
- `symbol`: NFT symbol (required)
- `image`: NFT image URL (optional)
- `chainId`: Blockchain network ID (required)

**Response:**
- Success: Returns task data containing the NFT contract address
- Failure: Returns error message

### 3. Mint NFT

**Endpoint:** `POST /api/game/nft/mint`

**Description:** Mint game NFTs to specified addresses.

**Request Parameters:**
- `nfts`: Array of NFT contract addresses (required)
- `addresses`: Array of recipient addresses (required)
- `tokenUris`: Array of token URIs (either this or metaJsons is required)
- `metaJsons`: Array of metadata JSONs (either this or tokenUris is required)
- `chainId`: Blockchain network ID (required)

**Note:** 
- The length of `addresses` and `nfts` arrays must be the same
- If `metaJsons` is provided, its length must also match the `addresses` array

**Response:**
- Success: Returns task ID or task status
- Failure: Returns error message

### 4. Burn NFT

**Endpoint:** `POST /api/game/nft/burn`

**Description:** Burn specified game NFTs.

**Request Parameters:**
- `nfts`: Array of NFT contract addresses (required)
- `tokenIds`: Array of token IDs to burn (required)
- `chainId`: Blockchain network ID (required)

**Note:**
- The length of `nfts` and `tokenIds` arrays must be the same

**Response:**
- Success: Returns task ID or task status
- Failure: Returns error message

### 5. Transfer NFT

**Endpoint:** `POST /api/game/nft/transfer`

**Description:** Transfer game NFTs to specified addresses.

**Request Parameters:**
- `nfts`: Array of NFT contract addresses (required)
- `fromAddresses`: Array of sender addresses (required)
- `toAddresses`: Array of recipient addresses (required)
- `tokenIds`: Array of token IDs to transfer (required)
- `chainId`: Blockchain network ID (required)

**Note:**
- The length of `fromAddresses`, `toAddresses`, and `tokenIds` arrays must be the same

**Response:**
- Success: Returns task ID or task status
- Failure: Returns error message

### 6. Query Balance

**Endpoint:** `GET /api/game/nft/balance`

**Description:** Query the balance of game NFTs held by a user.

**Request Parameters:**
- `plyrId`: User plyrId (required)
- `nft`: NFT contract address (optional)
- `chainId`: Blockchain network ID (required)

**Response:**
- Success: Returns the NFT balance information held by the user
- Failure: Returns error message

### 7. Query NFT List

**Endpoint:** `GET /api/game/nft/list`

**Description:** Query the list of game NFTs held by a user.

**Request Parameters:**
- `plyrId`: User plyrId (required)
- `nft`: NFT contract address (optional)
- `gameId`: Game ID (optional)
- `chainId`: Blockchain network ID (required)

**Response:**
- Success: Returns the list of NFTs held by the user, including metadata
- Failure: Returns error message

### 8. Query NFT Information

**Endpoint:** `GET /api/game/nft/info`

**Description:** Query game NFT contract information.

**Request Parameters:**
- `nft`: NFT contract address (optional)
- `gameId`: Game ID (optional)
- `chainId`: Blockchain network ID (required)

**Note:** At least one of `nft` or `gameId` must be provided

**Response:**
- Success: Returns NFT contract information, including name, symbol, total supply, etc.
- Failure: Returns error message

### 9. Query Holding Status

**Endpoint:** `GET /api/game/nft/isHolding`

**Description:** Query whether a user holds a specific game NFT.

**Request Parameters:**
- `address`: User address (required)
- `nft`: NFT contract address (required)
- `tokenId`: Token ID (optional)
- `chainId`: Blockchain network ID (required)

**Response:**
- Success: Returns holding status information
- Failure: Returns error message

### 10. Query Credit

**Endpoint:** `GET /api/game/nft/credit`

**Description:** Query the game's credit balance, used for creating and minting NFTs.

**Request Parameters:**
No additional parameters required, uses the plyrId from the API Key to identify the game

**Response:**
- Success: Returns the game's credit balance
- Failure: Returns error message

### 11. Upload File

**Endpoint:** `POST /api/game/nft/upload`

**Description:** Upload a file to IPFS, mainly used for uploading NFT metadata and images.

**Request Parameters:**
- `content`: File content (required)
- `fileType`: File type (required, e.g., "application/json")

**Response:**
- Success: Returns IPFS URL
- Failure: Returns error message

## Error Handling

All APIs return appropriate HTTP status codes and error messages when encountering errors:

- 400: Bad request parameters
- 401: Authentication failed or invalid chain ID
- 404: Resource not found
- 500: Internal server error

## Credit Consumption

Creating and minting NFTs consume game credits:

- Creating NFT: Consumes credits according to chain configuration
- Minting NFT: Consumes credits according to chain configuration
- Burning NFT: Consumes credits according to chain configuration
- Transferring NFT: Consumes credits according to chain configuration

If there are insufficient credits, the API will return a 400 error with the message "not enough credit".
