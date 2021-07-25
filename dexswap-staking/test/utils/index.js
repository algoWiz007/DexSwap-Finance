exports.createDeXsPair = async (
    factoryInstance,
    tokenAAddress,
    tokenBAddress
) => {
    const { logs } = await factoryInstance.createPair(
        tokenAAddress,
        tokenBAddress
    );
    const { pair: createdPairAddress } = logs.find(
        (log) => log.event === "PairCreated"
    ).args;
    return createdPairAddress;
};

exports.getOrderedTokensInPair = (tokenAAddress, tokenBAddress) =>
    parseInt(tokenAAddress, 16) < parseInt(tokenBAddress, 16)
        ? { token0Address: tokenAAddress, token1Address: tokenBAddress }
        : { token0Address: tokenBAddress, token1Address: tokenAAddress };
