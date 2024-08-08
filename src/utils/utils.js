function verifyPlyrid(plyrid) {
    // Convert plyrid to lowercase
    plyrid = plyrid.toLowerCase();

    // Check length conditions
    if (plyrid.length < 5 || plyrid.length > 32) {
        return false;
    }

    // Check characters and ensure dash is not at the beginning or end and no consecutive dashes
    if (!/^[a-z0-9](?!.*--)[a-z0-9-]*[a-z0-9]$/.test(plyrid)) {
        return false;
    }

    // Check if plyrid is not all numbers
    if (/^\d+$/.test(plyrid)) {
        return false;
    }

    // Return lowercase plyrid if all checks pass
    return plyrid;
}
