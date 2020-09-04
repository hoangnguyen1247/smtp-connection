import { describe, it } from "mocha";
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe("Test", () => {
    describe("Test 1", () => {
        it("should be return 1", async () => {
            const no = 1;
            expect(no).eq(1);
        })

        it("should be return 2", async () => {
            const no = 1;
            expect(no).eq(1);
        })
    })
})
