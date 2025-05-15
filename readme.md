# FITE2020 Group Project: Lottery smart contract
## Group Member: Mak Wan Sing 3035930709
## Setup

### 1. install dependencies
```bash
    npm install
```

### 2. compile the contract
```bash
    npx hardhat compile
```

## Testing
you may run testing by
```
    npx hardhat test
```

## Lottery Cycle
1. **Ticket Purchase**:
   - Each ticket costs 0.01 ETH, which is added to the current draw's prize pool.
   - Players select 4 unique numbers between 1 and 15.
   - Players provide a seed commitment (hash) during the commit phase.

2. **Ticket Reveal**:
   - After the commit phase, a 12-hour reveal phase begins.
   - Players must reveal their seed, which must match the commitment hash provided during purchase.
   - Unrevealed tickets are ineligible for prizes, and the ticket price is not refunded.

3. **Draw Process**:
   - After the reveal phase, the contract owner triggers the draw.
   - Four random winning numbers are generated using the revealed seeds from all tickets.
   - Tickets that match all 4 winning numbers are declared winners.

4. **Prize Distribution**:
   - If there are winners, the prize pool is evenly split among them.
   - Winners can withdraw their prize using the `withdrawPrize` function.
   - If no winners are found, the prize pool carries over to the next draw.
