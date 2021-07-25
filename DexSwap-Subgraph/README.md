# DexSwap Subgraph

### Gitcoin grant for:

1. Gitcoin Grants Round 10: Community Maintained Badger Subgraph : https://gitcoin.co/issue/Badger-Finance/gitcoin/4/100025929
2. The Graph - Subgraph Challenge: https://gitcoin.co/issue/graphprotocol/gitcoin-grants-round-10-hackathon/1/100026014

[DexSwap](https://github.com/Agin-DropDisco/DexSwapSubgraph) is Decentralized Protocol Optimizer for Automated Token Exchange on Ethereum <> Matic with Adjustable Fees

### [Subgraph on Rinkeby V1](https://thegraph.com/explorer/subgraph/agin-dropdisco/dexswap-rinkeby-gr10)
> Use BADGER as Native Value

### [Subgraph on Rinkeby v2](https://thegraph.com/legacy-explorer/subgraph/agin-dropdisco/gin-rinkeby-data?selected=playground)
> Use USD as Native Value

### [Subgraph on Matic](https://thegraph.com/legacy-explorer/subgraph/agin-dropdisco/dexswap-matic-gr10)
> Use USD as Native Value

### [Subgraph on Mumbai](https://thegraph.com/legacy-explorer/subgraph/agin-dropdisco/mumbai-data)
> Use USD as Native Value



 

This subgraph dynamically tracks any pair created by the DexSwap factory. It tracks of the current state of DexSwap contracts, and contains derived stats for things like historical data and BADGER prices.

- aggregated data across pairs and tokens,
- data on individual pairs and tokens,
- data on transactions
- data on liquidity providers
- historical data on DexSwap, pairs or tokens, aggregated by day

## Running Locally

Make sure to update package.json settings to point to your own graph account.

## Queries

Below are a few ways to show how to query the dexswap-subgraph for data. The queries show most of the information that is queryable, but there are many other filtering options that can be used, just check out the [querying api](https://thegraph.com/docs/graphql-api). These queries can be used locally or in The Graph Explorer playground.

## Key Entity Overviews

#### DexSwapFactory

Contains data across all of DexSwap. This entity tracks important things like total liquidity (in ETH, BADGER, DIGG and WBTC), all time volume, transaction count, number of pairs and more.

#### Token

Contains data on a specific token. This token specific data is aggregated across all pairs, and is updated whenever there is a transaction involving that token.

#### Pair

Contains data on a specific pair.

#### Transaction

Every transaction on DexSwap is stored. Each transaction contains an array of mints, burns, and swaps that occured within it.

#### Mint, Burn, Swap, Staking Rewards

These contain specifc information about a transaction. Things like which pair triggered the transaction, amounts, sender, recipient, and more. Each is linked to a parent Transaction entity.

## Example Queries

### Querying Aggregated DexSwap Data

#### Fully Support for BADGER [RINKEBY && MATIC]

- Simple Querry to check

- V1

```graphql
{
  dexswapFactories {
    id
    totalVolumeBADGER
  }
}
```
- V2

```graphql
{
  dexswapFactories {
    id
    totalVolumeUSD
  }
}
```


- Fetches Aggredated Data from all DexSwap Pairs and Tokens

- V1

```graphql
{
  dexswapFactories(first: 5) {
    id
    pairCount
    totalVolumeBADGER
    totalVolumeNativeCurrency
  }
  tokens(first: 5) {
    id
    symbol
    name
    decimals
  }
}
```

- V2

```graphql
{
  dexswapFactories(first: 5) {
    id
    pairCount
    totalVolumeUSD
    totalVolumeNativeCurrency
  }
  tokens(first: 5) {
    id
    symbol
    name
    decimals
  }
}
```

- Total Volume & Liquidity Factories

```graphql
{
  dexswapFactories(first: 1) {
    pairCount
    totalVolumeBADGER
    totalLiquidityBADGER
  }
}
```

- Total Volume and Liquidity BADGER 

```graphql
{
  token(id: "0x656d52d296609264cee25cb0c3a3d57151ea26f2") {
    name
    symbol
    decimals
    tradeVolumeBADGER
    totalLiquidity
  }
}
```

- Total Volume and Liquidity DIGG

```graphql
{
  token(id: "0x4d692461d6c8aebdf7d66b8dbfa38fef72720031") {
    name
    symbol
    decimals
    tradeVolumeBADGER
    totalLiquidity
  }
}
```

- This Query will be Null if Staking rewards in user token pair not being initalized with liquidity minning campaign.

```graphql
{
  dexswapStakingRewardsFactory(id: "0xd4e38c2e7b5a930d65e1e44a4ef5f72b4926a031") {
    initializedCampaignsCount
  }
}
```

- Count All Pairs 

```graphql
{
  dexswapFactories(first: 1) {
    pairCount
    totalVolumeBADGER
    totalLiquidityBADGER
  }
}
```

