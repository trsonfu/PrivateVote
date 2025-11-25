import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { PrivateVote, PrivateVote__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PrivateVote")) as PrivateVote__factory;
  const contract = (await factory.deploy()) as PrivateVote;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("PrivateVote", function () {
  let signers: Signers;
  let contract: PrivateVote;
  let address: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only on fhevm mock env");
      this.skip();
    }
    ({ contract, address } = await deployFixture());
  });

  it("creates proposal and tallies encrypted votes", async function () {
    const now = BigInt(await time.latest());
    const start = now;
    const end = now + 3600n;
    const tx = await contract.connect(signers.alice).createProposal("Title", ["A", "B", "C"], start, end);
    await tx.wait();

    const count = await contract.getProposalCount();
    expect(count).eq(1n);

    // Vote for option 1 and 0 (encrypted index)
    const enc1 = await fhevm.createEncryptedInput(address, signers.alice.address).add32(1).encrypt();
    await (await contract.connect(signers.alice).vote(0, enc1.handles[0], enc1.inputProof)).wait();
    const enc0 = await fhevm.createEncryptedInput(address, signers.bob.address).add32(0).encrypt();
    await (await contract.connect(signers.bob).vote(0, enc0.handles[0], enc0.inputProof)).wait();

    // Decrypt option 1 count
    const encCt1 = await contract.getEncryptedCount(0, 1);
    const dec1 = await fhevm.userDecryptEuint(FhevmType.euint32, encCt1, address, signers.alice);
    expect(dec1).eq(1);

    const encCt0 = await contract.getEncryptedCount(0, 0);
    const dec0 = await fhevm.userDecryptEuint(FhevmType.euint32, encCt0, address, signers.alice);
    expect(dec0).eq(1);
  });

  it("prevents double voting", async function () {
    const now = BigInt(await time.latest());
    const start = now;
    const end = now + 3600n;
    await (await contract.connect(signers.alice).createProposal("Title", ["A", "B"], start, end)).wait();

    const encA0 = await fhevm.createEncryptedInput(address, signers.alice.address).add32(0).encrypt();
    await (await contract.connect(signers.alice).vote(0, encA0.handles[0], encA0.inputProof)).wait();
    const encA1 = await fhevm.createEncryptedInput(address, signers.alice.address).add32(1).encrypt();
    await expect(contract.connect(signers.alice).vote(0, encA1.handles[0], encA1.inputProof)).to.be.revertedWith(
      "already voted",
    );
  });

  it("finalizes votes via self-relayed decryption", async function () {
    const snapshotId = await ethers.provider.send("evm_snapshot", []);
    try {
      const now = BigInt(await time.latest());
      const start = now;
      const end = now + 60n;
      await (await contract.connect(signers.alice).createProposal("Finish", ["Yes", "No"], start, end)).wait();

      const encYes = await fhevm.createEncryptedInput(address, signers.alice.address).add32(0).encrypt();
      await (await contract.connect(signers.alice).vote(0, encYes.handles[0], encYes.inputProof)).wait();
      const encNo = await fhevm.createEncryptedInput(address, signers.bob.address).add32(1).encrypt();
      await (await contract.connect(signers.bob).vote(0, encNo.handles[0], encNo.inputProof)).wait();

      await time.increaseTo(end + 5n);

      await (await contract.requestFinalize(0)).wait();
      const encryptedCounts = (await contract.getEncryptedCounts(0)).map((h) => h as `0x${string}`);
      const publicDecryptResults = await fhevm.publicDecrypt(encryptedCounts);
      await (
        await contract.submitDecryption(
          0,
          publicDecryptResults.abiEncodedClearValues,
          publicDecryptResults.decryptionProof,
        )
      ).wait();

      const results = await contract.getResults(0);
      expect(Number(results[0])).to.equal(1);
      expect(Number(results[1])).to.equal(1);
    } finally {
      await ethers.provider.send("evm_revert", [snapshotId]);
    }
  });
});
