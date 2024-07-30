function verifyPlyrid(plyrid) {
  // Convert plyrid to lowercase
  plyrid = plyrid.toLowerCase();

  // Check length conditions
  if (plyrid.length < 5 || plyrid.length > 32) {
      return false;
  }

  // Check characters
  if (!/^[a-z0-9_-]+$/.test(plyrid)) {
      return false;
  }

  // Check if plyrid is not all numbers
  if (/^\d+$/.test(plyrid)) {
      return false;
  }

  // Check if plyrid is not entirely underscores or hyphens
  if (/^_+$/.test(plyrid) || /^-+$/.test(plyrid)) {
      return false;
  }

  // Return lowercase plyrid if all checks pass
  return plyrid;
}

module.exports = { verifyPlyrid };