const { assert } = require('chai')
const { newDao, newApp } = require('./helpers/dao')
const { assertBn, assertRevert, assertEvent } = require('@aragon/contract-helpers-test/src/asserts')
const { bn } = require('@aragon/contract-helpers-test')

const LidoOracle = artifacts.require('LidoOracleMock.sol')

contract('LidoOracle', ([appManager, voting, nobody, ...users]) => {
  let appBase, app

  const assertReportableEpochs = async (startEpoch, endEpoch) => {
    const result = await app.getCurrentReportableEpochs()
    assertBn(result.minReportableEpochId, startEpoch)
    assertBn(result.maxReportableEpochId, endEpoch)
  }

  before('deploy base app', async () => {
    // Deploy the app's base contract.
    appBase = await LidoOracle.new()
  })

  beforeEach('deploy dao and app', async () => {
    const { dao, acl } = await newDao(appManager)

    // Instantiate a proxy for the app, using the base contract as its logic implementation.
    const proxyAddress = await newApp(dao, 'lidooracle', appBase.address, appManager)
    app = await LidoOracle.at(proxyAddress)

    // Set up the app's permissions.
    await acl.createPermission(voting, app.address, await app.MANAGE_MEMBERS(), appManager, { from: appManager })
    await acl.createPermission(voting, app.address, await app.MANAGE_QUORUM(), appManager, { from: appManager })
    await acl.createPermission(voting, app.address, await app.SET_BEACON_SPEC(), appManager, { from: appManager })

    // Initialize the app's proxy.
    await app.initialize('0x0000000000000000000000000000000000000000', 1, 10, 10, 100)

    for (let i = 0; i < 10; i++) {
      await app.addOracleMember(users[i], { from: voting })
    }

    await app.setTime(100)
  })

  context('When oracles report same data', () => {
    for (let q = 1; q <= 10; q++) {
      context(`${q} members are reporting sequentially (quorum = ${q}:)`, () => {
        it('', async () => {
          let n, receipt
          let totalGas = 0

          await app.setQuorum(q, { from: voting })

          for (n = 0; n < q - 1; n++) {
            ;({ receipt } = await app.reportBeacon(0, 0, 0, { from: users[n] }))
            console.log(`report ${n + 1} : ` + receipt.gasUsed)
            totalGas += receipt.gasUsed
          }

          txn = await app.reportBeacon(0, 0, 0, { from: users[q - 1] })
          assertEvent(txn, 'Completed')
          console.log(`report ${n + 1} (quorum) : ` + txn.receipt.gasUsed)
          totalGas += txn.receipt.gasUsed

          console.log(`Total: ${totalGas}`)
        })
      })
    }
  })

  context('When oracles report different data (quorum = 2)', () => {
    beforeEach(async () => {
      await app.setQuorum(2, { from: voting })
    })

    for (let q = 2; q <= 10; q++) {
      context(`${q} members are reporting sequentially:`, () => {
        it('', async () => {
          let n, receipt
          let totalGas = 0

          for (n = 0; n < q - 1; n++) {
            ;({ receipt } = await app.reportBeacon(0, n, n, { from: users[n] }))
            console.log(`report ${n + 1} : ` + receipt.gasUsed)
            totalGas += receipt.gasUsed
          }

          txn = await app.reportBeacon(0, 0, 0, { from: users[q - 1] })
          assertEvent(txn, 'Completed')
          console.log(`report ${n + 1} (quorum) : ` + txn.receipt.gasUsed)
          totalGas += txn.receipt.gasUsed

          console.log(`Total: ${totalGas}`)
        })
      })
    }
  })
})
