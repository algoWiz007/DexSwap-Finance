
const DexSwapFactory = artifacts.require("IDexSwapFactory");
const DexSwapRouter = artifacts.require("DexSwapRouter");
const BADGER = artifacts.require("BADGER");
const USDC = artifacts.require("USDC");
const WETH = artifacts.require("WETH");
const WMATIC = artifacts.require("WMATIC");
const argValue = (arg, defaultValue) => (process.argv.includes(arg) ? process.argv[process.argv.indexOf(arg) + 1] : defaultValue);
const network = () => argValue("--network", "local");

//RINKEBY ROPSTEN 
const FACTORY_RINKEBY = "";
const WETH_RINKEBY = "";
// MATIC MAINNET
const FACTORY_MATIC = "";
const WMATIC_MATIC = "";

// MATIC TESTNET
const FACTORY_MUMBAI = "";
const WMATIC_MUMBAI = "";

module.exports = async (deployer) => {
    const BN = web3.utils.toBN;
    const bnWithDecimals = (number, decimals) => BN(number).mul(BN(10).pow(BN(decimals)));
    const senderAccount = (await web3.eth.getAccounts())[0];

    
    if (network() === "rinkeby") {

        console.log();

        console.log();
        console.log(":: Deploying USDC");
        await deployer.deploy(USDC);
        const USDCInstance = await USDC.deployed();
        console.log();

        console.log();
        console.log(":: Deploying BADGER");
        await deployer.deploy(BADGER);
        const BADGERInstance = await BADGER.deployed();
        console.log();


        console.log();
        console.log(`USDC ADDRESS:`,          USDCInstance.address);
        console.log("====================================================================");
        console.log(`BADGER ADDRESS:`,        BADGERInstance.address);
        console.log("====================================================================");

        console.log();
        console.log(":: REUSE FACTORY");
        let DexSwapFactoryInstance = await DexSwapFactory.at(FACTORY_RINKEBY);
        console.log(`DEXSWAP FACTORY:`, DexSwapFactoryInstance.address);

        console.log();
        console.log(":: REUSE WETH"); 
        let WETHInstance = await WETH.at(WETH_RINKEBY);
        await WETHInstance.deposit({ from: senderAccount, value: 100 });

        console.log();
        console.log(":: DEPLOY ROUTER");
        await deployer.deploy(DexSwapRouter, DexSwapFactoryInstance.address, WETHInstance.address);
        const DexSwapRouterInstance = await DexSwapRouter.deployed();
        console.log(`DEXSWAP ROUTER:`, DexSwapRouterInstance.address);

        console.log(`Balance USDC Before:    ${await USDCInstance.balanceOf(senderAccount)}`);
        console.log("MINT");
        await USDCInstance.mint(senderAccount,      bnWithDecimals(100000, 18),       { from: senderAccount }); // - 100k
        await BADGERInstance.mint(senderAccount,    bnWithDecimals(100000, 18),       { from: senderAccount }); // - 100k

        console.log("APROVE");
        await BADGERInstance.approve(DexSwapRouterInstance.address, bnWithDecimals(100, 18), { from: senderAccount }); 
        await USDCInstance.approve(DexSwapRouterInstance.address, bnWithDecimals(100, 18),   { from: senderAccount }); 

        console.log();
        console.log("====================================================================");
        console.log(`Balance USDC After:       ${await USDCInstance.balanceOf(senderAccount)}`);
        console.log(`Balance BADGER After:     ${await BADGERInstance.balanceOf(senderAccount)}`);
        console.log("====================================================================");


        console.log(":: CREATE LP BADGER <> WETH  ::  "); 
        await DexSwapFactoryInstance.createPair(WETHInstance.address, BADGERInstance.address);
        const BADGER_WETH = await DexSwapFactoryInstance.getPair(WETHInstance.address, BADGERInstance.address);
        await DexSwapRouterInstance.addLiquidityETH(
            BADGERInstance.address, "11362203361583236458", 
            "11305392344775320275",  "49750000000000000", 
            senderAccount,  Math.floor(Date.now() / 1000) + 60 * 10,
            {from: senderAccount, value: "22620789529395432"}
        );
        console.log("BADGER WETH POOL:", BADGER_WETH);

        console.log();
        console.log(":: CREATE LP USDC <> WETH  ::  "); 
        await DexSwapFactoryInstance.createPair(WETHInstance.address, USDCInstance.address);
        const USDC_WETH = await DexSwapFactoryInstance.getPair(WETHInstance.address, USDCInstance.address);
        await DexSwapRouterInstance.addLiquidityETH(
            USDCInstance.address, "50000000000000000000", 
            "49750000000000000000",  "22620789529395432", 
            senderAccount,  Math.floor(Date.now() / 1000) + 60 * 10,
            {from: senderAccount, value: "22620789529395432"}
        );

        console.log("USDC WETH POOL:", USDC_WETH);

    } else if (network() === "mumbai") {

        console.log();
        console.log(":: REUSE FACTORY");
        let DexSwapFactoryInstance = await DexSwapFactory.at(FACTORY_MUMBAI);
        console.log(`DEXSWAP FACTORY:`, DexSwapFactoryInstance.address);


        console.log();
        console.log(":: DEPLOY ROUTER");
        await deployer.deploy(DexSwapRouter, DexSwapFactoryInstance.address, WMATIC_MUMBAI);
        const DexSwapRouterInstance = await DexSwapRouter.deployed();
        console.log(`DEXSWAP ROUTER:`, DexSwapRouterInstance.address);


    } else if (network() === "matic") {

        console.log();
        console.log(":: REUSE FACTORY");
        let DexSwapFactoryInstance = await DexSwapFactory.at(FACTORY_MATIC);
        console.log(`DEXSWAP FACTORY:`, DexSwapFactoryInstance.address);

        console.log();
        console.log(":: DEPLOY ROUTER");
        await deployer.deploy(DexSwapRouter, DexSwapFactoryInstance.address, WMATIC_MATIC);
        const DexSwapRouterInstance = await DexSwapRouter.deployed();
        console.log(`DEXSWAP ROUTER:`, DexSwapRouterInstance.address);

    }
};
