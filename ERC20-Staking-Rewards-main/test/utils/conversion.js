const BN = require("bn.js");

exports.toWei = async (amount, tokenInstance) => {
    const decimals = await tokenInstance.decimals();
    return new BN(amount).mul(new BN(10).pow(decimals));
};
