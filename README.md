# Set Conjurer

Set Conjurer is a local-first desktop app for creating custom cards and complete custom sets. Your cards, sets, images, and frame packs stay on your computer—there are no accounts, cloud storage, or telemetry.

## Download

Choose the installer that matches your computer:

| Platform | Download |
| --- | --- |
| Windows 10/11 (64-bit) | [Download Set Conjurer for Windows](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-Windows-x64-Setup.exe) |
| macOS on an Intel Mac | [Download Set Conjurer for Intel Mac](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-x64.dmg) |
| macOS on an M-series Mac | [Download Set Conjurer for Apple silicon](https://github.com/lawlordev/cardconjurer/releases/latest/download/Set-Conjurer-arm64.dmg) |

Not sure which Mac you have? Open the Apple menu, choose **About This Mac**, and check whether the chip says Intel or Apple M1/M2/M3/M4/M5.

[View all releases, including beta versions](https://github.com/lawlordev/cardconjurer/releases).

## Developer setup

Install [Node.js 24](https://nodejs.org/), then run:

```sh
git clone https://github.com/lawlordev/cardconjurer.git
cd cardconjurer
npm ci
npm run packs:compile
npm run dev
```

`npm run dev` opens the Electron app and automatically reloads changes to the card editor's HTML, CSS, JavaScript, frame definitions, and frame images. If you change files inside `desktop/`, stop the process and run `npm run dev` again.

To use the browser version at `http://localhost:8081` instead, run:

```sh
npm run start:browser
```

Before submitting a change, run:

```sh
npm test
npm run typecheck
npm run lint
```

More detail is available in [desktop development](docs/desktop-development.md) and [release instructions](docs/desktop-release.md).

## Credits

Set Conjurer is an open-source desktop fork of Card Conjurer, originally created by Kyle Burton (`@ImKyle4815`) and maintained by its contributors. The rename does not remove their credit or ownership of their work.

Magic: The Gathering names, symbols, frames, and related assets belong to their respective owners. This project is not affiliated with or endorsed by Wizards of the Coast.

This inherited repository does not currently contain a root open-source license. A license must be chosen and added before a public release.
