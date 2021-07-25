const chai = require("chai");
const { isBN } = require("bn.js");

chai.util.addMethod(
    chai.Assertion.prototype,
    "closeBn",
    function (bn2, maximumVariance) {
        const bn1 = chai.util.flag(this, "object");
        if (!isBN(bn1) || !isBN(bn2) || !isBN(maximumVariance)) {
            throw new Error("Not a BN instance");
        }
        const actualVariance = bn2.sub(bn1).abs();
        try {
            new chai.Assertion(actualVariance.lte(maximumVariance)).to.be.true;
        } catch (error) {
            throw new Error(
                `expected variance is ${maximumVariance.toString()}, but it was ${actualVariance.toString()} for numbers ${bn1.toString()} and ${bn2.toString()}`
            );
        }
    }
);

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
