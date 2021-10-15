const { newDao, newApp } = require('./0.4.24/helpers/dao')
const { assertBn, assertRevert } = require('@aragon/contract-helpers-test/src/asserts')
const { bn } = require('@aragon/contract-helpers-test')
const { BN } = require('bn.js')

const NodeOperatorsRegistry = artifacts.require('NodeOperatorsRegistry')

const Lido = artifacts.require('LidoMock.sol')
const OracleMock = artifacts.require('OracleMock.sol')
const DepositContract = artifacts.require('DepositContract')
const TestDeposit = artifacts.require('TestDeposit')

const ADDRESS_1 = '0x0000000000000000000000000000000000000001'
const ADDRESS_2 = '0x0000000000000000000000000000000000000002'

const UNLIMITED = 1000000000

const pad = (hex, bytesLength) => {
  const absentZeroes = bytesLength * 2 + 2 - hex.length
  if (absentZeroes > 0) hex = '0x' + '0'.repeat(absentZeroes) + hex.substr(2)
  return hex
}

const hexConcat = (first, ...rest) => {
  let result = first.startsWith('0x') ? first : '0x' + first
  rest.forEach((item) => {
    result += item.startsWith('0x') ? item.substr(2) : item
  })
  return result
}

// Divides a BN by 1e15
const div15 = (bn) => bn.div(new BN(1000000)).div(new BN(1000000)).div(new BN(1000))

const ETH = (value) => web3.utils.toWei(value + '', 'ether')
const tokens = ETH

