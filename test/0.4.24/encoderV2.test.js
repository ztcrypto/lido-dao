const { assert } = require('chai')
const { newDao, newApp } = require('./helpers/dao')
const { assertBn, assertRevert, assertEvent } = require('@aragon/contract-helpers-test/src/asserts')
const { bn } = require('@aragon/contract-helpers-test')
const { default: Web3 } = require('web3')
const { getWeb3 } = require('@aragon/contract-helpers-test/src/config/web3')

const LidoOracle = artifacts.require('LidoOracleMock.sol')
const EncoderV2Test = artifacts.require('EncoderV2Test.sol')
const DelegateProxy = artifacts.require('MyDelegateProxy.sol')

contract('LidoOracle', ([appManager, voting, user1, user2, user3, user4, nobody]) => {
  let oracleBase, oracle, oracleProxyAddress

  describe('', function () {
    this.timeout(100000)

    before(async () => {
      oracleBase = await LidoOracle.new()
    })

    beforeEach('deploy dao and oracle', async () => {
      const { dao, acl } = await newDao(appManager)

      // Instantiate a proxy for the oracle, using the base contract as its logic implementation.
      oracleProxyAddress = await newApp(dao, 'lidooracle', oracleBase.address, appManager)
      oracle = await LidoOracle.at(oracleProxyAddress)

      // Set up the oracle's permissions.
      await acl.createPermission(voting, oracle.address, await oracle.MANAGE_MEMBERS(), appManager, { from: appManager })
      await acl.createPermission(voting, oracle.address, await oracle.MANAGE_QUORUM(), appManager, { from: appManager })
      await acl.createPermission(voting, oracle.address, await oracle.SET_BEACON_SPEC(), appManager, { from: appManager })

      // Initialize the oracle's proxy.
      await oracle.initialize('0x0000000000000000000000000000000000000000', 1, 32, 12, 1606824000)
    })

    describe('Test the new getters', function () {
      beforeEach(async () => {
        await oracle.setTime(1606824000)
        await oracle.addOracleMember(user1, { from: voting })
        assertBn(await oracle.getQuorum(), 1)
      })

      it('getLastPushedFrame raw call works', async () => {
        console.log(web3.version)
        oracle = new web3.eth.Contract(LidoOracle.abi, oracleProxyAddress)
        txn_data = oracle.methods.getLastPushedFrame().encodeABI()
        console.log(txn_data)
        result = await web3.eth.call({ to: oracleProxyAddress, data: txn_data })
        console.log(result)
      })

      it('getLastPushedFrame works', async () => {
        console.log(await oracle.getLastPushedFrame())
        await oracle.reportBeacon(0, 32, 1, { from: user1 })
        console.log(await oracle.getLastPushedFrame())
      })

      it('getReportableFrames works', async () => {
        console.log(await oracle.getReportableFrames())
        await oracle.reportBeacon(0, 32, 1, { from: user1 })
        console.log(await oracle.getReportableFrames())
      })
    })

    describe('Test EncoderV2 check functions', function () {
      it('testEncoderV2 raw call works', async () => {
        oracle = new web3.eth.Contract(LidoOracle.abi, oracleProxyAddress)
        txn_data = oracle.methods.testEncoderV2(1).encodeABI()
        result = await web3.eth.call({ to: oracleProxyAddress, data: txn_data })
        console.log(result)
      })

      it('testEncoderV2 call works', async () => {
        result = await oracle.testEncoderV2(2)
        console.log(result)
      })
    })
  })
})

contract('EncoderV2Test', ([appManager]) => {
  let app_impl, app_proxy, app

  describe('deploy via dao', () => {
    beforeEach('deploy base oracle', async () => {
      app_impl = await EncoderV2Test.new()
      const { dao } = await newDao(appManager)
      app_proxy = await newApp(dao, 'encoderTest', app_impl.address, appManager)
      app = await EncoderV2Test.at(app_proxy)
      await app.initialize()
    })

    it('testEncoderV2 call works', async () => {
      result = await app.testEncoderV2(2)
      console.log(result)
    })
  })

  describe('deploy with custom proxy contract', () => {
    beforeEach('deploy base oracle', async () => {
      app_impl = await EncoderV2Test.new()
      app_proxy = await DelegateProxy.new()

      await app_proxy.setImpl(app_impl.address)
      assert.equal(await app_proxy.impl(), app_impl.address)

      app = await EncoderV2Test.at(app_proxy.address)
    })

    it('testEncoderV2 raw call works', async () => {
      enc = new web3.eth.Contract(EncoderV2Test.abi, app_proxy.address)
      txn_data = enc.methods.testEncoderV2(1).encodeABI()
      result = await web3.eth.call({ to: app_proxy.address, data: txn_data })
      console.log(result)
    })

    it('testEncoderV2 call works', async () => {
      result = await app.testEncoderV2(2)
      console.log(result)
    })
  })
})
