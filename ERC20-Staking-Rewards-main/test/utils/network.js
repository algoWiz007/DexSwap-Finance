const BN = require("bn.js");

const getEvmTimestamp = async () => {
    const { timestamp } = await web3.eth.getBlock("latest");
    return new BN(timestamp);
};
exports.getEvmTimestamp = getEvmTimestamp;

exports.stopMining = async () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({ method: "miner_stop" }, (error) => {
            if (error) {
                console.error("error stopping instamining", error);
                return reject(error);
            }
            return resolve();
        });
    });
};

exports.startMining = async () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({ method: "miner_start" }, (error) => {
            if (error) {
                console.error("error resuming instamining", error);
                return reject(error);
            }
            return resolve();
        });
    });
};

const mineBlock = async (timestamp) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                id: Date.now(),
                jsonrpc: "2.0",
                method: "evm_mine",
                params: timestamp ? [new BN(timestamp).toNumber()] : [],
            },
            (error) => {
                if (error) {
                    console.error("error mining block", error);
                    return reject(error);
                }
                return resolve();
            }
        );
    });
};
exports.mineBlock = mineBlock;

exports.fastForwardTo = async ({ timestamp, mineBlockAfter = true }) => {
    const evmTimestamp = await getEvmTimestamp();
    return new Promise((resolve, reject) => {
        const secondsInterval =
            new BN(timestamp).toNumber() - evmTimestamp.toNumber();
        web3.currentProvider.send(
            {
                method: "evm_increaseTime",
                params: [secondsInterval],
            },
            (error) => {
                if (error) {
                    console.error("error mining blocks", error);
                    return reject(error);
                }
                if (mineBlockAfter) {
                    // mining a block persists the increased time on-chain. This lets us fetch the current EVM
                    // timestamp by querying the last mined block and taking its timestamp.
                    mineBlock()
                        .then(resolve)
                        .catch((error) => {
                            console.error(
                                "error mining block after fast forwarding",
                                error
                            );
                            return reject(error);
                        });
                } else {
                    resolve();
                }
            }
        );
    });
};
