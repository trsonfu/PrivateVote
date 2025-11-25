import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

task("sv:address", "Print SecretVote address").setAction(async (_, hre) => {
  const { deployments } = hre;
  const d = await deployments.get("SecretVote");
  console.log(`SecretVote address: ${d.address}`);
});

task("sv:create", "Create a proposal")
  .addParam("title", "Title")
  .addParam("options", "Comma separated options")
  .addParam("start", "Start timestamp (seconds)")
  .addParam("end", "End timestamp (seconds)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const d = await deployments.get("SecretVote");
    const [signer] = await ethers.getSigners();
    const c = await ethers.getContractAt("SecretVote", d.address);
    const options = (args.options as string).split(",").map((s) => s.trim());
    const tx = await c.connect(signer).createProposal(args.title, options, BigInt(args.start), BigInt(args.end));
    console.log(`tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`status: ${rc?.status}`);
  });

task("sv:vote", "Vote on a proposal (encrypted)")
  .addParam("id", "Proposal id")
  .addParam("opt", "Option index")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const d = await deployments.get("SecretVote");
    const [signer] = await ethers.getSigners();
    const c = await ethers.getContractAt("SecretVote", d.address);

    const enc = await fhevm
      .createEncryptedInput(d.address, signer.address)
      .add32(parseInt(args.opt))
      .encrypt();

    const tx = await c.connect(signer).vote(parseInt(args.id), enc.handles[0], enc.inputProof);
    console.log(`tx: ${tx.hash}`);
    const rc = await tx.wait();
    console.log(`status: ${rc?.status}`);
  });

task("sv:decrypt-option", "Decrypt a specific option count (local/mock only)")
  .addParam("id", "Proposal id")
  .addParam("opt", "Option index")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const d = await deployments.get("SecretVote");
    const [signer] = await ethers.getSigners();
    const c = await ethers.getContractAt("SecretVote", d.address);
    const enc = await c.getEncryptedCount(parseInt(args.id), parseInt(args.opt));
    if (enc === ethers.ZeroHash) {
      console.log("Encrypted: 0x0\nClear: 0");
      return;
    }
    const clear = await fhevm.userDecryptEuint(FhevmType.euint32, enc, d.address, signer);
    console.log(`Encrypted: ${enc}\nClear: ${clear}`);
  });

task("sv:finalize", "Request finalize/decrypt totals")
  .addParam("id", "Proposal id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const d = await deployments.get("SecretVote");
    const [signer] = await ethers.getSigners();
    const c = await ethers.getContractAt("SecretVote", d.address);
    const proposalId = parseInt(args.id);
    const finalizeTx = await c.connect(signer).requestFinalize(proposalId);
    console.log(`requestFinalize tx: ${finalizeTx.hash}`);
    const finalizeRc = await finalizeTx.wait();
    console.log(`request status: ${finalizeRc?.status}`);

    const encryptedCounts = await c.getEncryptedCounts(proposalId);
    const publicDecryptResults = await fhevm.publicDecrypt(encryptedCounts);
    const submitTx = await c
      .connect(signer)
      .submitDecryption(proposalId, publicDecryptResults.abiEncodedClearValues, publicDecryptResults.decryptionProof);
    console.log(`submitDecryption tx: ${submitTx.hash}`);
    const submitRc = await submitTx.wait();
    console.log(`submit status: ${submitRc?.status}`);
  });
