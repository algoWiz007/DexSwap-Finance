const BN = require("bn.js");
const { ZERO_ADDRESS } = require("../constants");
const {
    getEvmTimestamp,
    stopMining,
    startMining,
    mineBlock,
} = require("./network");

const ERC20StakingRewardsDistribution = artifacts.require(
    "ERC20StakingRewardsDistribution"
);

exports.initializeStaker = async ({
    erc20DistributionInstance,
    stakableTokenInstance,
    stakerAddress,
    stakableAmount,
    setAllowance = true,
}) => {
    await stakableTokenInstance.mint(stakerAddress, stakableAmount);
    if (setAllowance) {
        await stakableTokenInstance.approve(
            erc20DistributionInstance.address,
            stakableAmount,
            { from: stakerAddress }
        );
    }
};

exports.initializeDistribution = async ({
    from,
    erc20DistributionFactoryInstance,
    stakableToken,
    rewardTokens,
    rewardAmounts,
    duration,
    startingTimestamp,
    fund = true,
    skipRewardTokensAmountsConsistenyCheck,
    locked = false,
    stakingCap = 0,
}) => {
    if (
        !skipRewardTokensAmountsConsistenyCheck &&
        rewardTokens.length !== rewardAmounts.length
    ) {
        throw new Error("reward tokens and amounts need to be the same length");
    }
    if (fund) {
        for (let i = 0; i < rewardTokens.length; i++) {
            // funds are sent directly to the distribution contract (this
            // wouldn't necessarily be needed if using the factory to
            // bootstrap distributions)
            if (rewardTokens[i].address === ZERO_ADDRESS) continue;
            await rewardTokens[i].mint(from, rewardAmounts[i]);
            await rewardTokens[i].approve(
                erc20DistributionFactoryInstance.address,
                rewardAmounts[i]
            );
        }
    }
    // if not specified, the distribution starts the next 10 second from now
    const currentEvmTimestamp = await getEvmTimestamp();
    const campaignStartingTimestamp =
        startingTimestamp && startingTimestamp.gte(currentEvmTimestamp)
            ? new BN(startingTimestamp)
            : // defaults to 10 seconds in the future
              currentEvmTimestamp.add(new BN(10));
    const campaignEndingTimestamp = campaignStartingTimestamp.add(
        new BN(duration)
    );
    await erc20DistributionFactoryInstance.createDistribution(
        rewardTokens.map((instance) => instance.address),
        stakableToken.address,
        rewardAmounts,
        campaignStartingTimestamp,
        campaignEndingTimestamp,
        locked,
        stakingCap,
        { from }
    );
    return {
        erc20DistributionInstance: await ERC20StakingRewardsDistribution.at(
            await erc20DistributionFactoryInstance.distributions(
                (await erc20DistributionFactoryInstance.getDistributionsAmount()) -
                    1
            )
        ),
        startingTimestamp: campaignStartingTimestamp,
        endingTimestamp: campaignEndingTimestamp,
    };
};