contract('Lido with official deposit contract', ([appManager, voting, user1, user2, user3, nobody]) => {
  let appBase, stEthBase, nodeOperatorsRegistryBase, app, token, oracle, depositContract, operators
  let treasuryAddr, insuranceAddr
  let testDeposit;

  before('deploy base app', async () => {
    // Deploy the app's base contract.
    appBase = await Lido.new()
    // stEthBase = await StETH.new()
    oracle = await OracleMock.new()
    nodeOperatorsRegistryBase = await NodeOperatorsRegistry.new()
  })

  beforeEach('deploy dao and app', async () => {
    depositContract = await DepositContract.new()
    const { dao, acl } = await newDao(appManager)

    // Instantiate a proxy for the app, using the base contract as its logic implementation.
    let proxyAddress = await newApp(dao, 'lido', appBase.address, appManager)
    app = await Lido.at(proxyAddress)

    // NodeOperatorsRegistry
    proxyAddress = await newApp(dao, 'node-operators-registry', nodeOperatorsRegistryBase.address, appManager)
    operators = await NodeOperatorsRegistry.at(proxyAddress)
    await operators.initialize(app.address)

    // token
    // proxyAddress = await newApp(dao, 'steth', stEthBase.address, appManager)
    token = app
    // await token.initialize(app.address)

    // Set up the app's permissions.
    await acl.createPermission(voting, app.address, await app.PAUSE_ROLE(), appManager, { from: appManager })
    await acl.createPermission(voting, app.address, await app.MANAGE_FEE(), appManager, { from: appManager })
    await acl.createPermission(voting, app.address, await app.MANAGE_WITHDRAWAL_KEY(), appManager, { from: appManager })

    // await acl.createPermission(app.address, token.address, await token.MINT_ROLE(), appManager, { from: appManager })
    // await acl.createPermission(app.address, token.address, await token.BURN_ROLE(), appManager, { from: appManager })

    await acl.createPermission(voting, operators.address, await operators.MANAGE_SIGNING_KEYS(), appManager, { from: appManager })
    await acl.createPermission(voting, operators.address, await operators.ADD_NODE_OPERATOR_ROLE(), appManager, { from: appManager })
    await acl.createPermission(voting, operators.address, await operators.SET_NODE_OPERATOR_ACTIVE_ROLE(), appManager, { from: appManager })
    await acl.createPermission(voting, operators.address, await operators.SET_NODE_OPERATOR_NAME_ROLE(), appManager, { from: appManager })
    await acl.createPermission(voting, operators.address, await operators.SET_NODE_OPERATOR_ADDRESS_ROLE(), appManager, {
      from: appManager
    })
    await acl.createPermission(voting, operators.address, await operators.SET_NODE_OPERATOR_LIMIT_ROLE(), appManager, { from: appManager })
    await acl.createPermission(voting, operators.address, await operators.REPORT_STOPPED_VALIDATORS_ROLE(), appManager, {
      from: appManager
    })

    // Initialize the app's proxy.
    await app.initialize(depositContract.address, oracle.address, operators.address)
    treasuryAddr = await app.getTreasury()
    insuranceAddr = await app.getInsuranceFund()

    await oracle.setPool(app.address)
    testDeposit = await TestDeposit.new(app.address);
  })

  const checkStat = async ({ depositedValidators, beaconBalance }) => {
    const stat = await app.getBeaconStat()
    assertBn(stat.depositedValidators, depositedValidators, 'deposited ether check')
    assertBn(stat.beaconBalance, beaconBalance, 'remote ether check')
  }

  it('deposit works', async () => {

    await operators.addNodeOperator('1', ADDRESS_1, UNLIMITED, { from: voting })
    await operators.addNodeOperator('2', ADDRESS_2, UNLIMITED, { from: voting })

    await app.setWithdrawalCredentials(pad('0x0202', 32), { from: voting })
    await operators.addSigningKeys(0, 1, pad('0x010203', 48), pad('0x01', 96), { from: voting })
    await operators.addSigningKeys(
      0,
      3,
      hexConcat(pad('0x010204', 48), pad('0x010205', 48), pad('0x010206', 48)),
      hexConcat(pad('0x01', 96), pad('0x01', 96), pad('0x01', 96)),
      { from: voting }
    )

    await web3.eth.sendTransaction({ to: testDeposit.address, from: user1, value: ETH(1) })

    await checkStat({ depositedValidators: 0, beaconBalance: 0 })
    assertBn(await testDeposit.shares(user1), ETH(1))
    assertBn(bn(await app.toLittleEndian64(await depositContract.get_deposit_count())), 0)
    assertBn(await app.getTotalPooledEther(), ETH(1))
    assertBn(await app.getBufferedEther(), ETH(1))
    assertBn(await token.balanceOf(testDeposit.address), tokens(1))
    assertBn(await token.totalSupply(), tokens(1))

    // +2 ETH
    await testDeposit.deposit({ from: user2, value: ETH(2) }) // another form of a deposit call

    await checkStat({ depositedValidators: 0, beaconBalance: 0 })
    assertBn(bn(await depositContract.get_deposit_count()), 0)
    assertBn(await app.getTotalPooledEther(), ETH(3))
    assertBn(await app.getBufferedEther(), ETH(3))
    assertBn(await testDeposit.shares(user2), ETH(2))
    assertBn(await token.balanceOf(testDeposit.address), tokens(3))
    assertBn(await token.totalSupply(), tokens(3))
  })

  it('withdraw works', async () => {

    await operators.addNodeOperator('1', ADDRESS_1, UNLIMITED, { from: voting })
    await operators.addNodeOperator('2', ADDRESS_2, UNLIMITED, { from: voting })

    await app.setWithdrawalCredentials(pad('0x0202', 32), { from: voting })
    await operators.addSigningKeys(0, 1, pad('0x010203', 48), pad('0x01', 96), { from: voting })
    await operators.addSigningKeys(
      0,
      3,
      hexConcat(pad('0x010204', 48), pad('0x010205', 48), pad('0x010206', 48)),
      hexConcat(pad('0x01', 96), pad('0x01', 96), pad('0x01', 96)),
      { from: voting }
    )

    await web3.eth.sendTransaction({ to: testDeposit.address, from: user1, value: ETH(1) })

    await checkStat({ depositedValidators: 0, beaconBalance: 0 })
    assertBn(await testDeposit.shares(user1), ETH(1))
    assertBn(bn(await app.toLittleEndian64(await depositContract.get_deposit_count())), 0)
    assertBn(await app.getTotalPooledEther(), ETH(1))
    assertBn(await app.getBufferedEther(), ETH(1))
    assertBn(await token.balanceOf(testDeposit.address), tokens(1))
    assertBn(await token.totalSupply(), tokens(1))


    await assertRevert(testDeposit.withdraw(ETH(2), {from: user1}), 'LIMIT_OVERFLOW')

    // 1 ETH withdraw
    await testDeposit.withdraw(ETH(1), {from: user1});
    assertBn(await token.balanceOf(user1), tokens(1))
    assertBn(await token.balanceOf(testDeposit.address), tokens(0))
    assertBn(await testDeposit.shares(user1), ETH(0))
  })
})
