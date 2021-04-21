# 🗄 usb_vault | An block based text-plain encryption tool
## ⚠️ Disclaimer ⚠️
This script is an experimental utility that is subject to an open source license and we cannot be held responsible for possible loss of data and any damage that this utility may cause. Try to protect your data before using this utility (especially if it is not a stable version)

## About
This utility allows you to encrypt plain text in the form of blocks and save it in an external storage unit.
It currently uses `aes-256-cbc` encryption and uses a generated master key that you can import from a file or USB key.

### Use guide
You can initialize the utility from a version compiled with a terminal.

It is designed to support cross-platform. Some functionalities may be affected by lack of compatibility on some platforms.

| Win32 | Linux | Darwin |
|--|--|--|
| Partially, some bugs may be found (especially WSL) | Distributions that include [util-linux](https://github.com/karelzak/util-linux) and [udev](https://wiki.archlinux.org/index.php/udev) | Fully support |

>Includes a full-featured API that allows you to use this utility as a library

#### CLI Mode basic usage
Try to display the available devices
```{r, engine='bash', count_lines}
$ usbvault devices

// example output
+----------------+----------------------+----------------------------------------+
| device         | description          | mount[0]    | type  | supported        |
+----------------+----------------------+----------------------------------------+
| /dev/disk0     | APPLE SSD            | Macintosh HD | PCI-Express | false     |
| /dev/disk3     | General USB Flash Disk Media | VAULT  | USB | true            |
+----------------+----------------------+----------------------------------------+
```

See all the blocks that a device contains

```{r, engine='bash', count_lines}
$ usbvault blocks --device="VAULT" // Put on --device the mountpoint of the desired device

// example output
+--------+--------------------------+
| 🔗 Key | 📦 Block                 |
+--------+--------------------------+
| test1  | beb81fcd02018fd22097d4a2 |
| test2  | 86eaa403fa6d564e23b6bdad |
+--------+--------------------------+
```

Write a new block on an device
```{r, engine='bash', count_lines}
$ usbvault --device="VAULT" --block="test3" --content="hello from the other side" --keyFile="/Volumes/VAULT/key" 

// example output
✅  Done! 

+----------------+--------------------------+----------------------------------+
| device         | block                    | iv                               |
+----------------+--------------------------+----------------------------------+
| /Volumes/VAULT | cde92bf8f50b64fd3c4f6582 | d0137238c9c29efc098e45f76dc9b7ca |
+----------------+--------------------------+----------------------------------+
```
> Use --keyFile to load custom master key if a USB key is not available (Can input file path or text)

Read a block from an device
```{r, engine='bash', count_lines}
$ usbvault read "VAULT" "test3" --keyFile="/Volumes/VAULT/key"

// example output
DONE! >>
-------------
hello from the other side
-------------
```

> Or you can use --open to display a temporary file with the contents of the block in plain text

## CLI Operations 
#### operations.[read]
Read block data from an device
```{r, engine='bash', count_lines}
$ usbvault read <device> <block> <--keyFile>
```
#### operations.[write]
Write a block on an device
```{r, engine='bash', count_lines}
$ usbvault write <--device> <--block> <--content> <--keyFile>
```
#### operations.[delete]
Delete block from the blockmap and/or remove the block file
```{r, engine='bash', count_lines}
$ usbvault write <--device> <--block> [--purge]
```
Optionals arguments:
 > Remove block file [ --purge {Boolean} ]
 
#### operations.[link]
Link an block to blockmap with an ID
```{r, engine='bash', count_lines}
$ usbvault link <--device> <--block> <--id>
```
#### operations.[devices]
Show all devices or shows the information of a device
```{r, engine='bash', count_lines}
$ usbvault devices [--device]
```
Optionals arguments:
 > Show device information [ --device={String} ]

#### operations.[blocks]
Display all blocks wrote of a device
```{r, engine='bash', count_lines}
$ usbvault blocks <--device>
```
#### operations.[gen-key]
Generate a random 16 bytes master key and/or save to an path
```{r, engine='bash', count_lines}
$ usbvault gen-key [--save]
```
Optionals arguments:
 > Write key file to directory [ --save={String} ]

### Development
To start a development version you need some dependencies.
- [Nodejs](https://nodejs.org/es/) ^14.16.1
- An package manager
- For linux [util-linux](https://github.com/karelzak/util-linux) and [udev](https://wiki.archlinux.org/index.php/udev)

This utility uses the [Corenode](https://github.com/ragestudio/nodecore) framework to work.

> Use the corenode compiler to transform the source, we recommend having a version of corenode installed globally.
```{r, engine='bash', count_lines}
npm install -g corenode 
```

Start compiling the source
```{r, engine='bash', count_lines}
corenode build
```

Use the debugging interface of corenode to run the utility
```{r, engine='bash', count_lines}
corenode dist/bin.js [...arguments]
```