exports.initializeDistributionFromFactory = async ({
    from,
    erc20DistributionFactoryInstance,
    stakableToken,
    rewardTokens,
    rewardAmounts,
    duration,
    startingTimestamp,
    fund = true,
    skipRewardTokensAmountsConsistenyCheck,
    locked = false,
    stakingCap = 0,
}) => {
    if (
        !skipRewardTokensAmountsConsistenyCheck &&
        rewardTokens.length !== rewardAmounts.length
    ) {
        throw new Error("reward tokens and amounts need to be the same length");
    }
    if (fund) {
        for (let i = 0; i < rewardTokens.length; i++) {
            await rewardTokens[i].mint(from, rewardAmounts[i]);
            await rewardTokens[i].approve(
                erc20DistributionFactoryInstance.address,
                rewardAmounts[i]
            );
        }
    }
    // if not specified, the distribution starts the next 10 second from now
    const currentEvmTimestamp = await getEvmTimestamp();
    const campaignStartingTimestamp =
        startingTimestamp && startingTimestamp.gte(currentEvmTimestamp)
            ? new BN(startingTimestamp)
            : // defaults to 10 seconds in the future
              currentEvmTimestamp.add(new BN(10));
    const campaignEndingTimestamp = campaignStartingTimestamp.add(
        new BN(duration)
    );
    await erc20DistributionFactoryInstance.createDistribution(
        rewardTokens.map((instance) => instance.address),
        stakableToken.address,
        rewardAmounts,
        campaignStartingTimestamp,
        campaignEndingTimestamp,
        locked,
        stakingCap,
        { from }
    );
    return {
        initializedErc20DistributionInstance: ERC20StakingRewardsDistribution.at(
            await erc20DistributionFactoryInstance.distributions(
                (await erc20DistributionFactoryInstance.getDistributionsAmount()) -
                    1
            )
        ),
        startingTimestamp: campaignStartingTimestamp,
        endingTimestamp: campaignEndingTimestamp,
    };
};

exports.stake = async (
    erc20DistributionInstance,
    from,
    amount,
    waitForReceipt = true
) => {
    if (waitForReceipt) {
        await erc20DistributionInstance.stake(amount, { from });
    } else {
        // Make sure the transaction has actually been queued before returning
        return new Promise((resolve, reject) => {
            erc20DistributionInstance
                .stake(amount, { from })
                .on("transactionHash", resolve)
                .on("error", reject)
                .then(resolve)
                .catch(reject);
        });
    }
};

exports.stakeAtTimestamp = async (
    erc20DistributionInstance,
    from,
    amount,
    timestamp
) => {
    await stopMining();
    // Make sure the transaction has actually been queued before returning
    const hash = await new Promise((resolve, reject) => {
        erc20DistributionInstance
            .stake(amount, { from })
            .on("transactionHash", resolve)
            .on("error", reject)
            .then(resolve)
            .catch(reject);
    });
    await mineBlock(new BN(timestamp).toNumber());
    // By resolving the promise above when the transaction is included in the block,
    // but we need to find a way to detect reverts and error messages, to check on them in tests.
    // We can do so by getting the full transaction that was mined on-chain and "simulating"
    // it using the eth_call method (no on-chain state is changed).
    // We only do this if the transaction actually reverted on-chain after mining the block.
    // If we wouldn't perform this check, the simulation might fail because the tx changed
    // the contracts state, while if the tx reverted, we're sure to have the exact same simulation environment.
    try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (!receipt.status) {
            await web3.eth.call(await web3.eth.getTransaction(hash));
        }
    } finally {
        await startMining();
    }
    await startMining();
};

exports.withdraw = async (
    erc20DistributionInstance,
    from,
    amount,
    waitForReceipt = true
) => {
    if (waitForReceipt) {
        await erc20DistributionInstance.withdraw(amount, { from });
        return new BN(await web3.eth.getBlockNumber());
    } else {
        // Make sure the transaction has actually been queued before returning
        return new Promise((resolve, reject) => {
            erc20DistributionInstance
                .withdraw(amount, { from })
                .on("transactionHash", resolve)
                .on("error", reject)
                .then(resolve)
                .catch(reject);
        });
    }
};

exports.withdrawAtTimestamp = async (
    erc20DistributionInstance,
    from,
    amount,
    timestamp
) => {
    await stopMining();
    // Make sure the transaction has actually been queued before returning
    const hash = await new Promise((resolve, reject) => {
        erc20DistributionInstance
            .withdraw(amount, { from })
            .on("transactionHash", resolve)
            .on("error", reject)
            .then(resolve)
            .catch(reject);
    });
    await mineBlock(new BN(timestamp).toNumber());
    // By resolving the promise above when the transaction is included in the block,
    // but we need to find a way to detect reverts and error messages, to check on them in tests.
    // We can do so by getting the full transaction that was mined on-chain and "simulating"
    // it using the eth_call method (no on-chain state is changed).
    // We only do this if the transaction actually reverted on-chain after mining the block.
    // If we wouldn't perform this check, the simulation might fail because the tx changed
    // the contracts state, while if the tx reverted, we're sure to have the exact same simulation environment.
    try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (!receipt.status) {
            await web3.eth.call(await web3.eth.getTransaction(hash));
        }
    } finally {
        await startMining();
    }
};

