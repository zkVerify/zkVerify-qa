import { describe } from "@jest/globals";
import evaluateResponse from "../../../utils/evaluateResponse";
import patternGenerator from "../../../utils/patternGenerator";
import chain_getHeader from "./index";

describe("chain_getHeader", () => {
  it("Returns an object representing the header information of the requested block", async () => {
    const blockHash = process.env.BLOCK_HASH ?? null;

    evaluateResponse({
      response: await chain_getHeader(blockHash),
      pattern: await patternGenerator.buildMainPattern({
        rpcDefinitionPath: "../schemas/definitions/chain.yaml",
        rpcName: "chain_getHeader",
      }),
    });
  });
});