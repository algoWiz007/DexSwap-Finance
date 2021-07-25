const BN = require("bn.js");

// Maximum variance allowed between expected values and actual ones.
// Mainly to account for division between integers, and associated rounding.
exports.MAXIMUM_VARIANCE = new BN(1); // 1 wei
exports.ZERO_BN = new BN(0);
exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
