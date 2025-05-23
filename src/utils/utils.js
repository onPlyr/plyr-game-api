const Crypto = require('crypto');

function verifyPlyrid(plyrid) {
    // Convert plyrid to lowercase
    plyrid = plyrid.toLowerCase();

    // Check length conditions
    if (plyrid.length < 5 || plyrid.length > 64) {
        return false;
    }

    // Check characters and ensure dash is not at the beginning or end and no consecutive dashes
    if (!/^[a-z0-9](?!.*--)[a-z0-9-]*[a-z0-9]$/.test(plyrid)) {
        return false;
    }

    // Ensure plyrid contains at least one alphabetic character
    if (!/[a-z]/.test(plyrid)) {
        return false;
    }

    // Check if plyrid is not all numbers
    if (/^\d+$/.test(plyrid)) {
        return false;
    }

    // Return lowercase plyrid if all checks pass
    return plyrid;
}

const DEFAULT_AVATR = 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR';

function getAvatarUrl(avatar) {
    if (!avatar) {
        return DEFAULT_AVATR;
    }
    return avatar.startsWith('ipfs://') ? 'https://ipfs.plyr.network/ipfs/' + avatar.slice(7) : avatar;
}

const cache2fa = {};

function is2faUsed(plyrid, token) {
    const key = `${plyrid}-${token}`;
    const now = Date.now();
    
    if (cache2fa[key]) {
        if (now - cache2fa[key].timestamp > 5 * 60 * 1000) {
            // Reset if more than 5 minutes have passed
            cache2fa[key] = {
                timestamp: now,
                times: 0
            };
            return false;
        } else {
            // Increment usage count
            cache2fa[key].times++;
            return cache2fa[key].times > 1;
        }
    } else {
        // First use
        cache2fa[key] = {
            timestamp: now,
            times: 1
        };
        return false;
    }
}

function generateRandomNumber(length, count) {
    if (count > 1024) {
      throw new Error('Too many random');
    }
  
    let randomArray = [];
    for (let i=0; i<count; i++) {
      randomArray.push(Crypto.randomBytes(length).toString('hex'));
    }
  
    return randomArray;
}

module.exports = { verifyPlyrid, getAvatarUrl, is2faUsed, generateRandomNumber };