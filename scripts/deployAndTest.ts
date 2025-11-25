import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SecretVote contract...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const SecretVote = await ethers.getContractFactory("SecretVote");
  const secretVote = await SecretVote.deploy();
  await secretVote.waitForDeployment();
  
  const contractAddress = await secretVote.getAddress();
  console.log("✅ SecretVote deployed to:", contractAddress);
  
  // Test basic functionality
  console.log("\n📊 Testing basic functionality...");
  
  const startTime = Math.floor(Date.now() / 1000) + 60; // Start in 1 minute
  const endTime = startTime + 3600; // End in 1 hour
  
  console.log("Creating a test vote...");
  const tx = await secretVote.createVote(
    "Favorite Programming Language",
    ["JavaScript", "TypeScript", "Rust", "Go"],
    startTime,
    endTime
  );
  await tx.wait();
  console.log("✅ Vote created successfully!");
  
  const totalVotes = await secretVote.getTotalVotes();
  console.log("📈 Total votes created:", totalVotes.toString());
  
  const voteInfo = await secretVote.getVoteInfo(0);
  console.log("📋 Vote details:");
  console.log("  Title:", voteInfo.title);
  console.log("  Options:", voteInfo.options);
  console.log("  Start time:", new Date(Number(voteInfo.startTime) * 1000).toISOString());
  console.log("  End time:", new Date(Number(voteInfo.endTime) * 1000).toISOString());
  console.log("  Creator:", voteInfo.creator);
  console.log("  Is decrypted:", voteInfo.isDecrypted);
  
  console.log("\n🎉 Deployment and testing completed!");
  console.log("🔗 Contract Address:", contractAddress);
  console.log("\nTo update frontend, edit /home/src/wagmi.ts:");
  console.log(`export const contractAddress = "${contractAddress}" as const;`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });