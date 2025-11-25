import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { PrivateVote } from "../types";
import type { Signer } from "ethers";

describe("PrivateVote - Simple Tests", function () {
  let privateVote: PrivateVote;
  let owner: Signer;
  let voter1: Signer;

  beforeEach(async function () {
    [owner, voter1] = await ethers.getSigners();

    const PrivateVoteFactory = await ethers.getContractFactory("PrivateVote");
    privateVote = await PrivateVoteFactory.deploy();
    await privateVote.waitForDeployment();
  });

  describe("Vote Creation", function () {
    it("Should create a vote with correct parameters", async function () {
      const title = "Test Vote";
      const options = ["Option A", "Option B"];
      const now = BigInt(await time.latest());
      const startTime = now + 60n; // Start in 1 minute
      const endTime = startTime + 3600n; // End 1 hour after start

      const tx = await privateVote.createVote(title, options, startTime, endTime);
      await tx.wait();

      // Check vote info
      const voteInfo = await privateVote.getVoteInfo(0);
      expect(voteInfo.title).to.equal(title);
      expect(voteInfo.options).to.deep.equal(options);
      expect(voteInfo.startTime).to.equal(startTime);
      expect(voteInfo.endTime).to.equal(endTime);
      expect(voteInfo.creator).to.equal(await owner.getAddress());
      expect(voteInfo.isDecrypted).to.equal(false);
    });

    it("Should track total votes correctly", async function () {
      expect(await privateVote.getTotalVotes()).to.equal(0);

      const now = BigInt(await time.latest());
      const startTime = now + 60n;
      const endTime = startTime + 3600n;

      // Create first vote
      await privateVote.createVote("Vote 1", ["A", "B"], startTime, endTime);
      expect(await privateVote.getTotalVotes()).to.equal(1);

      // Create second vote
      await privateVote.createVote("Vote 2", ["X", "Y"], startTime, endTime);
      expect(await privateVote.getTotalVotes()).to.equal(2);
    });

    it("Should revert with insufficient options", async function () {
      const title = "Invalid Vote";
      const options = ["Only Option"];
      const now = BigInt(await time.latest());
      const startTime = now + 60n;
      const endTime = startTime + 3600n;

      await expect(privateVote.createVote(title, options, startTime, endTime)).to.be.revertedWith(
        "Must have at least 2 options",
      );
    });

    it("Should revert with past start time", async function () {
      const title = "Past Vote";
      const options = ["A", "B"];
      const now = BigInt(await time.latest());
      const startTime = now > 60n ? now - 60n : 0n; // Past time
      const endTime = startTime + 3600n;

      await expect(privateVote.createVote(title, options, startTime, endTime)).to.be.revertedWith(
        "Start time must be in the future",
      );
    });

    it("Should revert with invalid time range", async function () {
      const title = "Invalid Time Vote";
      const options = ["A", "B"];
      const now = BigInt(await time.latest());
      const startTime = now + 3600n;
      const endTime = startTime - 1n; // End before start

      await expect(privateVote.createVote(title, options, startTime, endTime)).to.be.revertedWith(
        "End time must be after start time",
      );
    });
  });

  describe("Vote Information", function () {
    it("Should return correct vote information", async function () {
      const title = "Information Test";
      const options = ["Option 1", "Option 2", "Option 3"];
      const now = BigInt(await time.latest());
      const startTime = now + 120n;
      const endTime = startTime + 1800n;

      await privateVote.createVote(title, options, startTime, endTime);

      const voteInfo = await privateVote.getVoteInfo(0);
      expect(voteInfo.title).to.equal(title);
      expect(voteInfo.options).to.deep.equal(options);
      expect(voteInfo.startTime).to.equal(startTime);
      expect(voteInfo.endTime).to.equal(endTime);
      expect(voteInfo.creator).to.equal(await owner.getAddress());
      expect(voteInfo.isDecrypted).to.equal(false);
    });

    it("Should check hasVoted status", async function () {
      const now = BigInt(await time.latest());
      const startTime = now + 60n;
      const endTime = startTime + 3600n;

      await privateVote.createVote("Has Voted Test", ["A", "B"], startTime, endTime);

      // Initially, no one has voted
      expect(await privateVote.hasVoted(0, await owner.getAddress())).to.equal(false);
      expect(await privateVote.hasVoted(0, await voter1.getAddress())).to.equal(false);
    });
  });
});