exports.recoverUnassignedRewardsAtTimestamp = async (
    erc20DistributionInstance,
    from,
    timestamp
) => {
    await stopMining();
    // Make sure the transaction has actually been queued before returning
    const hash = await new Promise((resolve, reject) => {
        erc20DistributionInstance
            .recoverUnassignedRewards({ from })
            .on("transactionHash", resolve)
            .on("error", reject)
            .then(resolve)
            .catch(reject);
    });
    await mineBlock(new BN(timestamp).toNumber());
    // By resolving the promise above when the transaction is included in the block,
    // but we need to find a way to detect reverts and error messages, to check on them in tests.
    // We can do so by getting the full transaction that was mined on-chain and "simulating"
    // it using the eth_call method (no on-chain state is changed).
    // We only do this if the transaction actually reverted on-chain after mining the block.
    // If we wouldn't perform this check, the simulation might fail because the tx changed
    // the contracts state, while if the tx reverted, we're sure to have the exact same simulation environment.
    try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (!receipt.status) {
            await web3.eth.call(await web3.eth.getTransaction(hash));
        }
    } finally {
        await startMining();
    }
};

exports.claimAllAtTimestamp = async (
    erc20DistributionInstance,
    from,
    recipient,
    timestamp
) => {
    await stopMining();
    // Make sure the transaction has actually been queued before returning
    const hash = await new Promise((resolve, reject) => {
        erc20DistributionInstance
            .claimAll(recipient, { from })
            .on("transactionHash", resolve)
            .on("error", reject)
            .then(resolve)
            .catch(reject);
    });
    await mineBlock(new BN(timestamp).toNumber());
    // By resolving the promise above when the transaction is included in the block,
    // but we need to find a way to detect reverts and error messages, to check on them in tests.
    // We can do so by getting the full transaction that was mined on-chain and "simulating"
    // it using the eth_call method (no on-chain state is changed).
    // We only do this if the transaction actually reverted on-chain after mining the block.
    // If we wouldn't perform this check, the simulation might fail because the tx changed
    // the contracts state, while if the tx reverted, we're sure to have the exact same simulation environment.
    try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (!receipt.status) {
            await web3.eth.call(await web3.eth.getTransaction(hash));
        }
    } finally {
        await startMining();
    }
};

exports.claimPartiallyAtTimestamp = async (
    erc20DistributionInstance,
    from,
    amounts,
    recipient,
    timestamp
) => {
    await stopMining();
    // Make sure the transaction has actually been queued before returning
    const hash = await new Promise((resolve, reject) => {
        erc20DistributionInstance
            .claim(amounts, recipient, { from })
            .on("transactionHash", resolve)
            .on("error", reject)
            .then(resolve)
            .catch(reject);
    });
    await mineBlock(new BN(timestamp).toNumber());
    // By resolving the promise above when the transaction is included in the block,
    // but we need to find a way to detect reverts and error messages, to check on them in tests.
    // We can do so by getting the full transaction that was mined on-chain and "simulating"
    // it using the eth_call method (no on-chain state is changed).
    // We only do this if the transaction actually reverted on-chain after mining the block.
    // If we wouldn't perform this check, the simulation might fail because the tx changed
    // the contracts state, while if the tx reverted, we're sure to have the exact same simulation environment.
    try {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (!receipt.status) {
            await web3.eth.call(await web3.eth.getTransaction(hash));
        }
    } finally {
        await startMining();
    }
};
