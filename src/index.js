import path from 'path'
import fs from 'fs'
import usb from 'usb'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import md5 from 'md5'

const algorithm = 'aes-256-cbc'
const runtime = process.runtime[0]
const args = require('yargs-parser')(process.argv.slice(2))
const argvc = process.argv.slice(2)
const operation = argvc[1]

const ivFile = "iv.json"
const blockFile = "map.json"
const supportedBusTypes = ["usb"]
const libDevicesList = usb.getDeviceList()

const genIV = crypto.randomBytes(16)

function initDevice(device) {

}

function encrypt(data, key) {
    let cipher = crypto.createCipheriv(algorithm, key, genIV)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])

    return {
        iv: genIV.toString('hex'),
        content: encrypted.toString('hex')
    }
}

function decrypt(data, key, iv) {
    let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, "hex"), Buffer.from(iv, 'hex'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()])

    return decrypted.toString()
}

function readBlock(payload) {
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

function writeBlock(payload) {
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

function readMap(mountpoint, map) {
    try {
        return JSON.parse(fs.readFileSync(path.resolve(mountpoint, map), 'utf-8'))
    } catch (error) {
        return {}
    }
}

function addToMap(mountpoint, map, key, value) {
    const mapData = readMap(mountpoint, map) ?? {}
    mapData[key] = value
    fs.writeFileSync(path.resolve(mountpoint, map), JSON.stringify(mapData, null, `\n`))
}

function findDriveMount(mnt) {
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

function getDevices() {
    return new Promise((resolve, reject) => {
        try {
            const devices = []
            const drivelist = require('drivelist')

            drivelist.list().then((drives) => {
                drives.forEach(drive => {
                    const { busType } = drive
                    const supported = supportedBusTypes.some(type => type.toLowerCase() === busType.toLowerCase())

                    if (supported) {
                        devices.push({ supported, ...drive })
                    }
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

async function init() {
    if (typeof (operation) !== "string") {
        return process.exit(0)
    }

    switch (operation) {
        case "gen-key": {
            const key = crypto.randomBytes(32)
            const hexKey = key.toString("hex")

            console.log(hexKey)
            break
        }
        case "read": {
            const device = argvc[2]
            const block = argvc[3]
            const key = argvc[4]

            const mountpoint = await findDriveMount(device).catch(() => {
                return exitErr(`No devices founded with ID [${device}]`)
            })

            readBlock({
                mount: mountpoint.path,
                block: block,
                key: key
            })
                .then((data) => {
                    console.log(`\nDONE! >>`)
                    console.log(`\n${data}\n`)
                })
                .catch((err) => {
                    console.error(error)
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
                key: args.key
            })
                .then((data) => {
                    // TODO: "Add `iv`, `blockID` information"
                    console.log(`Done!`)
                })
                .catch((err) => {
                    console.error(error)
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

init()