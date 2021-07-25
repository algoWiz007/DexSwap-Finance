const chai = require("chai");
const { isBN } = require("bn.js");

chai.util.addMethod(chai.Assertion.prototype, "equalBn", function (bn2) {
    const bn1 = chai.util.flag(this, "object");
    if (!isBN(bn1) || !isBN(bn2)) {
        throw new Error("Not a BN instance");
    }
    try {
        new chai.Assertion(bn1.eq(bn2)).to.be.true;
    } catch (error) {
        throw new Error(
            `expected ${bn1.toString()} to be the same as ${bn2.toString()}`
        );
    }
});
