const WBTC = artifacts.require("WBTC");
const DIGG = artifacts.require("DIGG");
const USDT = artifacts.require("USDT");


const argValue = (arg, defaultValue) => process.argv.includes(arg) ? process.argv[process.argv.indexOf(arg) + 1] : defaultValue
const network = () => argValue('--network', 'local')


module.exports = async (deployer) => {

    const BN = web3.utils.toBN;
    const bnWithDecimals = (number, decimals) => BN(number).mul(BN(10).pow(BN(decimals)));
    const senderAccount = (await web3.eth.getAccounts())[0];

    if (network() === "rinkeby") {

        console.log();
        console.log(":: Start Deploying Mock WBTC");
        await deployer.deploy(WBTC);
        const WBTCInstance = await WBTC.deployed();

        console.log();
        console.log(":: Start Deploying Mock USDT");
        await deployer.deploy(USDT);
        const USDTInstance = await USDT.deployed();

        console.log();
        console.log(":: Start Deploying Mock DIGG");
        await deployer.deploy(DIGG);
        const DIGGInstance = await DIGG.deployed();


        console.log("MINT WBTC <> USDT <> DIGG");
        await USDTInstance.mint(senderAccount,    bnWithDecimals(100000, 6),  { from: senderAccount }); // - 100k
        await WBTCInstance.mint(senderAccount,    bnWithDecimals(10000, 8),   { from: senderAccount }); // - 10k
        await DIGGInstance.mint(senderAccount,    bnWithDecimals(10000, 9),   { from: senderAccount }); // - 100k
        console.log();


        console.log("====================================================================");
        console.log(`WBTC Address:`,         WBTCInstance.address);
        console.log("====================================================================");

        console.log("====================================================================");
        console.log(`USDT Address:`,         USDTInstance.address);
        console.log("====================================================================");

        console.log("====================================================================");
        console.log(`DIGG Address:`,         DIGGInstance.address);
        console.log("====================================================================");

    } else if (network() === "mumbai") {

        console.log();
        console.log(":: Start Deploying Mock WBTC");
        await deployer.deploy(WBTC);
        const WBTCInstance = await WBTC.deployed();

        console.log();
        console.log(":: Start Deploying Mock USDT");
        await deployer.deploy(USDT);
        const USDTInstance = await USDT.deployed();

        console.log();
        console.log(":: Start Deploying Mock DIGG");
        await deployer.deploy(DIGG);
        const DIGGInstance = await DIGG.deployed();


        console.log("MINT WBTC <> USDT <> DIGG");
        await USDTInstance.mint(senderAccount,    bnWithDecimals(100000, 6),  { from: senderAccount }); // - 100k
        await WBTCInstance.mint(senderAccount,    bnWithDecimals(10000, 8),   { from: senderAccount }); // - 10k
        await DIGGInstance.mint(senderAccount,    bnWithDecimals(10000, 9),   { from: senderAccount }); // - 100k

        console.log();
        console.log("====================================================================");
        console.log(`WBTC Address:`,         WBTCInstance.address);
        console.log("====================================================================");

        console.log("====================================================================");
        console.log(`USDT Address:`,         USDTInstance.address);
        console.log("====================================================================");

        console.log("====================================================================");
        console.log(`DIGG Address:`,         DIGGInstance.address);
        console.log("====================================================================");

    } else if (network() === "matic") {}
};
