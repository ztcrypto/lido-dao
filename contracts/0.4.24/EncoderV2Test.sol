pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "@aragon/os/contracts/apps/AragonApp.sol";


contract EncoderV2Test is AragonApp {
    using UnstructuredStorage for bytes32;

    struct TestStruct {
        uint256 a;
        uint256 b;
        uint256 c;
        InnerTestStruct[] d;
    }

    struct InnerTestStruct {
        address a;
        uint256 b;
    }

    bytes32 internal constant PARAM = keccak256("param");

    function initialize() public {
        initialized();
    }

    function setParam(uint256 _param) external {
        PARAM.setStorageUint256(_param);
    }

    function getParam() external view returns (uint256) {
        return PARAM.getStorageUint256();
    }

    function test() external pure returns (uint256) {
        return 123;
    }

    function testEncoderV2(uint256 n) external view returns (TestStruct[] memory testStructs) {
        testStructs = new TestStruct[](n);

        for (uint256 i = 0; i < n; i++) {
            (testStructs[i].a, testStructs[i].b, testStructs[i].c) = getData(i);
            testStructs[i].d = new InnerTestStruct[](i);
        }

        return testStructs;
    }

    function getData(uint256 i) internal view returns (uint256 a, uint256 b, uint256 c) {
        uint256 param = PARAM.getStorageUint256();
        return (i, param, i);
    }
}