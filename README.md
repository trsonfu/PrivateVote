# FHEDBACK PrivateVote

FHEDBACK PrivateVote is an on-chain survey and voting platform that relies on Zama’s Fully Homomorphic Encryption (FHE)
to keep every ballot private end-to-end. The `PrivateVote` smart contract manages the entire proposal lifecycle on
Ethereum (Sepolia), while a React + Vite frontend guides users through creating proposals, casting encrypted votes, and
finalizing public decryptions.

## Overview

- **Solidity smart contract**: stores proposals, tallies encrypted ballots, and only exposes cleartext results once a
  valid decryption proof is submitted.
- **Frontend**: React 19, Vite 7, RainbowKit/Wagmi for wallet connectivity, and `@zama-fhe/relayer-sdk` for client-side
  encryption + public decrypt.
- **Hardhat toolchain**: `@fhevm/hardhat-plugin`, TypeChain, custom tasks, and tests that exercise FHE logic both in
  mock environments and on real networks.

## Architecture

- **Smart-contract layer** (`contracts/PrivateVote.sol`): uses `@fhevm/solidity` primitives so every arithmetic
  operation on ballots happens directly on ciphertexts. Only limited decrypt permissions are granted during the voting
  window.
- **Application layer** (`frontend/`): a single-page app with Home, View Proposals, and Create Proposal routes. Hooks
  (`useZamaInstance`, `useEthersSigner`) wrap the Zama SDK and Wagmi signer to keep encryption flows declarative.
- **Tooling & DevOps**: Hardhat Deploy for repeatable releases, `scripts/deployAndTest.ts` for rapid smoke tests, and
  CLI tasks to manage proposals straight from the terminal.

## Key Features

- Create proposals with up to 16 options and configurable voting windows.
- Fully anonymous voting: selected option indices are encrypted in the browser before any on-chain interaction.
- Double-vote protection enforced in Solidity through `hasVoted`.
- Transparent two-step finalization:
  - `requestFinalize` flips ciphertexts into a “publicly decryptable” state.
  - `submitDecryption` verifies Zama proofs and writes clear counts.
- Frontend UX: status-aware proposal cards, Zama encryption badge, toast notifications, and filters for
  active/upcoming/ended/finalized polls.

## Repository Layout

| Path                        | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `contracts/PrivateVote.sol` | Core contract that manages the proposal lifecycle          |
| `deploy/privateVote.ts`     | Hardhat Deploy script                                      |
| `tasks/PrivateVote.ts`      | CLI tasks for creating, voting, decrypting                 |
| `test/`                     | FHE-aware integration tests and simple regression suites   |
| `frontend/src/components/`  | Header, VoteApp shell, voting modules (create/list/detail) |
| `frontend/src/hooks/`       | Wagmi signer + Zama SDK hooks                              |
| `frontend/src/config/`      | Contract address/ABI bindings and Wagmi config             |

## PrivateVote Contract Highlights

- **Proposal storage**

```8:24:contracts/PrivateVote.sol
    struct Proposal {
        string title;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        address creator;
        bool finalized;
        bool decryptionPending;
        euint32[] counts; // encrypted counts per option
        uint32[] clearCounts; // revealed counts after finalize
        uint256 voterCount; // total voters (plaintext)
    }
```

- **Proposal creation**: validates inputs, initializes ciphertext arrays, and emits `ProposalCreated`.

```39:91:contracts/PrivateVote.sol
    function createProposal(
        string memory title,
        string[] memory options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "empty title");
        require(options.length >= 2 && options.length <= 16, "invalid options");
        require(endTime > startTime && endTime > block.timestamp, "invalid times");
        ...
        emit ProposalCreated(proposalId, title, options, startTime, endTime);
    }
```

- **Encrypted voting**: receives an `externalEuint32` option index, compares it homomorphically, and increments
  ciphertext counters only when the encrypted index matches.

```160:184:contracts/PrivateVote.sol
    function vote(
        uint256 proposalId,
        externalEuint32 encryptedIndex,
        bytes calldata inputProof
    ) external existingProposal(proposalId) {
        ...
        euint32 idx = FHE.fromExternal(encryptedIndex, inputProof);
        for (uint256 i = 0; i < p.counts.length; i++) {
            ebool matchI = FHE.eq(idx, FHE.asEuint32(uint32(i)));
            euint32 addend = FHE.select(matchI, FHE.asEuint32(1), FHE.asEuint32(0));
            p.counts[i] = FHE.add(p.counts[i], addend);
            FHE.allowThis(p.counts[i]);
            FHE.allow(p.counts[i], msg.sender);
            FHE.allow(p.counts[i], p.creator);
        }
        hasVoted[proposalId][msg.sender] = true;
        p.voterCount += 1;
        emit Voted(proposalId, msg.sender);
    }
```

- **Finalize flow**: `requestFinalize` toggles `decryptionPending` and calls `FHE.makePubliclyDecryptable`, while
  `submitDecryption` runs `FHE.checkSignatures`, writes `clearCounts`, and emits `Finalized`.

## Frontend Application

- `VoteApp` wraps the layout, router, and global toast state.
- `Header` renders navigation plus a `ConnectButton.Custom` from RainbowKit to show wallet status and the “🌀 FHEVM
  Testnet” badge.
- `ProposalList` fetches metadata via `viem`, sorts/filter proposals, and swaps to `ProposalDetail` when a card is
  selected.
- `ProposalDetail` handles:
  - `hasVoted` detection through ethers contract calls.
  - Vote submission using `useZamaInstance` + `instance.createEncryptedInput`.
  - Two-step finalization and UI feedback.

