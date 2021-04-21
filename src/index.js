import path from 'path'
import fs from 'fs'
import open from 'open'

import crypto from 'crypto'
import { prettyTable, objectToArrayMap } from '@corenode/utils'

const algorithm = 'aes-256-cbc'
const runtime = process.runtime[0]
const args = require('yargs-parser')(process.argv.slice(2))
const argvc = process.argv.slice(2)
const operation = argvc[1]

const ivFile = "iv.json"
const blockFile = "map.json"
const supportedBusTypes = ["usb"]
const genIV = crypto.randomBytes(16)

let masterKey = ""

export function encrypt(data, key) {
    let cipher = crypto.createCipheriv(algorithm, key, genIV)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    return {
        iv: genIV.toString('hex'),
        content: encrypted.toString('hex')
    }
}

export function decrypt(data, key, iv) {
    let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), Buffer.from(iv, 'hex'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()])

    return decrypted.toString()
}

export function readBlock(payload) {
    return new Promise((resolve, reject) => {
        try {
            const { mount, block, key } = payload

            const iv = readMap(mount, ivFile)[block]
            const file = readMap(mount, blockFile)[block]

            if (iv && file) {
                return resolve(decrypt(fs.readFileSync(path.resolve(mount, `block/${file}`), 'utf-8'), key, iv))
            }
            return reject(`No valid IV or FILE`)
        } catch (error) {
            return reject(error)
        }
    })

}

export function writeBlock(payload) {
    return new Promise((resolve, reject) => {
        try {
            const { content, block, mount, key } = payload
            const blockID = crypto.randomBytes(12).toString("hex")

            const encryptedBlock = encrypt(content, Buffer.from(key, "hex"))

            addToMap(mount, ivFile, block, encryptedBlock.iv)
            addToMap(mount, blockFile, block, blockID)

            const blocksPath = path.resolve(mount, `block`)
            const blockPath = path.join(blocksPath, blockID)

            if (!fs.existsSync(blocksPath)) {
                fs.mkdirSync(blocksPath)
            }
            fs.writeFileSync(blockPath, encryptedBlock.content)
            return resolve({ ...encryptedBlock, blockID })
        } catch (error) {
            return reject(error)
        }
    })
}

export function readMap(mountpoint, map) {
    let data = {}
    try {
        data = JSON.parse(fs.readFileSync(path.resolve(mountpoint, map), 'utf-8'))
    } catch (error) {
        console.error(`Failed to read map >> ${error.message}`)
    }
    return data
}

export function addToMap(mountpoint, map, key, value) {
    let mapData = readMap(mountpoint, map) ?? {}
    mapData[key] = value
    fs.writeFileSync(path.resolve(mountpoint, map), JSON.stringify(mapData, null, `\n`))
}

export function writeToMap(mountpoint, map, value) {
    let mapData = readMap(mountpoint, map) ?? {}
    mapData = value
    fs.writeFileSync(path.resolve(mountpoint, map), JSON.stringify(mapData, null, `\n`))
}

export function findDriveMount(mnt) {
    return new Promise((resolve, reject) => {
        getDevices().then((devices) => {
            devices.forEach((drive) => {
                drive.mountpoints.forEach((mount) => {
                    if (mount.label === mnt) {
                        return resolve(mount)
                    }
                })
            })
            return reject()
        })
    })

}

export function getDevices() {
    return new Promise((resolve, reject) => {
        try {
            const devices = []
            const drivelist = require('drivelist')

            drivelist.list().then((drives) => {
                drives.forEach(drive => {
                    const { busType } = drive
                    const supported = supportedBusTypes.some(type => type.toLowerCase() === busType.toLowerCase())

                    if (process.platform == "win32") {
                        drive.mountpoints.forEach((mnt, index) => {
                            drive.mountpoints[index] = {
                                path: mnt.path,
                                label: mnt.path
                            }
                        })
                    }

                    devices.push({ supported, ...drive })
                })
                return resolve(devices)
            })
        } catch (error) {
            return resolve(error)
        }
    })
}