```166:249:frontend/src/components/vote/ProposalDetail.tsx
  const finalize = async () => {
    ...
      const contract = new Contract(PRIVATE_VOTE_ADDRESS, PRIVATE_VOTE_ABI, signer);
      let encryptedCounts: string[] = [];
      try {
        const tx = await contract.requestFinalize(id);
        await tx.wait();
        setPending(true);
      } catch (requestErr: unknown) {
        ...
      }
      encryptedCounts = (await contract.getEncryptedCounts(id)) as string[];
      if (!encryptedCounts.length) {
        throw new Error("No encrypted counts found");
      }
      const handles = encryptedCounts.map((h) => h as `0x${string}`);
      const publicDecryptResults = await instance.publicDecrypt(handles);
      const submitTx = await contract.submitDecryption(
        id,
        publicDecryptResults.abiEncodedClearValues,
        publicDecryptResults.decryptionProof,
      );
      await submitTx.wait();
      ...
  };
```

- `useZamaInstance` initializes the relayer SDK with `tfhe_bg.wasm` and `kms_lib_bg.wasm` served from `public/`, so
  encryption/decryption happens entirely in the browser.

## Environment Setup

1. **Prerequisites**: Node.js ≥ 22, npm ≥ 7, Git, an EVM wallet (MetaMask, Rainbow), and Sepolia RPC access
   (Infura/Alchemy) for testnet deployments.
2. **Install dependencies**
   ```bash
   npm install              # from repo root (Hardhat + contracts)
   cd frontend && npm install
   ```
3. **Configure Hardhat secrets** (via `.env` or `npx hardhat vars set`)
   - `MNEMONIC` or `PRIVATE_KEY`
   - `INFURA_API_KEY`
   - `ETHERSCAN_API_KEY` (optional verification)

## Running Locally

1. Start a local Hardhat node:
   ```bash
   npx hardhat node
   ```
2. Deploy contracts to localhost:
   ```bash
   npx hardhat deploy --network localhost
   ```
3. Launch the frontend dev server:
   ```bash
   cd frontend
   npm run dev
   ```

   - Update `frontend/src/config/contract.ts` with your local address.
   - Provide a valid WalletConnect `projectId` in `frontend/src/config/wagmi.ts`.
4. Connect your wallet (Hardhat chain or Sepolia) at `http://localhost:5173`, create a proposal, and test encrypted
   voting.

## Helpful Tasks & Scripts

- `npx hardhat test` / `npm run coverage`: executes Solidity tests, including mock FHE flows (`test/PrivateVote.ts`).
- `npx hardhat <task>`:
  - `sv:address`, `sv:create --title ...`, `sv:vote --id --opt`, `sv:finalize --id`, etc.
- `npm run deploy:sepolia`: deploy via Hardhat Deploy (requires network config and funded key).
- `ts-node scripts/deployAndTest.ts`: quick deploy + demonstration vote.

## Quality & Testing

- **Contract tests**: verify proposal creation, double-vote protection, and finalize/public decrypt logic on the `fhevm`
  mock environment.
- **Frontend lint/tests**: run `npm run lint` both in the root and `frontend/` to keep TS/React code clean.
- **Gas & coverage**: set `REPORT_GAS=1` before `npm run test` for gas reports; `npm run coverage` to produce Solidity
  coverage.

## Deploying to Sepolia

1. Export the required env vars and fund the deployment account with Sepolia ETH.
2. Deploy:
   ```bash
   npx hardhat deploy --network sepolia
   ```
3. (Optional) Verify the contract:
   ```bash
   npx hardhat verify --network sepolia <PRIVATE_VOTE_ADDRESS>
   ```
4. Update `frontend/src/config/contract.ts` with the new address and redeploy the frontend (`npm run build` →
   Netlify/Vercel/Static host).

## Keeping Frontend & Contract in Sync

- `frontend/src/config/contract.ts` exports the contract address plus the generated ABI from
  `deployments/sepolia/PrivateVote.json`. Always refresh this file when redeploying.
- `frontend/src/config/wagmi.ts` must contain a valid WalletConnect `projectId` and the chain list you intend to support
  (Sepolia by default).
- The FHE WASM artifacts (`public/tfhe_bg.wasm`, `public/kms_lib_bg.wasm`) must be served in both dev and production
  builds because `useZamaInstance` fetches them at runtime.

## Troubleshooting

- **`Encryption: Error` badge**: inspect browser logs and ensure the WASM files are reachable (`/tfhe_bg.wasm`,
  `/kms_lib_bg.wasm`). Configure your CDN to serve them with `application/wasm`.
- **Finalize disabled**: confirm at least one vote exists, the current time exceeds `endTime`, and sign both
  transactions (`requestFinalize`, `submitDecryption`).
- **Unsupported network warning**: adjust the Wagmi/RainbowKit chain configuration to match the connected network.
- **Skipped FHE tests**: the FHE plugin requires the mock environment (`fhevm.isMock`). When running against other
  nodes, set `HARDHAT_FHEVM_MOCK=1` or use the default Hardhat network.

## License & Dependencies

- Smart contracts are released under the MIT license (see `LICENSE`).
- Core dependencies: `@fhevm/solidity`, `@zama-fhe/relayer-sdk`, `wagmi`, `RainbowKit`, `viem`, ethers v6, React 19,
  Vite 7.

Use this README as a guide for architecture, setup, testing, and deployment so you can confidently extend or audit
FHEDBACK PrivateVote. Happy building encrypted polls!