function exitErr(err) {
    console.log(err)
    return process.exit(0)
}

export async function init() {
    if (typeof (operation) !== "string") {
        console.log("Doing nothing :D")
        return process.exit(0)
    }

    if (args.keyFile) {
        try {
            masterKey = fs.readFileSync(path.resolve(args.keyFile)).toString()
        } catch (error) {
            console.log(`Key file invalid >> ${error.message}`)
        }
    }

    switch (operation) {
        case "gen-key": {
            const key = crypto.randomBytes(32)
            const hexKey = key.toString("hex")
            if (args.save) {
                fs.writeFileSync(path.resolve(args.save), hexKey)
            }
            console.log(`New hexKey >>\n ${hexKey}`)
            break
        }
        case "delete": {
            findDriveMount(args.device).then((device) => {
                const mount = device.path
                const block = args.block

                let map = readMap(mount, blockFile)

                if (typeof(map[block]) == "undefined") {
                    return console.error(`❌  Block [${block}] not exists on device [${args.device}]`)
                }

                if (args.purge) {
                    fs.unlinkSync(path.resolve(mount, `block/${map[block]}`))
                    console.log(`🗑  Removed block [${block} | ${map[block]}] on device [${args.device}]`)
                }
     
                delete map[block]
                writeToMap(mount, blockFile, map)
                console.log(`✅  Successfully deleted block [${block}] on device [${args.device}]`)
            })
            break
        }
        case "blocks": {
            findDriveMount(args.device).then((device) => {
                const pt = new prettyTable()
                const headers = ["🔗 Key", "📦 Block"]
                const rows = []

                const map = readMap(device.path, blockFile)
                objectToArrayMap(map).forEach((block) => {
                    rows.push([block.key, block.value])
                })
                pt.create(headers, rows)
                pt.print()
            })
            break
        }
        case "devices": {
            const deviceID = args.device
            const headers = ["device", "description", "mount[0]", "type", "supported"]
            let rows = []

            getDevices()
                .then((data) => {
                    if (deviceID) {
                        findDriveMount(deviceID).then((device) => {
                            console.log(device)
                        })
                    } else {
                        data.forEach((drive) => {
                            const mnt = drive.mountpoints[0] ?? {}
                            rows.push([drive.device, drive.description, mnt.label ?? "none", drive.busType, drive.supported])
                        })
                        const pt = new prettyTable()
                        pt.create(headers, rows)
                        pt.print()
                    }
                })
            break
        }
        case "read": {
            const device = argvc[2]
            const block = argvc[3]

            const mountpoint = await findDriveMount(device).catch(() => {
                return exitErr(`No devices founded with ID [${device}]`)
            })

            readBlock({
                mount: mountpoint.path,
                block: block,
                key: masterKey
            })
                .then((data) => {
                    if (args.open) {
                        const tmpFile = path.resolve(process.cwd(),`.out.txt`)
                        fs.writeFileSync(tmpFile, data)

                        return open(tmpFile)
                        .then(() => {
                            setTimeout(() => {
                                fs.unlinkSync(tmpFile)
                            }, 1000)
                        })
                    }
                    console.log(`
                    \nDONE! >>\n
                    -------------
                    ${data}
                    -------------
                    \n
                    `)
                })
                .catch((err) => {
                    console.error(err)
                })
            break
        }
        case "write": {
            const deviceID = args.device
            const mountpoint = await findDriveMount(deviceID).catch(() => {
                return exitErr(`No devices founded with ID [${deviceID}]`)
            })

            writeBlock({
                mount: mountpoint.path,
                block: args.block,
                content: args.content,
                key: masterKey
            })
                .then((data) => {
                    console.log(`\n✅  Done!\n`)
                    const pt = new prettyTable()

                    const headers = ["device", "block", "iv"]
                    const rows = [[mountpoint.path, data.blockID, data.iv]]

                    pt.create(headers, rows)
                    pt.print()
                })
                .catch((err) => {
                    console.error(err)
                })
            break
        }
        case "init": {
            break
        }
        default:
            throw new Error("⛔️ Invalid operation")
    }
}